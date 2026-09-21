"""Descoberta de segundo nível: de uma página-índice para os ficheiros reais.

Várias fontes do inventário não são o documento, são a página que lhe aponta:

- S07 é o índice do Mapa de Pessoal; o PDF do ano está lá dentro.
- S16 é uma notícia; o Mapa Oficial das eleições está no Diário da República.
- S23 é a página do dataset no dados.gov; os ficheiros são um XLSX por ano,
  cujo URL inclui um carimbo temporal que **roda a cada publicação semanal**.

Fixar esses URL em `sources.yaml` produziria um registo obsoleto em poucos dias
e violaria a regra 4 (pipeline reprodutível). Em vez disso, cada fonte-índice
declara um `descoberta.padrao` e o pipeline deriva as fontes-filhas a partir do
original já guardado em `data/raw/`.

As fontes derivadas são escritas em `etl/descobertas.yaml`, que é **gerado mas
commitado**: é assim que se vê no histórico do git quando o dados.gov rodou um
URL ou quando a CMG publicou o mapa de pessoal de um novo ano.
"""
from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urljoin

import yaml

from .paths import ROOT

DESCOBERTAS_YAML = ROOT / "etl" / "descobertas.yaml"

# Campos que a fonte-filha herda da fonte-índice se não os redefinir.
HERDADOS = ("entidade", "periodicidade", "verificacao", "limitacoes")

# Só lemos como texto o que é texto: um PDF não contém hiperligações a extrair
# por regex de forma fiável.
TAMANHO_MAX_INDICE = 20 << 20  # 20 MiB


def _texto(caminho: Path) -> str:
    return caminho.read_text(encoding="utf-8", errors="replace")


def _preencher(molde, grupos: dict[str, str]):
    """Substitui {grupo} num molde escalar ou numa lista de moldes."""
    if isinstance(molde, list):
        return [_preencher(m, grupos) for m in molde]
    if not isinstance(molde, str):
        return molde
    for chave, valor in grupos.items():
        molde = molde.replace("{" + chave + "}", valor)
    return molde


def derivar(fonte_id: str, fonte: dict, caminho_raw: Path) -> dict[str, dict]:
    """Deriva as fontes-filhas de uma fonte-índice já descarregada.

    Devolve {id_filha: registo}. Dicionário vazio se a fonte não declara
    descoberta, se o original não existe, ou se o padrão não encontra nada —
    nunca inventa um URL (regra 1).
    """
    regra = fonte.get("descoberta")
    if not regra or not caminho_raw or not caminho_raw.exists():
        return {}
    if caminho_raw.stat().st_size > TAMANHO_MAX_INDICE:
        return {}

    padrao = re.compile(regra["padrao"])
    base_url = fonte.get("url", "")
    encontrados: dict[str, dict] = {}

    for m in padrao.finditer(_texto(caminho_raw)):
        grupos = {k: v for k, v in (m.groupdict() or {}).items() if v is not None}
        # Grupos posicionais ficam disponíveis como {1}, {2}, ...
        for i, valor in enumerate(m.groups(), start=1):
            if valor is not None:
                grupos.setdefault(str(i), valor)

        if (ano_min := regra.get("ano_minimo")) and (ano := grupos.get("ano")):
            if int(ano) < int(ano_min):
                continue

        url = urljoin(base_url, m.group(0))
        id_filha = _preencher(regra.get("id", f"{fonte_id}-{{ano}}"), grupos)

        registo = {k: fonte[k] for k in HERDADOS if k in fonte}
        registo.update(
            {
                "nome": _preencher(regra.get("nome", fonte.get("nome", id_filha)), grupos),
                "url": url,
                "formato": regra.get("formato", "pdf"),
                "descoberta_via": fonte_id,
            }
        )
        for campo in ("ano_referencia", "alimenta", "periodicidade", "limitacoes"):
            if campo in regra:
                registo[campo] = _preencher(regra[campo], grupos)
        if "ano" in grupos and "ano_referencia" not in registo:
            registo["ano_referencia"] = int(grupos["ano"])

        # O mesmo ficheiro pode aparecer várias vezes na página; fica a 1.ª.
        encontrados.setdefault(id_filha, registo)

    return encontrados


def carregar_descobertas() -> dict[str, dict]:
    if not DESCOBERTAS_YAML.exists():
        return {}
    with open(DESCOBERTAS_YAML, encoding="utf-8") as fh:
        conteudo = yaml.safe_load(fh) or {}
    return conteudo.get("fontes", {})


def escrever_descobertas(fontes: dict[str, dict]) -> Path:
    """Grava o registo das fontes derivadas, ordenado para o diff ser legível."""
    DESCOBERTAS_YAML.write_text(
        "# GERADO por etl/common/descoberta.py — não editar à mão.\n"
        "# Fontes derivadas das páginas-índice (ver docstring do módulo).\n"
        "# É commitado de propósito: o diff mostra quando uma fonte mudou de URL.\n"
        + yaml.safe_dump(
            {
                # Sem `gerado_em`: um carimbo temporal sujava o ficheiro a cada
                # execução e afogava em ruído os diffs que justificam commitá-lo.
                # A data de geração é a do commit.
                "_meta": {"script": "etl/common/descoberta.py", "total": len(fontes)},
                "fontes": dict(sorted(fontes.items())),
            },
            allow_unicode=True,
            sort_keys=False,
            default_flow_style=False,
        ),
        encoding="utf-8",
    )
    return DESCOBERTAS_YAML
