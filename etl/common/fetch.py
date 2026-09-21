"""Descarrega fontes para data/raw/ preservando o original (regra 3).

Idempotente (regra 4): se o ficheiro já existe e o conteúdo remoto não mudou,
não volta a escrever. Cada download gera um sidecar .meta.json com o URL, a data
e o sha256 — é isso que permite detetar que uma autarquia substituiu um PDF em
silêncio mantendo o mesmo URL.

O download é feito em streaming: o Mapa Oficial das eleições (S16-DRE) tem
~149 MB e não cabe confortavelmente em memória.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import date, datetime, timezone
from pathlib import Path

import requests

from .paths import RAW, ROOT

UA = "MunicipioGuimaraes-dashboard/0.1 (dados abertos; contacto no repositório)"
TIMEOUT = 60
BLOCO = 1 << 20  # 1 MiB por leitura


def slugify(nome: str) -> str:
    nome = re.sub(r"[^\w\s.-]", "", nome, flags=re.UNICODE).strip()
    return re.sub(r"[\s_]+", "_", nome).lower()


def nome_original(url: str) -> str:
    """Preserva o nome original do ficheiro, como exige a regra 3."""
    base = url.rstrip("/").split("/")[-1].split("?")[0]
    return base or "index.html"


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def relativo(caminho: Path) -> str:
    """Caminho relativo à raiz do repositório.

    Os sidecars são commitados: um caminho absoluto gravaria a máquina de quem
    correu o `fetch` e deixaria de resolver em qualquer outra. `modelo_dados.md`
    especifica `data/raw/<ficheiro>`.
    """
    return str(caminho.resolve().relative_to(ROOT))


def absoluto(caminho: str | Path) -> Path:
    """Inverso de `relativo`, tolerando sidecars antigos com caminho absoluto."""
    p = Path(caminho)
    return p if p.is_absolute() else ROOT / p


def _ja_temos(url: str, digest: str) -> Path | None:
    """Procura um original idêntico já em disco, para não duplicar por data."""
    for antigo_meta in RAW.glob("*.meta.json"):
        try:
            m = json.loads(antigo_meta.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if m.get("sha256") == digest and m.get("url") == url:
            anterior = absoluto(m["ficheiro"])
            if anterior.exists():
                return anterior
    return None


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

    if destino.exists() and meta_path.exists() and not forcar:
        return destino

    # Escreve para um ficheiro temporário e só promove no fim: uma interrupção
    # a meio de 149 MB não pode deixar um original truncado em data/raw/.
    parcial = destino.with_suffix(destino.suffix + ".parcial")
    h = hashlib.sha256()
    total = 0
    with requests.get(
        url, headers={"User-Agent": UA}, timeout=TIMEOUT, stream=True
    ) as resp:
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type")
        with open(parcial, "wb") as fh:
            for bloco in resp.iter_content(chunk_size=BLOCO):
                if not bloco:
                    continue
                h.update(bloco)
                fh.write(bloco)
                total += len(bloco)

    digest = h.hexdigest()

    if (anterior := _ja_temos(url, digest)) is not None:
        parcial.unlink(missing_ok=True)
        return anterior

    parcial.replace(destino)
    meta_path.write_text(
        json.dumps(
            {
                "fonte_id": fonte_id,
                "url": url,
                "ficheiro": relativo(destino),
                "sha256": digest,
                "bytes": total,
                "content_type": content_type,
                "data_download": hoje,
                "descarregado_em": datetime.now(timezone.utc).isoformat(),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return destino
