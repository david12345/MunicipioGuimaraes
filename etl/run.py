#!/usr/bin/env python3
"""Orquestrador do pipeline.

    python -m etl.run --fase fontes     # (re)gera data/processed/fontes.json
    python -m etl.run --fase fetch      # descarrega os originais para data/raw/
    python -m etl.run --check-acesso    # diagnostica que fontes estão alcançáveis

Nenhum passo inventa dados: quando uma fonte está inacessível, a falha é
registada e o indicador fica por preencher (regra 1).

O `fetch` corre em duas passagens: primeiro as fontes de `sources.yaml`, depois
as fontes-filhas derivadas das páginas-índice (ver etl/common/descoberta.py).
"""
from __future__ import annotations

import argparse
import sys

import requests

from etl.common import descoberta as mod_desc
from etl.common import fontes as mod_fontes
from etl.common.fetch import UA, fetch


def _alcancavel(url: str) -> tuple[str, str | None]:
    """Devolve (estado, motivo). Usa GET em streaming: o INE rejeita HEAD."""
    cab = {"User-Agent": UA}
    try:
        with requests.get(
            url, timeout=25, allow_redirects=True, stream=True, headers=cab
        ) as r:
            return str(r.status_code), None
    except requests.RequestException as exc:
        return "----", type(exc).__name__


def check_acesso() -> int:
    """Diz quais fontes estão alcançáveis a partir deste ambiente."""
    regs = mod_fontes.carregar_todas()
    bloqueadas = []
    print(f"A testar {len(regs)} fonte(s)...\n")
    for fid, f in sorted(regs.items()):
        url = f.get("url")
        if not url:
            continue
        estado, motivo = _alcancavel(url)
        if motivo:
            bloqueadas.append((fid, url, motivo))
            print(f"  {fid:10} ----  {url}  [{motivo}]")
        else:
            print(f"  {fid:10} {estado}  {url}")

    if bloqueadas:
        print(
            f"\n{len(bloqueadas)} de {len(regs)} fonte(s) inacessíveis a partir "
            "deste ambiente.\nVer docs/qualidade_dados.md §L1 para as vias de "
            "desbloqueio. Não contornar a política de rede."
        )
        return 1
    print("\nTodas as fontes alcançáveis.")
    return 0


def _descarregar(regs: dict[str, dict], falhas: list) -> dict[str, "object"]:
    """Descarrega um conjunto de fontes; devolve {fonte_id: caminho} das que deram."""
    obtidos = {}
    for fid, f in sorted(regs.items()):
        url = f.get("url")
        if not url:
            continue
        try:
            p = fetch(url, fid)
            obtidos[fid] = p
            print(f"  {fid}: {p.name}")
        except requests.RequestException as exc:
            falhas.append((fid, str(exc)[:120]))
            print(f"  {fid}: FALHOU — {type(exc).__name__}", file=sys.stderr)
    return obtidos


def fase_fetch() -> int:
    regs = mod_fontes.carregar()
    falhas: list = []

    print("Fontes do inventário:")
    obtidos = _descarregar(regs, falhas)

    # 2.ª passagem: páginas-índice → ficheiros reais.
    derivadas: dict[str, dict] = {}
    for fid, f in sorted(regs.items()):
        if "descoberta" not in f:
            continue
        filhas = mod_desc.derivar(fid, f, obtidos.get(fid))
        if not filhas:
            print(
                f"  aviso: {fid} declara descoberta mas o padrão não encontrou "
                "nada no original guardado.",
                file=sys.stderr,
            )
        derivadas.update(filhas)

    if derivadas:
        print(f"\nDescobertas {len(derivadas)} fonte(s) a partir das páginas-índice:")
        _descarregar(derivadas, falhas)
        print(f"Registo em {mod_desc.escrever_descobertas(derivadas)}")

    if falhas:
        print(
            f"\n{len(falhas)} fonte(s) não descarregadas. data/raw/ fica incompleto; "
            "os parsers só processam o que existe.",
            file=sys.stderr,
        )
        return 1
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--fase", choices=["fontes", "fetch"])
    ap.add_argument("--check-acesso", action="store_true")
    args = ap.parse_args()

    if args.check_acesso:
        return check_acesso()
    if args.fase == "fontes":
        print(f"Escrito {mod_fontes.escrever_fontes_json()}")
        return 0
    if args.fase == "fetch":
        return fase_fetch()
    ap.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
