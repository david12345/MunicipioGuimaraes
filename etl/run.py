#!/usr/bin/env python3
"""Orquestrador do pipeline.

    python -m etl.run --fase fontes     # (re)gera data/processed/fontes.json
    python -m etl.run --fase fetch      # descarrega os originais para data/raw/
    python -m etl.run --check-acesso    # diagnostica que fontes estão alcançáveis

Nenhum passo inventa dados: quando uma fonte está inacessível, a falha é
registada e o indicador fica por preencher (regra 1).
"""
from __future__ import annotations

import argparse
import sys

import requests

from etl.common import fontes as mod_fontes
from etl.common.fetch import fetch


def check_acesso() -> int:
    """Diz quais fontes estão alcançáveis a partir deste ambiente."""
    regs = mod_fontes.carregar()
    bloqueadas = []
    print(f"A testar {len(regs)} fonte(s)...\n")
    for fid, f in sorted(regs.items()):
        url = f.get("url")
        if not url:
            continue
        try:
            r = requests.head(
                url, timeout=20, allow_redirects=True,
                headers={"User-Agent": "MunicipioGuimaraes-dashboard/0.1"},
            )
            print(f"  {fid:6} {r.status_code}  {url}")
        except requests.RequestException as exc:
            motivo = type(exc).__name__
            bloqueadas.append((fid, url, motivo))
            print(f"  {fid:6} ----  {url}  [{motivo}]")

    if bloqueadas:
        print(
            f"\n{len(bloqueadas)} de {len(regs)} fonte(s) inacessíveis a partir "
            "deste ambiente.\nVer docs/qualidade_dados.md §L1 para as vias de "
            "desbloqueio. Não contornar a política de rede."
        )
        return 1
    print("\nTodas as fontes alcançáveis.")
    return 0


def fase_fetch() -> int:
    regs = mod_fontes.carregar()
    falhas = []
    for fid, f in sorted(regs.items()):
        url = f.get("url")
        if not url:
            continue
        try:
            p = fetch(url, fid)
            print(f"  {fid}: {p.name}")
        except requests.RequestException as exc:
            falhas.append((fid, str(exc)[:120]))
            print(f"  {fid}: FALHOU — {type(exc).__name__}", file=sys.stderr)
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
