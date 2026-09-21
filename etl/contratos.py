#!/usr/bin/env python3
"""Secção 8 do dashboard — "Contratos públicos".

Produz `contratos_<ano>.json` a partir do dataset nacional do Portal BASE
(IMPIC), publicado semanalmente no dados.gov (S23-<ano>).

**O filtro é por NIF, nunca por nome.** Procurar "Guimarães" na coluna do
adjudicante no ficheiro de 2024 devolve 33 entidades distintas, entre elas o
Hospital da Senhora da Oliveira, treze agrupamentos de escolas e o Tribunal da
Relação — nenhum dos quais é do município. Pelo contrário, a Vimágua aparece
com quatro grafias diferentes do mesmo nome, todas com o mesmo NIF.

Os NIF do perímetro vêm de `empresas_municipais.json` (S11); o do próprio
Município é resolvido do dataset e validado como único.

    python -m etl.contratos            # todos os anos descobertos
    python -m etl.contratos --ano 2024
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from datetime import date, datetime, timezone
from pathlib import Path

import openpyxl

from etl.common import fontes as mod_fontes
from etl.common.fetch import absoluto
from etl.common.paths import PROCESSED, RAW
from etl.common.validate import Relatorio, ValidationError, v4_soma_por_adjudicatario

VERSAO_MODELO = "1.0"

# O nome do Município tal como o BASE o escreve. Serve só para *descobrir* o
# NIF uma vez; a partir daí o filtro é sempre numérico.
NOME_MUNICIPIO = "municipio de guimaraes"

# Colunas do dataset (ver cabeçalho do XLSX).
C_ID, C_TIPO_CONTRATO, C_TIPO_PROC = 0, 4, 6
C_OBJETO, C_DESC, C_ADJUDICANTE, C_ADJUDICATARIOS = 7, 8, 9, 10
C_DATA_PUB, C_DATA_CELEB, C_PRECO, C_CPV, C_PRAZO, C_LOCAL = 11, 12, 13, 14, 15, 16
C_FUNDAMENTACAO, C_PRECO_BASE, C_PRECO_EFETIVO, C_ANO = 17, 21, 24, 34

RE_ENTIDADE = re.compile(r"^\s*(\d{9})\s*-\s*(.+?)\s*$")
# Quando o adjudicatário não tem NIF coletivo, o BASE escreve `- - Nome`.
RE_ENTIDADE_SEM_NIF = re.compile(r"^\s*-\s*-\s*(.+?)\s*$")

# Um NIF português de pessoa singular começa por 1, 2, 3 ou 4. Adjudicatários
# podem ser empresários em nome individual: nesses casos o NIF é pessoal e
# **não é publicado** (regra 7). Fica o nome, que o BASE já divulga.
PREFIXOS_COLETIVOS = ("5", "6", "7", "8", "9")

# Ligação ao registo no Portal BASE. O padrão é o dos *deep links* do portal,
# mas a página é renderizada no cliente e não foi possível confirmar que o id
# resolve para o contrato certo (L18) — está declarado nos avisos do ficheiro.
URL_BASE = "https://www.base.gov.pt/Base4/pt/detalhe/?type=contratos&id={}"


def _sem_acentos(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", _sem_acentos(str(s)).lower()).strip()


def _snake(s: str | None) -> str | None:
    """`Ajuste Direto Regime Geral` → `ajuste_direto_regime_geral` (convenção)."""
    if not s:
        return None
    return re.sub(r"[^a-z0-9]+", "_", _sem_acentos(str(s)).lower()).strip("_") or None


def _data(v) -> str | None:
    if isinstance(v, (datetime, date)):
        return v.date().isoformat() if isinstance(v, datetime) else v.isoformat()
    if isinstance(v, str) and (m := re.match(r"(\d{4}-\d{2}-\d{2})", v)):
        return m.group(1)
    return None


def _euros(v) -> float | None:
    """Valor monetário em euros com 2 casas. Ausente → None, nunca 0."""
    if v is None or v == "":
        return None
    try:
        return round(float(v), 2)
    except (TypeError, ValueError):
        return None


def _preco_efetivo(v) -> float | None:
    """`PrecoTotalEfetivo` do BASE, com o zero-marcador convertido em `null`.

    O BASE escreve 0 neste campo enquanto o contrato não é fechado. Não é um
    valor: em 2023, 435 dos 519 contratos vinham a 0 **tendo preço contratual
    positivo** — um contrato de 32 995 € não tem execução de zero euros.

    Publicar esse 0 dava a entender que o município gastou nada. A regra do
    projeto é explícita: `null` é "não sabemos", e é diferente de "zero euros".
    Os zeros de `valor` e `preco_base` são raros (9 e 32 no conjunto dos oito
    anos) e não têm este padrão, por isso ficam como a fonte os dá.
    """
    preco = _euros(v)
    return None if preco == 0 else preco


def _texto(v) -> str | None:
    """Campo de texto do dataset, normalizado para `str` ou `None`.

    Não é defensivismo gratuito: em 2019 a descrição de dois contratos vem do
    BASE como data (o Excel interpretou o texto como tal na origem). Passar a
    célula em cru rebentava a serialização para JSON. O valor da fonte é
    preservado tal como lá está, em ISO — não é corrigido nem descartado.
    """
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v.isoformat(sep=" ")
    if isinstance(v, date):
        return v.isoformat()
    return str(v)


def _inteiro(v) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _entidades(bruto) -> list[dict]:
    """`513365800 - Nome` (uma ou várias, separadas por quebra de linha)."""
    if not bruto:
        return []
    out = []
    for parte in re.split(r"[\n\r]+|\s\|\s", str(bruto)):
        parte = parte.strip()
        if not parte:
            continue
        if m := RE_ENTIDADE.match(parte):
            nif, nome = m.group(1), m.group(2)
            out.append(
                {
                    # Só NIF de pessoa coletiva (regra 7).
                    "nif": nif if nif.startswith(PREFIXOS_COLETIVOS) else None,
                    "nome": nome,
                }
            )
        elif m := RE_ENTIDADE_SEM_NIF.match(parte):
            out.append({"nif": None, "nome": m.group(1)})
        else:
            out.append({"nif": None, "nome": parte})
    return out


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


def nifs_do_perimetro() -> tuple[dict[str, str], list[str]]:
    """{nif: nome} das entidades do perímetro de consolidação (S11)."""
    caminho = PROCESSED / "empresas_municipais.json"
    if not caminho.exists():
        raise FileNotFoundError(
            "Falta data/processed/empresas_municipais.json. "
            "Corre `make empresas` primeiro — é ele que resolve os NIF."
        )
    d = json.loads(caminho.read_text(encoding="utf-8"))
    nifs, sem_nif = {}, []
    for e in d["entidades"]:
        if not e.get("no_perimetro_consolidacao"):
            continue
        if e.get("nif"):
            nifs[e["nif"]] = e["nome"]
        else:
            sem_nif.append(e["nome"])
    return nifs, sem_nif


def processar_ano(
    caminho: Path, ano: int, nifs: dict[str, str], fonte_id: str
) -> tuple[list[dict], dict]:
    """Filtra o dataset nacional e devolve (contratos, diagnóstico)."""
    wb = openpyxl.load_workbook(caminho, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    it = ws.iter_rows(values_only=True)
    next(it)  # cabeçalho

    contratos: list[dict] = []
    nifs_municipio: set[str] = set()
    total_linhas = 0

    for linha in it:
        total_linhas += 1
        bruto = linha[C_ADJUDICANTE]
        if not bruto:
            continue
        m = RE_ENTIDADE.match(str(bruto))
        if not m:
            continue
        nif, nome = m.group(1), m.group(2)

        e_municipio = _norm(nome) == NOME_MUNICIPIO
        if e_municipio:
            nifs_municipio.add(nif)
        elif nif not in nifs:
            continue

        adjudicatarios = _entidades(linha[C_ADJUDICATARIOS])
        id_base = linha[C_ID]
        contratos.append(
            {
                "id_base": str(id_base) if id_base is not None else None,
                "objeto": _texto(linha[C_OBJETO]),
                "descricao": _texto(linha[C_DESC]),
                "tipo_contrato": _snake(linha[C_TIPO_CONTRATO]),
                "tipo_procedimento": _snake(linha[C_TIPO_PROC]),
                "adjudicante_nif": nif,
                "adjudicante": nome,
                "adjudicante_municipio": e_municipio,
                "adjudicatarios": adjudicatarios,
                "valor": _euros(linha[C_PRECO]),
                "preco_base": _euros(linha[C_PRECO_BASE]),
                "preco_total_efetivo": _preco_efetivo(linha[C_PRECO_EFETIVO]),
                "data_publicacao": _data(linha[C_DATA_PUB]),
                "data_celebracao": _data(linha[C_DATA_CELEB]),
                "prazo_execucao_dias": _inteiro(linha[C_PRAZO]),
                "cpv": _texto(linha[C_CPV]),
                "local_execucao": _texto(linha[C_LOCAL]),
                "fundamentacao": _texto(linha[C_FUNDAMENTACAO]),
                "url_base": URL_BASE.format(id_base) if id_base is not None else None,
                "fonte_id": fonte_id,
            }
        )

    wb.close()
    return contratos, {"linhas_lidas": total_linhas, "nifs_municipio": nifs_municipio}


def escrever(ano: int, contratos: list[dict], avisos: list[str], fonte_id: str) -> Path:
    total = sum(c["valor"] for c in contratos if c["valor"] is not None)
    sem_valor = sum(1 for c in contratos if c["valor"] is None)
    saida = {
        "_meta": {
            "gerado_em": datetime.now(timezone.utc).isoformat(),
            "script": "etl/contratos.py",
            "versao_modelo": VERSAO_MODELO,
            "fontes": [fonte_id],
            "avisos": avisos,
        },
        "ano_referencia": ano,
        "total_contratos": len(contratos),
        "valor_total": round(total, 2) if contratos else None,
        "contratos_sem_valor": sem_valor,
        "contratos": contratos,
    }
    destino = PROCESSED / f"contratos_{ano}.json"
    destino.write_text(
        json.dumps(saida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return destino


def construir(anos: list[int] | None = None) -> int:
    rel = Relatorio()
    try:
        nifs, sem_nif = nifs_do_perimetro()
    except FileNotFoundError as exc:
        print(exc, file=sys.stderr)
        return 1

    raws = _raw_por_fonte()
    disponiveis = sorted(
        (int(m.group(1)), fid)
        for fid in raws
        if (m := re.fullmatch(r"S23-(\d{4})", fid))
    )
    if anos:
        disponiveis = [(a, f) for a, f in disponiveis if a in anos]
    if not disponiveis:
        print(
            "Nenhum ficheiro de contratos em data/raw/. Corre `make fetch`.",
            file=sys.stderr,
        )
        return 1

    validos = mod_fontes.ids_validos()
    falhou = False

    for ano, fonte_id in disponiveis:
        if fonte_id not in validos:  # V6
            print(f"V6: fonte_id {fonte_id} não resolve em fontes.json", file=sys.stderr)
            return 1

        contratos, diag = processar_ano(raws[fonte_id], ano, nifs, fonte_id)
        avisos: list[str] = []

        # O Município tem de ter exatamente um NIF no dataset.
        n_mun = diag["nifs_municipio"]
        if len(n_mun) > 1:
            rel.check(
                f"nif-municipio-unico-{ano}",
                False,
                f"o dataset traz {len(n_mun)} NIF para o Município: {sorted(n_mun)}",
            )
            falhou = True
            continue
        if not n_mun:
            avisos.append(
                f"O dataset de {ano} não traz nenhum contrato em que o Município "
                "seja adjudicante. Só entidades do perímetro."
            )

        # V4: a soma por adjudicatário tem de reconstituir o total.
        total = sum(c["valor"] for c in contratos if c["valor"] is not None)
        por_adj: dict[str, float] = {}
        for c in contratos:
            if c["valor"] is None:
                continue
            chave = (c["adjudicatarios"][0]["nome"] if c["adjudicatarios"] else "—")
            por_adj[chave] = por_adj.get(chave, 0.0) + c["valor"]
        try:
            v4_soma_por_adjudicatario(por_adj, total)
            rel.ok.append(f"V4-{ano}")
        except ValidationError as exc:
            rel.falhas.append(str(exc))
            falhou = True
            continue

        if sem_nif:
            avisos.append(
                "Entidades no perímetro sem NIPC na fonte, logo não filtráveis: "
                + ", ".join(sem_nif)
            )
        if (n := sum(1 for c in contratos if c["valor"] is None)):
            avisos.append(
                f"{n} contrato(s) sem preço contratual na fonte. Ficam a `null` e "
                "não entram no total."
            )
        if (ne := sum(1 for c in contratos if c["preco_total_efetivo"] is None)):
            avisos.append(
                f"{ne} de {len(contratos)} contrato(s) sem preço total efetivo. O "
                "BASE publica 0 enquanto o contrato não é fechado; esse 0 é "
                "convertido em `null` porque não significa zero euros."
            )
        avisos.append(
            "`url_base` segue o padrão de ligação do Portal BASE, mas a página é "
            "renderizada no cliente e não foi possível confirmar que o id resolve "
            "para o contrato certo (ver docs/qualidade_dados.md §L18)."
        )

        destino = escrever(ano, contratos, avisos, fonte_id)
        mun = sum(1 for c in contratos if c["adjudicante_municipio"])
        # Formatação portuguesa só para o ecrã; nos dados o valor fica em number.
        valor = f"{total:,.2f}".replace(",", " ").replace(".", ",")
        print(
            f"{ano}: {len(contratos):5} contratos "
            f"({mun} do Município, {len(contratos) - mun} das participadas) "
            f"— {valor} € — {destino.name}"
        )

    if falhou:
        print("\nValidações falhadas:", file=sys.stderr)
        for f in rel.falhas:
            print(f"  {f}", file=sys.stderr)
        return 1

    print(f"\nValidações passadas: {', '.join(rel.ok)}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--ano", type=int, action="append", help="restringe a este ano")
    args = ap.parse_args()
    return construir(args.ano)


if __name__ == "__main__":
    raise SystemExit(main())
