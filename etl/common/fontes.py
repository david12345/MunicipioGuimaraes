"""Carrega etl/sources.yaml e produz data/processed/fontes.json.

Todos os outros ficheiros processados referenciam estes ids via `fonte_id`;
a validação V6 verifica que nenhum id órfão sobrevive.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import yaml

from . import descoberta as mod_desc
from .paths import PROCESSED, RAW, SOURCES_YAML


def carregar() -> dict:
    """Só o inventário escrito à mão."""
    with open(SOURCES_YAML, encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def carregar_todas() -> dict:
    """Inventário + fontes-filhas derivadas das páginas-índice.

    É este o universo contra o qual a V6 resolve `fonte_id`: um parser de
    contratos aponta para `S23-2024`, que existe por descoberta e não em
    `sources.yaml`.
    """
    return {**carregar(), **mod_desc.carregar_descobertas()}


def _meta_do_raw() -> dict[str, dict]:
    """Indexa os sidecars existentes em data/raw/ por (fonte_id, url).

    A chave inclui o URL de propósito. Casar só por `fonte_id` deixava um
    download antigo continuar a responder por uma fonte cujo URL entretanto
    mudou: quando S32 passou da homepage do INE para o indicador 0012918,
    `fontes.json` continuou a declarar a fonte "descarregada", com o sha256
    da homepage. Um parser leria isso como "os dados existem".
    """
    out: dict[str, dict] = {}
    for p in RAW.glob("*.meta.json"):
        try:
            m = json.loads(p.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if (fid := m.get("fonte_id")) and (url := m.get("url")):
            out[f"{fid}\n{url}"] = m
    return out


def escrever_fontes_json() -> Path:
    fontes = carregar_todas()
    raws = _meta_do_raw()
    saida: dict[str, dict] = {}

    for fid, f in fontes.items():
        registo = dict(f)
        registo["id"] = fid
        # `descoberta` é configuração do pipeline, não metadado da fonte:
        # o dashboard só precisa de saber que esta fonte é uma página-índice.
        if registo.pop("descoberta", None) is not None:
            registo["e_indice"] = True
        meta = raws.get(f"{fid}\n{f.get('url')}")
        # Só declaramos download/sha256 se existir mesmo um original em disco.
        # Relativo à raiz do repositório: este ficheiro é commitado.
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
    """Universo aceite pela validação V6, descobertas incluídas."""
    return set(carregar_todas().keys())
