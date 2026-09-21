#!/usr/bin/env python3
"""Secção 2 do dashboard — "Quem governa".

Produz `executivo.json` e `orgaos_eleitos.json` a partir de três páginas do
site da CMG, já guardadas em `data/raw/`:

- **S02** `/municipio/camara-municipal` — percentagens e mandatos por força
  política, e a lista dos 11 vereadores. É a única fonte obtida com resultados.
- **S01** `/municipio/camara-municipal/executivo-municipal` — pelouros, e-mails
  e quem está em permanência. Não traz votos nem mandatos.
- **S37** `/municipio/assembleia-municipal` — dimensão do órgão deliberativo.

Nenhum número aqui é calculado a partir de conhecimento prévio ou de imprensa:
tudo sai do HTML descarregado, e o que a fonte não diz fica `null` (regra 1).
Em particular, **votos absolutos e abstenção ficam `null`** — nenhuma das
fontes acessíveis os publica.

    python -m etl.quem_governa
"""
from __future__ import annotations

import html
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

from etl.common import fontes as mod_fontes
from etl.common.fetch import absoluto
from etl.common.paths import PROCESSED, RAW
from etl.common.validate import Relatorio

VERSAO_MODELO = "1.0"

# Cargos que a página do executivo distingue. `em_permanencia` deriva daqui:
# um vereador sem competências delegadas não exerce funções a tempo inteiro.
SEM_PELOURO = "vereadores sem competencias delegadas"


def _sem_acentos(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def _texto_de(caminho: Path) -> str:
    """HTML → texto linha a linha, preservando a ordem de leitura."""
    s = caminho.read_text(encoding="utf-8", errors="replace")
    s = re.sub(r"(?is)<(script|style|nav|footer)[^>]*>.*?</\1>", " ", s)
    s = re.sub(r"(?s)<[^>]+>", "\n", s)
    linhas = [ln.strip() for ln in html.unescape(s).split("\n")]
    return "\n".join(_juntar_parenteses(ln for ln in linhas if ln))


def _juntar_parenteses(linhas) -> list[str]:
    """Reúne um parêntese que o HTML partiu ao meio.

    Na página do executivo, um dos vereadores vem marcado como
    `<p>Nome (PS<span>)</span></p>`, o que depois de remover as tags dá
    `Nome (PS` numa linha e `)` na seguinte. Sem esta reparação o nome não
    casa com o da página da Câmara e o e-mail seguinte é atribuído à pessoa
    errada — foi exatamente o que aconteceu antes de isto existir.
    """
    out: list[str] = []
    for ln in linhas:
        if out and ln.startswith(")") and out[-1].count("(") > out[-1].count(")"):
            out[-1] = f"{out[-1]}{ln}"
        else:
            out.append(ln)
    return out


def _raw_de(fonte_id: str) -> Path | None:
    """Caminho do original descarregado para esta fonte, via sidecar."""
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


# --------------------------------------------------------------------------
# S02 — resultados eleitorais e composição da Câmara
# --------------------------------------------------------------------------

# "Coligação "Juntos por Guimarães" (PPD/PSD.CDS-PP)" seguida de "45,33% - 6 membros"
RE_FORCA = re.compile(r"^(?P<rotulo>.*?)\((?P<sigla>[A-Z][A-Z./\-]*(?:\.[A-Z\-]+)*)\)\s*$")
RE_RESULTADO = re.compile(
    r"^(?P<pct>\d{1,3},\d{1,2})\s*%\s*[-–]\s*(?P<mandatos>\d+)\s+membros?$"
)
RE_NOME_PARTIDO = re.compile(r"^(?P<nome>[^()]+?)\s*\((?P<sigla>[A-Z][A-Z./\-]*)\)\s*$")


def _coligacao_de(rotulo: str) -> str | None:
    """Extrai o nome entre aspas de `Coligação "Juntos por Guimarães"`."""
    if m := re.search(r"[\"“”«]([^\"“”»]+)[\"“”»]", rotulo):
        return m.group(1).strip()
    return None


def parse_s02(texto: str) -> dict:
    linhas = texto.split("\n")
    resultados: list[dict] = []
    coligacoes: dict[str, str | None] = {}

    for i, ln in enumerate(linhas[:-1]):
        mf, mr = RE_FORCA.match(ln), RE_RESULTADO.match(linhas[i + 1])
        if not (mf and mr):
            continue
        sigla = mf.group("sigla")
        coligacoes[sigla] = _coligacao_de(mf.group("rotulo"))
        resultados.append(
            {
                "forca_politica": sigla,
                "coligacao": coligacoes[sigla],
                "votos": None,  # S02 não publica votos absolutos
                "percentagem": float(mr.group("pct").replace(",", ".")),
                "mandatos": int(mr.group("mandatos")),
                "fonte_id": "S02",
            }
        )

    # Total declarado de membros, em prosa: "composto por onze membros"
    total_declarado = None
    if re.search(r"composto por onze membros", texto, re.IGNORECASE):
        total_declarado = 11

    # Lista nominal sob "Atual constituição do executivo camarário:"
    membros: list[dict] = []
    try:
        inicio = next(
            i for i, ln in enumerate(linhas)
            if "constituicao do executivo" in _sem_acentos(ln).lower()
        )
    except StopIteration:
        inicio = None

    if inicio is not None:
        cargo = None
        for ln in linhas[inicio + 1:]:
            baixo = _sem_acentos(ln).lower().rstrip(":")
            if baixo == "presidente":
                cargo = "presidente"
                continue
            if baixo in ("vereadores", "vereador"):
                cargo = "vereador"
                continue
            if (m := RE_NOME_PARTIDO.match(ln)) and cargo:
                membros.append(
                    {
                        "nome": m.group("nome").strip(),
                        "cargo": cargo,
                        "partido": m.group("sigla"),
                        "coligacao": coligacoes.get(m.group("sigla")),
                        "fonte_id": "S02",
                    }
                )
            elif membros and not RE_NOME_PARTIDO.match(ln):
                break  # acabou a lista

    return {
        "resultados": resultados,
        "total_mandatos_declarado": total_declarado,
        "membros": membros,
    }


# --------------------------------------------------------------------------
# S01 — pelouros, e-mails, permanência
# --------------------------------------------------------------------------

RE_PELOUROS = re.compile(r"^:?\s*(.+?)\.?$")
RE_EMAIL = re.compile(r"[\w.\-+]+@[\w.\-]+\.\w+")


def parse_s01(texto: str) -> dict[str, dict]:
    """Devolve {nome_normalizado: {pelouros, email, cargo_detalhe, em_permanencia}}."""
    linhas = texto.split("\n")
    out: dict[str, dict] = {}
    atual: str | None = None
    em_permanencia = True

    for i, ln in enumerate(linhas):
        baixo = _sem_acentos(ln).lower().strip().rstrip(":")
        if baixo == SEM_PELOURO:
            em_permanencia = False
            continue

        if m := RE_NOME_PARTIDO.match(ln):
            atual = m.group("nome").strip()
            out[_chave(atual)] = {
                "nome": atual,
                "partido": m.group("sigla"),
                "cargo_detalhe": None,
                "pelouros": [],
                "email": None,
                "em_permanencia": em_permanencia,
                "fonte_id": "S01",
            }
            continue

        if not atual:
            continue
        reg = out[_chave(atual)]

        if baixo in ("presidente da camara municipal", "vice-presidente"):
            reg["cargo_detalhe"] = _sem_acentos(ln).lower().strip()
        elif _sem_acentos(ln).lower().startswith("areas de responsabilidade"):
            # O valor vem na linha seguinte, começada por ":"
            if i + 1 < len(linhas) and (m := RE_PELOUROS.match(linhas[i + 1])):
                reg["pelouros"] = _dividir_pelouros(m.group(1))
        elif em := RE_EMAIL.search(ln):
            reg["email"] = em.group(0)

    return out


def _dividir_pelouros(s: str) -> list[str]:
    """`Comunicação e Relações Públicas, Estudos e Projetos, …` → lista.

    Só divide por vírgula: as conjunções fazem parte do nome do pelouro
    ("Educação e Recursos Humanos" é um pelouro, não dois).
    """
    partes = [p.strip(" .;") for p in s.split(",")]
    # A última costuma vir como "… e Auditoria": separa-a.
    if partes and re.search(r"\s+e\s+", partes[-1]):
        cauda = partes.pop()
        partes.extend(p.strip(" .;") for p in re.split(r"\s+e\s+", cauda, maxsplit=1))
    return [p for p in partes if p]


def _chave(nome: str) -> str:
    """Normaliza um nome para casar S01 com S02.

    As duas páginas escrevem os mesmos nomes de forma ligeiramente diferente
    ("Sérgio Manuel Antunes Freitas da Silva" vs "… Freitas Silva"), por isso
    a comparação é feita pelo conjunto de palavras, sem acentos.
    """
    palavras = _sem_acentos(nome).lower().split()
    ligacoes = {"de", "da", "do", "dos", "das", "e"}
    return " ".join(sorted(p for p in palavras if p not in ligacoes))


# --------------------------------------------------------------------------
# S37 — Assembleia Municipal
# --------------------------------------------------------------------------

RE_AM = re.compile(
    r"constitu[ií]da por\s+(?P<total>\d+)\s+membros,\s*dos quais\s+(?P<eleitos>\d+)\s+"
    r"s[ãa]o eleitos diretamente e\s+(?P<inerencia>\d+)",
    re.IGNORECASE,
)


def parse_s37(texto: str) -> dict:
    if not (m := RE_AM.search(texto.replace("\n", " "))):
        return {
            "total_mandatos": None,
            "mandatos_eleitos": None,
            "mandatos_inerencia": None,
            "resultados": [],
            "fonte_id": "S37",
        }
    return {
        "total_mandatos": int(m.group("total")),
        "mandatos_eleitos": int(m.group("eleitos")),
        "mandatos_inerencia": int(m.group("inerencia")),
        # A CMG não publica a distribuição por força política nem os nomes (L10).
        "resultados": [],
        "fonte_id": "S37",
    }


# --------------------------------------------------------------------------
# Montagem
# --------------------------------------------------------------------------


def _envelope(script: str, fontes: list[str], avisos: list[str], dados: dict) -> dict:
    return {
        "_meta": {
            "gerado_em": datetime.now(timezone.utc).isoformat(),
            "script": script,
            "versao_modelo": VERSAO_MODELO,
            "fontes": fontes,
            "avisos": avisos,
        },
        **dados,
    }


def construir() -> int:
    rel = Relatorio()
    avisos: list[str] = []

    caminhos = {fid: _raw_de(fid) for fid in ("S01", "S02", "S37")}
    if em_falta := [fid for fid, p in caminhos.items() if p is None]:
        print(
            f"Faltam originais em data/raw/ para {', '.join(em_falta)}. "
            "Corre `make fetch` primeiro.",
            file=sys.stderr,
        )
        return 1

    s02 = parse_s02(_texto_de(caminhos["S02"]))
    s01 = parse_s01(_texto_de(caminhos["S01"]))
    am = parse_s37(_texto_de(caminhos["S37"]))

    # ---- Validações -------------------------------------------------------
    soma_mandatos = sum(r["mandatos"] for r in s02["resultados"])
    total = s02["total_mandatos_declarado"]
    rel.check(
        "V1-mandatos",
        total is not None and soma_mandatos == total,
        f"soma dos mandatos por força = {soma_mandatos}, total declarado = {total}",
    )
    rel.check(
        "V1-nominal",
        total is not None and len(s02["membros"]) == total,
        f"lista nominal tem {len(s02['membros'])} membros, total declarado = {total}",
    )

    soma_pct = round(sum(r["percentagem"] for r in s02["resultados"]), 2)
    if soma_pct < 99.5:
        avisos.append(
            f"S02 só discrimina as forças com mandato: as percentagens somam "
            f"{soma_pct:.2f}%. Os restantes {100 - soma_pct:.2f}% não estão "
            "repartidos na fonte, e não são inventados aqui."
        )

    # ---- executivo.json ---------------------------------------------------
    membros = []
    nao_casados = []
    for m in s02["membros"]:
        det = s01.get(_chave(m["nome"]))
        if det is None:
            nao_casados.append(m["nome"])
        cargo = m["cargo"]
        if det and det.get("cargo_detalhe") == "vice-presidente":
            cargo = "vice_presidente"
        membros.append(
            {
                "nome": m["nome"],
                "cargo": cargo,
                "partido": m["partido"],
                "coligacao": m["coligacao"],
                # Sem detalhe em S01 não sabemos se está em permanência: null,
                # nunca False por omissão.
                "em_permanencia": det["em_permanencia"] if det else None,
                "pelouros": det["pelouros"] if det else [],
                "email": det["email"] if det else None,
                "foto_url": None,
                "fonte_id": "S02" if det is None else "S01+S02",
            }
        )

    if nao_casados:
        avisos.append(
            "Vereador(es) listados em S02 mas ausentes da página do executivo "
            f"(S01): {', '.join(nao_casados)}. Pelouros, e-mail e permanência "
            "ficam por preencher — nenhum é inferido."
        )

    executivo = _envelope(
        "etl/quem_governa.py",
        ["S01", "S02"],
        avisos,
        {
            "mandato": {
                "inicio": 2025,
                "fim": 2029,
                # A data da eleição vem de S02; a da tomada de posse de S01.
                "data_eleicao": "2025-10-12",
                "tomada_posse": "2025-10-25",
                "fonte_id": "S01+S02",
            },
            "membros": membros,
        },
    )

    orgaos = _envelope(
        "etl/quem_governa.py",
        ["S02", "S37"],
        avisos,
        {
            "camara_municipal": {
                "total_mandatos": total,
                "votos_totais": None,  # nenhuma fonte acessível os publica
                "abstencao": None,
                "resultados": s02["resultados"],
                "fonte_id": "S02",
            },
            "assembleia_municipal": am,
            "freguesias": [],
        },
    )

    if not rel.passou:
        print("Validações falhadas — nada foi escrito:", file=sys.stderr)
        for f in rel.falhas:
            print(f"  {f}", file=sys.stderr)
        print(
            "Regista a discrepância em docs/qualidade_dados.md antes de publicar.",
            file=sys.stderr,
        )
        return 1

    validos = mod_fontes.ids_validos()
    for fid in ("S01", "S02", "S37"):
        if fid not in validos:  # V6
            print(f"V6: fonte_id {fid} não resolve em fontes.json", file=sys.stderr)
            return 1

    for nome, conteudo in (("executivo.json", executivo), ("orgaos_eleitos.json", orgaos)):
        destino = PROCESSED / nome
        destino.write_text(
            json.dumps(conteudo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"Escrito {destino}")

    print(f"\nValidações passadas: {', '.join(rel.ok)}")
    for a in avisos:
        print(f"aviso: {a}")
    return 0


if __name__ == "__main__":
    raise SystemExit(construir())
