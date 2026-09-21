#!/usr/bin/env python3
"""Secção 10 do dashboard — "Equipamentos municipais".

Produz `equipamentos.json` a partir das fichas de ponto de interesse que a CMG
publica (`S20-poi-*`), descobertas a partir de três listagens.

Duas coisas que mudam o desenho desta secção:

1. **As coordenadas vêm na origem.** Cada ficha traz `data-lat`/`data-long`,
   por isso não há geocodificação, não há Nominatim e a validação V8 — "% de
   equipamentos com coordenadas" — deixa de fazer sentido como risco. O que
   bloqueia em vez dela é uma coordenada implausível, que poria o equipamento
   no sítio errado do mapa. Estar fora do *concelho* não bloqueia: a Câmara
   lista o IPDJ de Braga, a 20 km, como contacto de apoio à juventude. É uma
   ficha legítima, fica marcada com `no_concelho: false` e não enquadra o mapa.
2. **Nem todos são do município.** A CMG publica duas listas separadas,
   "equipamentos culturais municipais" e "não municipais". A distinção vem da
   fonte e sobrevive até ao dashboard: juntá-las seria atribuir à Câmara
   equipamentos que não são seus.

As instalações desportivas **não estão aqui** — são geridas pela Tempo Livre,
cooperativa, e o sítio do município não as lista (L29).

    python -m etl.equipamentos
"""
from __future__ import annotations

import html
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from etl.common import fontes as mod_fontes
from etl.common.fetch import absoluto
from etl.common.paths import PROCESSED, RAW
from etl.common.validate import Relatorio

VERSAO_MODELO = "1.0"

# Caixa do concelho de Guimarães, com folga nas bordas. Serve dois fins:
# apanhar uma coordenada com o sinal trocado, e marcar as fichas que apontam
# para fora do concelho — a CMG lista o IPDJ de Braga, a 20 km, como contacto
# de apoio à juventude. É uma ficha legítima, não um erro; mas não é um
# equipamento do município e não pode enquadrar o mapa.
CAIXA_CONCELHO = {"lat": (41.36, 41.53), "lon": (-8.42, -8.18)}

# Muito mais larga: fora disto é erro de coordenada, não um vizinho.
CAIXA_PLAUSIVEL = {"lat": (41.0, 42.0), "lon": (-9.0, -7.5)}

# A listagem de onde cada ficha veio decide se o equipamento é do município.
PROPRIEDADE = {
    "S20-cultura-municipais": (True, "cultura"),
    "S20-cultura-municipais-p2": (True, "cultura"),
    "S20-cultura-nao-municipais": (False, "cultura"),
    "S20-espacos-juventude": (True, "juventude"),
}

RE_NOME = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S)
RE_COORD = re.compile(r'data-lat="([^"]+)"\s*data-long="([^"]+)"')
RE_CATEGORIAS = re.compile(
    r'class="categories_list[^"]*"><div class="widget_value">(.*?)</div></div>', re.S
)
RE_MORADA = re.compile(r'class="address[^"]*">(.*?)</div></div></div>', re.S)
RE_TELEFONE = re.compile(r'class="telephone[^"]*"><div class="widget_value">(.*?)</div>', re.S)
RE_EMAIL = re.compile(r'class="email[^"]*"><div class="widget_value">(.*?)</div>', re.S)
RE_SITE = re.compile(r'class="website[^"]*"><div class="widget_value">(.*?)</div>', re.S)


def _texto(bruto: str | None) -> str | None:
    """Tira as tags, desescapa e normaliza espaços. Vazio → None."""
    if not bruto:
        return None
    # Os parágrafos da morada têm de virar separadores, não colar palavras.
    t = re.sub(r"</p>\s*<p>", ", ", bruto)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    t = re.sub(r"\s+", " ", t).strip(" ,;")
    return t or None


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


def extrair(caminho: Path, fonte_id: str, via: str) -> dict | None:
    s = caminho.read_text(encoding="utf-8", errors="replace")
    nome = _texto(RE_NOME.search(s).group(1)) if RE_NOME.search(s) else None
    if not nome:
        return None

    municipal, tema = PROPRIEDADE.get(via, (None, None))

    coord = RE_COORD.search(s)
    lat = lon = None
    if coord:
        try:
            lat, lon = float(coord.group(1)), float(coord.group(2))
        except ValueError:
            lat = lon = None

    categorias = []
    if (m := RE_CATEGORIAS.search(s)) is not None:
        for c in re.findall(r"<span>(.*?)</span>", m.group(1), re.S):
            if (t := _texto(c)):
                categorias.extend(x.strip() for x in t.split("|") if x.strip())

    return {
        "id": fonte_id.removeprefix("S20-poi-"),
        "nome": nome,
        "tema": tema,
        # `municipal` distingue o que é da Câmara do que não é. Nunca inferir
        # pelo nome: há equipamentos municipais com nome de associação.
        "municipal": municipal,
        "categorias": sorted(set(categorias)),
        "latitude": lat,
        "longitude": lon,
        "no_concelho": (
            None
            if lat is None
            else (
                CAIXA_CONCELHO["lat"][0] <= lat <= CAIXA_CONCELHO["lat"][1]
                and CAIXA_CONCELHO["lon"][0] <= lon <= CAIXA_CONCELHO["lon"][1]
            )
        ),
        "morada": _texto(RE_MORADA.search(s).group(1)) if RE_MORADA.search(s) else None,
        "telefone": _texto(RE_TELEFONE.search(s).group(1)) if RE_TELEFONE.search(s) else None,
        "email": _texto(RE_EMAIL.search(s).group(1)) if RE_EMAIL.search(s) else None,
        "sitio": _texto(RE_SITE.search(s).group(1)) if RE_SITE.search(s) else None,
        "fonte_id": fonte_id,
    }


def construir() -> int:
    rel = Relatorio()
    avisos: list[str] = []

    raws = _raw_por_fonte()
    derivadas = mod_fontes.carregar_todas()
    ids = sorted(f for f in raws if f.startswith("S20-poi-"))
    if not ids:
        print(
            "Nenhuma ficha de equipamento em data/raw/. Corre `make fetch`.",
            file=sys.stderr,
        )
        return 1

    validos = mod_fontes.ids_validos()
    equipamentos = []
    for fonte_id in ids:
        if fonte_id not in validos:  # V6
            print(f"V6: fonte_id {fonte_id} não resolve", file=sys.stderr)
            return 1
        via = derivadas.get(fonte_id, {}).get("descoberta_via", "")
        if (e := extrair(raws[fonte_id], fonte_id, via)) is not None:
            equipamentos.append(e)

    rel.check(
        "equipamentos-nao-vazio", len(equipamentos) >= 20, f"só {len(equipamentos)}"
    )
    rel.check(
        "propriedade-conhecida",
        all(e["municipal"] is not None for e in equipamentos),
        "há equipamentos sem saber se são do município — "
        + ", ".join(e["id"] for e in equipamentos if e["municipal"] is None),
    )

    # Substitui a V8: as coordenadas vêm da fonte, por isso o que se valida é
    # que são plausíveis. Uma coordenada fora do noroeste de Portugal é erro
    # da fonte e poria o equipamento no sítio errado do mapa — isso bloqueia.
    implausiveis = [
        e["id"]
        for e in equipamentos
        if e["latitude"] is not None
        and not (
            CAIXA_PLAUSIVEL["lat"][0] <= e["latitude"] <= CAIXA_PLAUSIVEL["lat"][1]
            and CAIXA_PLAUSIVEL["lon"][0] <= e["longitude"] <= CAIXA_PLAUSIVEL["lon"][1]
        )
    ]
    rel.check(
        "coordenadas-plausiveis",
        not implausiveis,
        f"coordenadas fora do noroeste de Portugal: {', '.join(implausiveis)}",
    )

    # Fora do concelho é outra coisa: é informação, não erro.
    fora = [e for e in equipamentos if e["no_concelho"] is False]
    if fora:
        avisos.append(
            f"{len(fora)} ficha(s) apontam para fora do concelho: "
            + ", ".join(e["nome"] for e in fora)
            + ". A Câmara lista-as como contacto útil; ficam marcadas e não "
            "enquadram o mapa."
        )

    sem_coord = [e["id"] for e in equipamentos if e["latitude"] is None]
    if sem_coord:
        avisos.append(
            f"{len(sem_coord)} equipamento(s) sem coordenadas na fonte: "
            + ", ".join(sem_coord)
            + ". Não aparecem no mapa, mas constam da lista."
        )

    if not rel.passou:
        print("Validações falhadas — nada foi escrito:", file=sys.stderr)
        for f in rel.falhas:
            print(f"  {f}", file=sys.stderr)
        return 1

    municipais = [e for e in equipamentos if e["municipal"]]
    saida = {
        "_meta": {
            "gerado_em": datetime.now(timezone.utc).isoformat(),
            "script": "etl/equipamentos.py",
            "versao_modelo": VERSAO_MODELO,
            "fontes": ids,
            "avisos": avisos,
            "nota": (
                "As instalações desportivas não constam: são geridas pela Tempo "
                "Livre, cooperativa, e o sítio do município não as lista (L29)."
            ),
        },
        "total": len(equipamentos),
        "total_municipais": len(municipais),
        "com_coordenadas": sum(1 for e in equipamentos if e["latitude"] is not None),
        "no_concelho": sum(1 for e in equipamentos if e["no_concelho"]),
        "equipamentos": sorted(equipamentos, key=lambda e: e["nome"]),
    }
    destino = PROCESSED / "equipamentos.json"
    destino.write_text(
        json.dumps(saida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Escrito {destino}")
    print(
        f"  {len(equipamentos)} equipamentos ({len(municipais)} municipais), "
        f"{saida['com_coordenadas']} com coordenadas"
    )
    print(f"\nValidações passadas: {', '.join(rel.ok)}")
    for a in avisos:
        print(f"aviso: {a}")
    return 0


if __name__ == "__main__":
    raise SystemExit(construir())
