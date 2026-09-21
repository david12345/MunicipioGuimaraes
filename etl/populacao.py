#!/usr/bin/env python3
"""População residente — denominador transversal do dashboard.

Produz `populacao.json` a partir das Estimativas Anuais da População Residente
do INE (S32, indicador **0012918**, NUTS 2024).

É o ficheiro de que dependem **todas** as métricas per capita — a frase que o
briefing pede ("a Câmara prevê gastar X €, o equivalente a Y € por habitante")
não existe sem ele. Por isso a V7 é explícita: uma só série. O indicador NUTS
2013 (0008273) cobre 2011–2023 e daria mais história, mas perdia 2024 e 2025;
misturar os dois seria tratar como contínua uma série que não o é.

Guimarães é o `geocod` **1190308** na classificação do INE.

    python -m etl.populacao
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from etl.common import fontes as mod_fontes
from etl.common.fetch import absoluto
from etl.common.paths import PROCESSED, RAW
from etl.common.validate import Relatorio, v5_serie_continua

FONTE = "S32"
INDICADOR = "0012918"
GEOCOD_GUIMARAES = "1190308"
GEOCOD_PORTUGAL = "PT"
VERSAO_MODELO = "1.0"

# Na resposta do INE: dim_3 = sexo (T/1/2), dim_4 = grupo etário (T = total).
SEXO_TOTAL, IDADE_TOTAL = "T", "T"
SEXOS = {"T": "total", "1": "homens", "2": "mulheres"}


def _raw_de(fonte_id: str) -> Path | None:
    for p in RAW.glob("*.meta.json"):
        try:
            m = json.loads(p.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if m.get("fonte_id") == fonte_id:
            caminho = absoluto(m["ficheiro"])
            if caminho.exists():
                return caminho
    return None


def _valor(registo: dict) -> int | None:
    """`valor` do INE. Ausente ou não numérico → None, nunca 0 (regra do null)."""
    v = str(registo.get("valor", "")).strip()
    return int(v) if re.fullmatch(r"\d+", v) else None


def construir() -> int:
    rel = Relatorio()
    avisos: list[str] = []

    caminho = _raw_de(FONTE)
    if caminho is None:
        print(
            f"Falta o original de {FONTE} em data/raw/. Corre `make fetch`.\n"
            "A API do INE é intolerante à cadência: um pedido de cada vez.",
            file=sys.stderr,
        )
        return 1
    if FONTE not in mod_fontes.ids_validos():  # V6
        print(f"V6: fonte_id {FONTE} não resolve em fontes.json", file=sys.stderr)
        return 1

    bruto = json.loads(caminho.read_text(encoding="utf-8"))
    bloco = bruto[0] if isinstance(bruto, list) else bruto

    # V7 por construção: um só indicador alimenta este ficheiro.
    rel.check(
        "V7-serie-unica",
        bloco.get("IndicadorCod") == INDICADOR,
        f"o original diz indicador {bloco.get('IndicadorCod')}, esperado {INDICADOR}",
    )

    dados = bloco.get("Dados", {})
    anos = sorted(int(a) for a in dados if re.fullmatch(r"\d{4}", a))
    rel.check("tem-anos", bool(anos), "a resposta do INE não trouxe períodos")
    if not rel.passou:
        for f in rel.falhas:
            print(f"  {f}", file=sys.stderr)
        return 1

    if em_falta := v5_serie_continua(anos):  # V5
        rel.falhas.append(f"V5: anos em falta no meio da série: {em_falta}")
    else:
        rel.ok.append("V5")

    por_ano: list[dict] = []
    contexto: list[dict] = []
    estrutura_etaria: list[dict] = []

    for ano in anos:
        registos = dados[str(ano)]
        guim = [r for r in registos if r.get("geocod") == GEOCOD_GUIMARAES]

        linha = {"ano": ano, "fonte_id": FONTE}
        for cod, rotulo in SEXOS.items():
            alvo = [
                r for r in guim if r.get("dim_3") == cod and r.get("dim_4") == IDADE_TOTAL
            ]
            linha[rotulo] = _valor(alvo[0]) if alvo else None
        por_ano.append(linha)

        pt = [
            r for r in registos
            if r.get("geocod") == GEOCOD_PORTUGAL
            and r.get("dim_3") == SEXO_TOTAL
            and r.get("dim_4") == IDADE_TOTAL
        ]
        contexto.append(
            {
                "ano": ano,
                "portugal": _valor(pt[0]) if pt else None,
                "fonte_id": FONTE,
            }
        )

        if ano == anos[-1]:  # estrutura etária só do ano mais recente
            for r in guim:
                if r.get("dim_3") != SEXO_TOTAL or r.get("dim_4") == IDADE_TOTAL:
                    continue
                estrutura_etaria.append(
                    {
                        "grupo_etario": r.get("dim_4_t"),
                        "pessoas": _valor(r),
                        "fonte_id": FONTE,
                    }
                )
            estrutura_etaria.sort(key=lambda x: x["grupo_etario"] or "")

    # Coerência interna: homens + mulheres == total, em cada ano.
    for linha in por_ano:
        h, m, t = linha["homens"], linha["mulheres"], linha["total"]
        rel.check(
            f"soma-sexos-{linha['ano']}",
            None not in (h, m, t) and h + m == t,
            f"{linha['ano']}: homens {h} + mulheres {m} != total {t}",
        )

    # A estrutura etária tem de reconstituir o total do ano.
    if estrutura_etaria:
        soma = sum(e["pessoas"] for e in estrutura_etaria if e["pessoas"] is not None)
        rel.check(
            "soma-grupos-etarios",
            soma == por_ano[-1]["total"],
            f"grupos etários somam {soma}, total de {anos[-1]} é {por_ano[-1]['total']}",
        )

    if anos[0] > 2019:
        avisos.append(
            f"A série começa em {anos[0]}. O indicador {INDICADOR} (NUTS 2024) não "
            "cobre anos anteriores, pelo que não há métricas per capita para "
            "2019–2020, embora haja contratos desses anos. Ver L21."
        )
    if anos[-1] < 2026:
        avisos.append(
            f"A série termina em {anos[-1]}. Não há população de 2026: as métricas "
            f"per capita de 2026 usam {anos[-1]} e devem dizê-lo, ou ficam a `null`."
        )

    if not rel.passou:
        print("Validações falhadas — nada foi escrito:", file=sys.stderr)
        for f in rel.falhas:
            print(f"  {f}", file=sys.stderr)
        return 1

    saida = {
        "_meta": {
            "gerado_em": datetime.now(timezone.utc).isoformat(),
            "script": "etl/populacao.py",
            "versao_modelo": VERSAO_MODELO,
            "fontes": [FONTE],
            "indicador_ine": INDICADOR,
            "geocod": GEOCOD_GUIMARAES,
            "avisos": avisos,
        },
        "municipio": "Guimarães",
        "primeiro_ano": anos[0],
        "ultimo_ano": anos[-1],
        "populacao_por_ano": por_ano,
        "estrutura_etaria": {"ano": anos[-1], "grupos": estrutura_etaria},
        "contexto_nacional": contexto,
    }
    destino = PROCESSED / "populacao.json"
    destino.write_text(
        json.dumps(saida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Escrito {destino}")
    for linha in por_ano:
        print(f"  {linha['ano']}: {linha['total']:,} habitantes".replace(",", " "))
    print(f"\nValidações passadas: {len(rel.ok)} (inclui V5 e V7)")
    for a in avisos:
        print(f"aviso: {a}")
    return 0


if __name__ == "__main__":
    raise SystemExit(construir())
