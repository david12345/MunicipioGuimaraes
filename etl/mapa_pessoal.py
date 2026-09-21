#!/usr/bin/env python3
"""Secção 4 do dashboard — "Quem lá trabalha".

Produz `mapa_pessoal.json` a partir do Mapa de Pessoal (S07-<ano>), publicado
pela CMG nos termos do artigo 29.º da LTFP (Lei n.º 35/2014).

**Só agregados** (regra 7). Isto não é uma restrição que o parser imponha: o
mapa de pessoal não é uma lista de trabalhadores, é a lista dos *postos de
trabalho* de que o município carece, por carreira e categoria. Não há nomes no
documento e não há forma de os inferir a partir dele.

Estrutura do PDF, que condiciona todo o parser:

- Uma unidade orgânica pode ocupar **várias páginas**. O cabeçalho
  (`UNIDADE ORGÂNICA:` / `CÓDIGO UNIDADE ORGÂNICA:`) só aparece na primeira;
  as seguintes herdam-no.
- A linha `TOTAL` fecha a unidade e aparece **fora** da tabela detetada, com a
  palavra num bloco de texto e os números noutros. São reunidos pela posição
  horizontal contra as colunas da tabela.
- Na coluna da carreira, uma célula vazia significa "a mesma da linha de cima".

    python -m etl.mapa_pessoal
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

from etl.common import fontes as mod_fontes
from etl.common.fetch import absoluto
from etl.common.paths import PROCESSED, RAW
from etl.common.validate import Relatorio, ValidationError, v3_ocupados_lte_previstos

VERSAO_MODELO = "1.0"
PAGINA_INICIAL = 3  # as três primeiras são capa e nota introdutória

C_CARREIRA, C_CATEGORIA = 0, 1

# Colunas de contagem, tal como o cabeçalho as agrupa.
# OCUPADOS: permanente, temporária, comissão de serviço.
OCUPADOS = (4, 5, 6)
# LIVRES: permanente (cativos por mobilidade, cativos em concurso, novos),
# temporária (cativos em concurso, novos), comissão de serviço.
LIVRES = (7, 8, 9, 10, 11, 12)
CONTAGEM = OCUPADOS + LIVRES

ROTULOS = {
    4: "ocupados_necessidade_permanente",
    5: "ocupados_necessidade_temporaria",
    6: "ocupados_comissao_servico",
    7: "livres_permanente_cativos_mobilidade",
    8: "livres_permanente_cativos_concurso",
    9: "livres_permanente_novos",
    10: "livres_temporaria_cativos_concurso",
    11: "livres_temporaria_novos",
    12: "livres_comissao_servico",
}

RE_INT = re.compile(r"^\d+$")
TOLERANCIA_Y = 6  # pontos, para reunir as palavras da linha TOTAL


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


def _colunas(tab) -> list[tuple[float, float]]:
    """Limites horizontais das 14 colunas, a partir das células da tabela."""
    out: list[tuple[float, float]] = []
    for c in sorted({(round(c[0], 1), round(c[2], 1)) for c in tab.cells if c}):
        if not any(abs(c[0] - x0) < 1 for x0, _ in out):
            out.append(c)
    return sorted(out)


def _int(v) -> int:
    v = (v or "").strip()
    return int(v) if RE_INT.match(v) else 0


def _cabecalho(pagina) -> tuple[str | None, str | None]:
    nome = codigo = None
    for b in pagina.get_text("blocks"):
        t = b[4].strip()
        if t.startswith("UNIDADE ORGÂNICA:"):
            nome = t.split(":", 1)[1].strip()
        elif t.startswith("CÓDIGO UNIDADE ORGÂNICA:"):
            codigo = t.split(":", 1)[1].strip()
    return nome, codigo


def _total_impresso(pagina, colunas) -> dict[int, int] | None:
    """Lê a linha TOTAL, que vive fora da tabela e em blocos separados."""
    palavras = pagina.get_text("words")
    alvo = next((w for w in palavras if w[4].strip().upper() == "TOTAL"), None)
    if alvo is None:
        return None
    y = (alvo[1] + alvo[3]) / 2
    valores: dict[int, int] = {}
    for w in palavras:
        if abs((w[1] + w[3]) / 2 - y) > TOLERANCIA_Y:
            continue
        texto = w[4].strip()
        if not RE_INT.match(texto):
            continue
        cx = (w[0] + w[2]) / 2
        for i, (x0, x1) in enumerate(colunas):
            if x0 <= cx <= x1:
                valores[i] = int(texto)
                break
    return valores or None


def extrair(caminho: Path, fonte_id: str) -> tuple[list[dict], list[dict]]:
    """Devolve (postos, unidades). `unidades` traz o TOTAL impresso, para validar."""
    doc = pymupdf.open(caminho)
    postos: list[dict] = []
    unidades: list[dict] = []
    unidade = codigo = None
    carreira = None

    for n in range(PAGINA_INICIAL, doc.page_count):
        pagina = doc[n]
        tabelas = pagina.find_tables().tables
        if not tabelas:
            continue
        tab = tabelas[0]
        colunas = _colunas(tab)

        nome_novo, codigo_novo = _cabecalho(pagina)
        if nome_novo:
            # Unidade nova: a carreira não transita entre unidades.
            unidade, codigo, carreira = nome_novo, codigo_novo, None

        for linha in tab.extract():
            cel = [(c or "").replace("\n", " ").strip() for c in linha]
            if len(cel) <= max(CONTAGEM):
                continue
            if cel[C_CARREIRA].upper().startswith("CARREIRA"):
                continue  # cabeçalho repetido
            contagens = {i: _int(cel[i]) for i in CONTAGEM}
            if cel[C_CARREIRA]:
                carreira = cel[C_CARREIRA]
            if not any(contagens.values()):
                continue  # linha de cabeçalho ou de continuação de texto
            ocupados = sum(contagens[i] for i in OCUPADOS)
            livres = sum(contagens[i] for i in LIVRES)
            postos.append(
                {
                    "unidade_organica": unidade,
                    "unidade_organica_id": codigo,
                    "carreira": carreira,
                    "categoria": cel[C_CATEGORIA] or None,
                    "previstos": ocupados + livres,
                    "ocupados": ocupados,
                    "vagos": livres,
                    "detalhe": {ROTULOS[i]: contagens[i] for i in CONTAGEM},
                    "pagina": n + 1,
                    "fonte_id": fonte_id,
                }
            )

        if (total := _total_impresso(pagina, colunas)) is not None:
            unidades.append(
                {
                    "unidade_organica": unidade,
                    "unidade_organica_id": codigo,
                    "total_impresso": {ROTULOS[i]: total.get(i, 0) for i in CONTAGEM},
                    "pagina_total": n + 1,
                }
            )

    doc.close()
    return postos, unidades


def construir() -> int:
    rel = Relatorio()
    avisos: list[str] = []

    raws = _raw_por_fonte()
    anos = sorted(
        (int(m.group(1)), fid)
        for fid in raws
        if (m := re.fullmatch(r"S07-(\d{4})", fid))
    )
    if not anos:
        print(
            "Nenhum mapa de pessoal em data/raw/. Corre `make fetch`.", file=sys.stderr
        )
        return 1
    ano, fonte_id = anos[-1]  # o mais recente

    if fonte_id not in mod_fontes.ids_validos():  # V6
        print(f"V6: fonte_id {fonte_id} não resolve em fontes.json", file=sys.stderr)
        return 1

    postos, unidades = extrair(raws[fonte_id], fonte_id)
    rel.check("postos-nao-vazio", bool(postos), "não foram extraídas linhas")
    rel.check("unidades-nao-vazio", bool(unidades), "nenhum TOTAL impresso encontrado")

    # Validação central: por unidade, a soma das linhas tem de reconstituir o
    # TOTAL que o próprio documento imprime. É isto que apanha uma coluna
    # trocada ou uma linha perdida numa tabela larga de PDF.
    for u in unidades:
        linhas = [p for p in postos if p["unidade_organica_id"] == u["unidade_organica_id"]]
        for rotulo in u["total_impresso"]:
            soma = sum(p["detalhe"][rotulo] for p in linhas)
            rel.check(
                f"total-{u['unidade_organica_id']}-{rotulo}",
                soma == u["total_impresso"][rotulo],
                f"{u['unidade_organica']}: {rotulo} soma {soma}, "
                f"documento diz {u['total_impresso'][rotulo]}",
            )

    try:
        v3_ocupados_lte_previstos(postos)
        rel.ok.append("V3")
    except ValidationError as exc:
        rel.falhas.append(str(exc))

    if not rel.passou:
        print("Validações falhadas — nada foi escrito:", file=sys.stderr)
        for f in rel.falhas:
            print(f"  {f}", file=sys.stderr)
        print(
            "\nRegista a discrepância em docs/qualidade_dados.md e deixa o "
            "indicador a null em vez de publicar um número errado.",
            file=sys.stderr,
        )
        return 1

    total_ocupados = sum(p["ocupados"] for p in postos)
    total_previstos = sum(p["previstos"] for p in postos)
    saida = {
        "_meta": {
            "gerado_em": datetime.now(timezone.utc).isoformat(),
            "script": "etl/mapa_pessoal.py",
            "versao_modelo": VERSAO_MODELO,
            "fontes": [fonte_id],
            "avisos": avisos,
        },
        "ano_referencia": ano,
        "total_postos_previstos": total_previstos,
        "total_postos_ocupados": total_ocupados,
        "total_postos_vagos": total_previstos - total_ocupados,
        "unidades": [
            {k: v for k, v in u.items() if k != "total_impresso"} | {
                "previstos": sum(
                    p["previstos"] for p in postos
                    if p["unidade_organica_id"] == u["unidade_organica_id"]
                ),
                "ocupados": sum(
                    p["ocupados"] for p in postos
                    if p["unidade_organica_id"] == u["unidade_organica_id"]
                ),
            }
            for u in unidades
        ],
        "postos": postos,
    }
    destino = PROCESSED / "mapa_pessoal.json"
    destino.write_text(
        json.dumps(saida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Escrito {destino}")
    print(
        f"  {len(postos)} linhas em {len(unidades)} unidades — "
        f"{total_ocupados} postos ocupados de {total_previstos} previstos"
    )
    print(f"\nValidações passadas: {len(rel.ok)} (inclui V3 e os totais por unidade)")
    return 0


if __name__ == "__main__":
    raise SystemExit(construir())
