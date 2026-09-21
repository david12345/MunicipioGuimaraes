"""Descarrega fontes para data/raw/ preservando o original (regra 3).

Idempotente (regra 4): se o ficheiro já existe e o conteúdo remoto não mudou,
não volta a escrever. Cada download gera um sidecar .meta.json com o URL, a data
e o sha256 — é isso que permite detetar que uma autarquia substituiu um PDF em
silêncio mantendo o mesmo URL.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import date, datetime, timezone
from pathlib import Path

import requests

from .paths import RAW

UA = "MunicipioGuimaraes-dashboard/0.1 (dados abertos; contacto no repositório)"
TIMEOUT = 60


def slugify(nome: str) -> str:
    nome = re.sub(r"[^\w\s.-]", "", nome, flags=re.UNICODE).strip()
    return re.sub(r"[\s_]+", "_", nome).lower()


def nome_original(url: str) -> str:
    """Preserva o nome original do ficheiro, como exige a regra 3."""
    base = url.rstrip("/").split("/")[-1].split("?")[0]
    return base or "index.html"


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def fetch(url: str, fonte_id: str, *, forcar: bool = False) -> Path:
    """Descarrega `url` para data/raw/<data>_<nome original>.

    Devolve o caminho local. Levanta `requests.HTTPError` em erro HTTP e
    `requests.RequestException` se o host estiver inacessível — o chamador
    decide se isso é fatal (ver etl/run.py, que regista a falha em vez de
    abortar todo o pipeline).
    """
    hoje = date.today().isoformat()
    destino = RAW / f"{hoje}_{nome_original(url)}"
    meta_path = destino.with_suffix(destino.suffix + ".meta.json")

    if destino.exists() and not forcar:
        return destino

    resp = requests.get(url, headers={"User-Agent": UA}, timeout=TIMEOUT)
    resp.raise_for_status()
    conteudo = resp.content
    digest = sha256_bytes(conteudo)

    # Se já temos este conteúdo noutra data, não duplicamos o original.
    for antigo_meta in RAW.glob("*.meta.json"):
        try:
            m = json.loads(antigo_meta.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if m.get("sha256") == digest and m.get("url") == url:
            return Path(m["ficheiro"])

    destino.write_bytes(conteudo)
    meta_path.write_text(
        json.dumps(
            {
                "fonte_id": fonte_id,
                "url": url,
                "ficheiro": str(destino),
                "sha256": digest,
                "bytes": len(conteudo),
                "content_type": resp.headers.get("Content-Type"),
                "data_download": hoje,
                "descarregado_em": datetime.now(timezone.utc).isoformat(),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return destino
