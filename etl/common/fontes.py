"""Carrega etl/sources.yaml e produz data/processed/fontes.json.

Todos os outros ficheiros processados referenciam estes ids via `fonte_id`;
a validação V6 verifica que nenhum id órfão sobrevive.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import yaml

from .paths import PROCESSED, RAW, SOURCES_YAML


def carregar() -> dict:
    with open(SOURCES_YAML, encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def _meta_do_raw() -> dict[str, dict]:
    """Indexa os sidecars existentes em data/raw/ por fonte_id."""
    out: dict[str, dict] = {}
    for p in RAW.glob("*.meta.json"):
        try:
            m = json.loads(p.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if fid := m.get("fonte_id"):
            out[fid] = m
    return out


def escrever_fontes_json() -> Path:
    fontes = carregar()
    raws = _meta_do_raw()
    saida: dict[str, dict] = {}

    for fid, f in fontes.items():
        registo = dict(f)
        registo["id"] = fid
        meta = raws.get(fid)
        # Só declaramos download/sha256 se existir mesmo um original em disco.
        registo["ficheiro_raw"] = meta.get("ficheiro") if meta else None
        registo["sha256"] = meta.get("sha256") if meta else None
        registo["data_download"] = meta.get("data_download") if meta else None
        registo["descarregado"] = meta is not None
        saida[fid] = registo

    destino = PROCESSED / "fontes.json"
    destino.write_text(
        json.dumps(
            {
                "_meta": {
                    "gerado_em": datetime.now(timezone.utc).isoformat(),
                    "script": "etl/common/fontes.py",
                    "versao_modelo": "1.0",
                    "total_fontes": len(saida),
                    "fontes_descarregadas": sum(
                        1 for v in saida.values() if v["descarregado"]
                    ),
                },
                "dados": saida,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return destino


def ids_validos() -> set[str]:
    return set(carregar().keys())
