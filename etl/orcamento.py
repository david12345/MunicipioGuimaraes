#!/usr/bin/env python3
"""Secção 5 do dashboard — "De onde vem o dinheiro".

Produz `orcamento.json` (previsto) a partir dos documentos previsionais da CMG
— Grandes Opções do Plano e Orçamento, `S08-<ano>`.

Estes documentos têm entre 663 e 1005 páginas e são **mistos**: o texto
normativo tem camada de texto, mas centenas de páginas de mapas são imagem
digitalizada. O que este parser lê é o mapa **"RESUMO DA RECEITA E DA DESPESA"**,
que felizmente é texto em 2022–2026 e concentra os agregados que interessam ao
cidadão. O de 2021 é integralmente digitalizado e fica de fora (L25).

O mapa traz sete colunas — períodos anteriores, período, soma, e quatro anos de
plano plurianual. **Só a coluna do período** é o orçamento do ano; as restantes
são projeções e não entram como se fossem orçamento aprovado.

    python -m etl.orcamento
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

from etl.common import fontes as mod_fontes
from etl.common.fetch import absoluto
from etl.common.paths import PROCESSED, RAW
from etl.common.validate import Relatorio, ValidationError, v2_orcamento_equilibrado

VERSAO_MODELO = "1.0"
TITULO_MAPA = "RESUMO DA RECEITA E DA DESPESA"

# `131 642 648,00 €` — o separador de milhares é espaço, normal ou insecável.
RE_EUROS = re.compile(r"(\d[\d\s .]*,\d{2})\s*€")

CAMPOS = {
    "receita corrente": "receita_corrente",
    "receita de capital": "receita_capital",
    "receita efetiva": "receita_efetiva",
    "receita nao efetiva": "receita_nao_efetiva",
    "receita total": "receita_total",
    "despesa corrente": "despesa_corrente",
    "despesa de capital": "despesa_capital",
    "despesa efetiva": "despesa_efetiva",
    "despesa nao efetiva": "despesa_nao_efetiva",
    "despesa total": "despesa_total",
    "saldo total": "saldo_total",
    "saldo global": "saldo_global",
}


def _sem_acentos(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def _rotulo(linha: str) -> str | None:
    """`Receita total [3] = [1] + [2]` → `receita total`."""
    base = re.sub(r"\[.*?\]|=|\+|\d", " ", linha)
    base = re.sub(r"\s+", " ", _sem_acentos(base).lower()).strip(" .:-")
    return base if base in CAMPOS else None


def _euros(texto: str) -> float:
    limpo = texto.replace(" ", "").replace(" ", "").replace(".", "")
    return round(float(limpo.replace(",", ".")), 2)


def _raw_por_fonte() -> dict[str, Path]:
    out: dict[str, Path] = {}
    for p in RAW.glob("*.meta.json"):
        try:
            m = json.loads(p.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        caminho = absoluto(m["ficheiro"])
        if m.get("fonte_id") and caminho.exists():
            out[m["fonte_id"]] = caminho
    return out


def extrair_resumo(caminho: Path) -> dict[str, float] | None:
    """Lê o mapa-resumo. `None` se o documento não o tiver em texto."""
    doc = pymupdf.open(caminho)
    pagina = next(
        (i for i in range(doc.page_count) if TITULO_MAPA in doc[i].get_text().upper()),
        None,
    )
    if pagina is None:
        doc.close()
        return None

    linhas = [ln.strip() for ln in doc[pagina].get_text().split("\n") if ln.strip()]
    doc.close()

    valores: dict[str, float] = {}
    campo_aberto: str | None = None
    lidos = 0
    for linha in linhas:
        if (r := _rotulo(linha)) is not None:
            campo_aberto, lidos = CAMPOS[r], 0
            continue
        if campo_aberto is None:
            continue
        if (m := RE_EUROS.search(linha)) is None:
            # Uma linha sem valor fecha a rubrica: é o caso do "Saldo total",
            # que o documento imprime sem números.
            campo_aberto = None
            continue
        if lidos == 0:
            # Só a 1.ª coluna é o orçamento do ano; as outras são o plano
            # plurianual e projeções, e não são orçamento aprovado.
            valores[campo_aberto] = _euros(m.group(1))
        lidos += 1
    return valores


def _populacao() -> dict[int, int]:
    caminho = PROCESSED / "populacao.json"
    if not caminho.exists():
        return {}
    d = json.loads(caminho.read_text(encoding="utf-8"))
    return {
        p["ano"]: p["total"]
        for p in d["populacao_por_ano"]
        if p.get("total") is not None
    }


def construir() -> int:
    rel = Relatorio()
    avisos: list[str] = []

    raws = _raw_por_fonte()
    anos = sorted(
        (int(m.group(1)), fid)
        for fid in raws
        if (m := re.fullmatch(r"S08-(\d{4})", fid))
    )
    if not anos:
        print(
            "Nenhum documento previsional em data/raw/. Corre `make fetch`.",
            file=sys.stderr,
        )
        return 1

    validos = mod_fontes.ids_validos()
    populacao = _populacao()
    exercicios: list[dict] = []
    sem_texto: list[int] = []

    for ano, fonte_id in anos:
        if fonte_id not in validos:  # V6
            print(f"V6: fonte_id {fonte_id} não resolve em fontes.json", file=sys.stderr)
            return 1

        valores = extrair_resumo(raws[fonte_id])
        if not valores:
            sem_texto.append(ano)
            continue

        # V2: o orçamento municipal é equilibrado por lei.
        try:
            v2_orcamento_equilibrado(valores["receita_total"], valores["despesa_total"])
            rel.ok.append(f"V2-{ano}")
        except (ValidationError, KeyError) as exc:
            rel.falhas.append(f"V2-{ano}: {exc}")
            continue

        # V1 em quatro formas: as parcelas têm de reconstituir cada total.
        somas = (
            ("receita_efetiva", "receita_corrente", "receita_capital"),
            ("receita_total", "receita_efetiva", "receita_nao_efetiva"),
            ("despesa_efetiva", "despesa_corrente", "despesa_capital"),
            ("despesa_total", "despesa_efetiva", "despesa_nao_efetiva"),
        )
        for total, a, b in somas:
            if total in valores and a in valores and b in valores:
                rel.check(
                    f"V1-{ano}-{total}",
                    abs(valores[a] + valores[b] - valores[total]) <= 0.01,
                    f"{a} + {b} != {total} em {ano}",
                )

        hab = populacao.get(ano)
        exercicios.append(
            {
                "ano_referencia": ano,
                "tipo": "previsto",
                **valores,
                # Sem população do ano não se inventa o denominador (L21).
                "habitantes": hab,
                "despesa_total_por_habitante": (
                    round(valores["despesa_total"] / hab, 2) if hab else None
                ),
                "receita_total_por_habitante": (
                    round(valores["receita_total"] / hab, 2) if hab else None
                ),
                "fonte_id": fonte_id,
            }
        )

    rel.check("exercicios-nao-vazio", bool(exercicios), "nenhum ano foi extraído")

    if sem_texto:
        avisos.append(
            "Sem mapa-resumo em texto (documento digitalizado), por isso sem "
            f"orçamento: {', '.join(str(a) for a in sem_texto)}. Exige OCR — ver L25."
        )
    if faltam := [e["ano_referencia"] for e in exercicios if e["habitantes"] is None]:
        avisos.append(
            "Sem população para "
            + ", ".join(str(a) for a in faltam)
            + ": os valores por habitante ficam a `null` (L21), não são estimados."
        )

    if not rel.passou:
        print("Validações falhadas — nada foi escrito:", file=sys.stderr)
        for f in rel.falhas:
            print(f"  {f}", file=sys.stderr)
        return 1

    saida = {
        "_meta": {
            "gerado_em": datetime.now(timezone.utc).isoformat(),
            "script": "etl/orcamento.py",
            "versao_modelo": VERSAO_MODELO,
            "fontes": [f for _, f in anos],
            "avisos": avisos,
            "nota": (
                "Valores PREVISTOS (orçamento aprovado), não executados. A "
                "execução real vem dos Relatórios e Contas, por extrair."
            ),
        },
        "primeiro_ano": exercicios[0]["ano_referencia"],
        "ultimo_ano": exercicios[-1]["ano_referencia"],
        "exercicios": exercicios,
    }
    destino = PROCESSED / "orcamento.json"
    destino.write_text(
        json.dumps(saida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Escrito {destino}")
    for e in exercicios:
        pc = e["despesa_total_por_habitante"]
        total = f"{e['despesa_total']:,.2f}".replace(",", " ").replace(".", ",")
        print(
            f"  {e['ano_referencia']}: despesa {total} €"
            + (f" — {pc:.2f} €/habitante" if pc else " — sem população")
        )
    print(f"\nValidações passadas: {len(rel.ok)} (inclui V2 em todos os anos)")
    for a in avisos:
        print(f"aviso: {a}")
    return 0


if __name__ == "__main__":
    raise SystemExit(construir())
