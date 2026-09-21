#!/usr/bin/env python3
"""Secção 9 do dashboard — "Empresas e entidades participadas".

Produz `empresas_municipais.json` a partir do Quadro 1 do Relatório de Contas
Consolidadas de 2023 (S11), que é a fonte do **perímetro de consolidação**.

Duas razões para este parser vir antes do dos contratos:

1. É ele que resolve os **NIPC** das entidades participadas. Sem eles não é
   possível filtrar os contratos do BASE — e filtrar por nome não serve: uma
   procura por "Guimarães" no dataset de 2024 devolve o Hospital da Senhora da
   Oliveira, 13 agrupamentos de escolas e o Tribunal da Relação, nenhum dos
   quais é do município.
2. O campo `natureza` vem da fonte. Tratar as participadas como equivalentes
   seria factualmente errado: das que entram no perímetro, três são empresas
   (Casfig, Vitrus, Vimágua — esta intermunicipal), quatro são cooperativas
   (A Oficina, Taipas Turitermas, Turipenha, Fraterna, Tempo Livre), uma é
   fundação e outra associação.

    python -m etl.empresas_participadas
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
from etl.common.validate import Relatorio

FONTE = "S11"
ANO_REFERENCIA = 2023
VERSAO_MODELO = "1.0"

# Páginas do Quadro 1. Fixas porque o documento é um original imutável em
# data/raw/, identificado por sha256; um documento novo traz outro parser.
PAGINAS_QUADRO = (8, 9)

COL_NOME = slice(0, 3)
COL_NATUREZA = slice(3, 6)
COL_NIPC, COL_VALOR, COL_PCT, COL_INCLUIDA, COL_METODO, COL_OBS = 6, 7, 8, 9, 10, 11

RE_NIPC = re.compile(r"^\d{9}$")

# A fonte escreve a natureza em prosa. O mapeamento é explícito e conservador:
# o que não estiver aqui fica `null` e é listado nos avisos, nunca adivinhado.
NATUREZAS = {
    "empresa municipal": "empresa_municipal",
    "empresa intermunicipal": "empresa_intermunicipal",
    "cooperativa": "cooperativa",
    "regie cooperativa": "regie_cooperativa",
    "associacao sem fins lucrativos": "associacao",
    "associacao de municipios": "associacao_municipios",
    "associacao de direito privado, sem fins lucrativos": "associacao",
    "fundacao sem fins lucrativos com utilidade publica": "fundacao",
    "fundo e servico autonomo": "fundo",
}


def _sem_acentos(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def _normalizar_natureza(bruto: str) -> str | None:
    chave = re.sub(r"\s+", " ", _sem_acentos(bruto).lower()).strip(" .,")
    if chave in NATUREZAS:
        return NATUREZAS[chave]
    # Prefixo conhecido: "Pessoa coletiva publica de natureza associativa, ..."
    if chave.startswith("pessoa coletiva publica"):
        return "pessoa_coletiva_publica"
    return None


def _primeira(celulas: list[str]) -> str:
    """Primeira célula não vazia.

    As colunas do PDF estão fundidas e a mesma palavra repete-se em duas
    células adjacentes ("Taipas Turitermas, CIPRL Taipas Turitermas, CIPRL").
    Juntar tudo duplicaria o texto; a primeira não vazia é a correta.
    """
    for c in celulas:
        if c:
            return c
    return ""


def _numero_pt(s: str) -> float | None:
    """`3 506 418,00` → 3506418.0. Vazio → None (dado não disponível)."""
    s = s.replace("\xa0", " ").replace(" ", "").replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


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


def extrair_quadro(caminho: Path) -> list[dict]:
    """Lê o Quadro 1 e devolve uma entidade por linha lógica.

    O PDF parte nomes e naturezas longas por várias linhas físicas. Uma linha
    começa uma entidade nova quando traz NIPC ou a coluna "Incluída"; as
    restantes são continuações e acumulam no registo anterior.
    """
    doc = pymupdf.open(caminho)
    entidades: list[dict] = []

    for n_pag in PAGINAS_QUADRO:
        tabelas = doc[n_pag].find_tables().tables
        if not tabelas:
            continue
        for linha in tabelas[0].extract():
            cel = [(c or "").replace("\n", " ").strip() for c in linha]
            if len(cel) <= COL_OBS:
                continue
            nipc = cel[COL_NIPC]
            incluida = cel[COL_INCLUIDA].upper()

            if nipc == "NIPC":  # cabeçalho repetido em cada página
                continue

            nome_frag = _primeira(cel[COL_NOME])
            nat_frag = _primeira(cel[COL_NATUREZA])

            if RE_NIPC.match(nipc) or incluida in ("SIM", "NÃO"):
                entidades.append(
                    {
                        "nome": nome_frag,
                        "natureza_bruta": nat_frag,
                        # A fonte publica NIPC em branco para algumas entidades
                        # internacionais. `null`, nunca string vazia.
                        "nipc": nipc if RE_NIPC.match(nipc) else None,
                        "valor_subscrito": _numero_pt(cel[COL_VALOR]),
                        "participacao_pct": _numero_pt(cel[COL_PCT]),
                        "no_perimetro": incluida == "SIM" if incluida else None,
                        "metodo_consolidacao": cel[COL_METODO] or None,
                        "observacoes": cel[COL_OBS] or None,
                    }
                )
            elif entidades:  # continuação da entidade anterior
                if nome_frag:
                    entidades[-1]["nome"] = f"{entidades[-1]['nome']} {nome_frag}".strip()
                if nat_frag:
                    entidades[-1]["natureza_bruta"] = (
                        f"{entidades[-1]['natureza_bruta']} {nat_frag}".strip()
                    )

    doc.close()
    return entidades


def construir() -> int:
    rel = Relatorio()
    avisos: list[str] = []

    caminho = _raw_de(FONTE)
    if caminho is None:
        print(
            f"Falta o original de {FONTE} em data/raw/. Corre `make fetch`.",
            file=sys.stderr,
        )
        return 1

    brutas = extrair_quadro(caminho)
    rel.check("quadro-nao-vazio", bool(brutas), "o Quadro 1 não devolveu linhas")

    entidades = []
    sem_natureza = []
    for e in brutas:
        natureza = _normalizar_natureza(e["natureza_bruta"])
        if natureza is None and e["natureza_bruta"]:
            sem_natureza.append(f"{e['nome'][:40]} ({e['natureza_bruta'][:40]})")
        entidades.append(
            {
                "nome": re.sub(r"\s+", " ", e["nome"]).strip(),
                "nif": e["nipc"],
                "natureza": natureza,
                "natureza_fonte": e["natureza_bruta"] or None,
                "objeto": None,
                "valor_subscrito": e["valor_subscrito"],
                "participacao_municipio_pct": e["participacao_pct"],
                "no_perimetro_consolidacao": e["no_perimetro"],
                "metodo_consolidacao": e["metodo_consolidacao"],
                "observacoes": e["observacoes"],
                # Por extrair do corpo do relatório: exige outro passo.
                "orgaos_sociais": [],
                "trabalhadores": None,
                "financeiro_por_ano": [],
                "ano_referencia": ANO_REFERENCIA,
                "fonte_id": FONTE,
            }
        )

    if sem_natureza:
        avisos.append(
            "Natureza não normalizada (fica `null`, não é adivinhada): "
            + "; ".join(sem_natureza)
        )

    no_perimetro = [e for e in entidades if e["no_perimetro_consolidacao"]]
    rel.check(
        "perimetro-tem-nif",
        all(e["nif"] for e in no_perimetro),
        "entidade no perímetro sem NIPC: "
        + ", ".join(e["nome"] for e in no_perimetro if not e["nif"]),
    )
    rel.check(
        "perimetro-nao-vazio",
        len(no_perimetro) >= 5,
        f"só {len(no_perimetro)} entidades no perímetro — a fonte lista mais",
    )

    if FONTE not in mod_fontes.ids_validos():  # V6
        print(f"V6: fonte_id {FONTE} não resolve em fontes.json", file=sys.stderr)
        return 1

    if not rel.passou:
        print("Validações falhadas — nada foi escrito:", file=sys.stderr)
        for f in rel.falhas:
            print(f"  {f}", file=sys.stderr)
        return 1

    saida = {
        "_meta": {
            "gerado_em": datetime.now(timezone.utc).isoformat(),
            "script": "etl/empresas_participadas.py",
            "versao_modelo": VERSAO_MODELO,
            "fontes": [FONTE],
            "avisos": avisos,
        },
        "ano_referencia": ANO_REFERENCIA,
        "total_entidades": len(entidades),
        "total_no_perimetro": len(no_perimetro),
        "entidades": entidades,
    }
    destino = PROCESSED / "empresas_municipais.json"
    destino.write_text(
        json.dumps(saida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Escrito {destino}")
    print(f"  {len(entidades)} entidades, {len(no_perimetro)} no perímetro")
    print(f"\nValidações passadas: {', '.join(rel.ok)}")
    for a in avisos:
        print(f"aviso: {a}")
    return 0


if __name__ == "__main__":
    raise SystemExit(construir())
