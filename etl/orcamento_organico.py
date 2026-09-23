#!/usr/bin/env python3
"""Orçamento da despesa por unidade orgânica — `orcamento_organico.json`.

Responde a "quanto custa cada estrutura da Câmara". A fonte é a mesma dos
agregados (`S08-<ano>`, Grandes Opções do Plano e Orçamento), mas outro mapa:
**ORÇAMENTO E PLANO ORÇAMENTAL PLURIANUAL / DA DESPESA**, onde cada rubrica
económica é desdobrada pelas unidades a que a despesa está afeta.

Não existe mapa-resumo por orgânica. A classificação aparece embutida, e os
códigos orgânicos têm **exatamente o mesmo formato** dos económicos (`01`,
`0103`, `010101`): distinguem-se só pela coluna em que estão. O parser calibra
as colunas em cada documento em vez de as fixar — mudam de ano para ano (x≈48,4
em 2022–2025, x≈50,6 em 2026) e um valor fixo daria silenciosamente o mapa
errado.

Três níveis, da esquerda para a direita:

    x≈29,8  D1, D11, …   resumo económico (agrupador; ignorado aqui)
    x≈48,4  01, 0103     **classificação orgânica**
    x≈64,3  01, 010101   classificação económica, dentro da unidade

O documento traz ainda, no fim, o orçamento próprio de entidades participadas
(o Laboratório da Paisagem). Esses mapas têm o nome da entidade no título; o do
Município tem o título nu. A regra é essa, e é o que impede que a despesa do
Laboratório entre na do Município.

2021 fica de fora: o mapa é imagem digitalizada (L25), como já acontece nos
agregados.

    python -m etl.orcamento_organico
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

from etl.common import fontes as mod_fontes
from etl.common.fetch import absoluto
from etl.common.paths import PROCESSED, RAW
from etl.common.validate import Relatorio, ValidationError, v1_soma_bate_total

VERSAO_MODELO = "1.0"

# O título tem de ser este e mais nada. Os mapas das participadas trazem-no
# prefixado com o nome e o NIF da entidade.
TITULO_MAPA = "ORÇAMENTO E PLANO ORÇAMENTAL PLURIANUAL"
SUBTITULO = "DA DESPESA"

# `865 927,00 €` — separador de milhares por espaço, normal ou insecável. O `¬`
# aparece quando a fonte do PDF não traz o glifo do euro.
RE_EUROS = re.compile(r"^[\d\s. ]+,\d{2}\s*[€¬]$")
RE_RESUMO = re.compile(r"^D\d+$")

# Uma coluna de código só conta como coluna se aparecer neste número de linhas;
# abaixo disto é ruído de um cabeçalho ou de uma nota de rodapé.
MIN_LINHAS_COLUNA = 20

# Quanto é que duas alturas podem diferir e ainda ser a mesma linha da tabela.
# No documento de 2023 a designação sai 1,2 pt acima dos valores da própria
# linha; as linhas seguem-se de ~10 pt e a continuação de um nome comprido cai
# 7,6 pt abaixo. Qualquer valor entre 1,2 e 7,6 separa os três casos — 3 pt
# fica a meio, longe das duas fronteiras.
TOLERANCIA_LINHA = 3.0


# Palavras de ligação que as duas fontes escrevem de maneira diferente: o
# orçamento diz "DEPARTAMENTO INTERVENÇÃO SOCIAL" e o despacho da estrutura diz
# "Departamento de Intervenção Social". Tirá-las é mecânico e não muda o nome.
LIGACOES = {"de", "da", "do", "das", "dos", "e"}


def _chave(nome: str) -> str:
    """Nome reduzido a uma forma comparável: sem acentos, sem ligações."""
    sem_acentos = "".join(
        c
        for c in unicodedata.normalize("NFD", nome.lower())
        if unicodedata.category(c) != "Mn"
    )
    palavras = re.findall(r"\w+", sem_acentos)
    return " ".join(p for p in palavras if p not in LIGACOES)


def _unidades_da_estrutura() -> dict[str, dict]:
    """Unidades de topo de `estrutura_organica.json`, por nome comparável.

    Serve para dizer ao cidadão que a rubrica "02" é a mesma coisa que o
    organograma chama DMSP. A ligação é **por igualdade de nome**, nunca por
    parecença: onde os nomes não coincidem o campo fica a `null` e o dashboard
    diz que não está ligado, em vez de inventar a correspondência.
    """
    caminho = PROCESSED / "estrutura_organica.json"
    if not caminho.exists():
        return {}
    arvore = json.loads(caminho.read_text(encoding="utf-8"))["arvore"]
    return {
        _chave(n["nome"]): {"id": n["id"], "sigla": n["sigla"], "nome": n["nome"]}
        for n in arvore["filhos"]
    }


def _numero(texto: str) -> float:
    return float(re.sub(r"[^\d,]", "", texto).replace(",", "."))


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


def paginas_do_mapa(doc: pymupdf.Document) -> list[int]:
    """Páginas do mapa da despesa **do Município**, por índice 0."""
    paginas = []
    for i in range(doc.page_count):
        texto = doc[i].get_text()
        if SUBTITULO not in texto or TITULO_MAPA not in texto:
            continue
        # O título tem de estar nu num span. Comparar o texto da página inteira
        # deixaria passar "LABORATÓRIO DA PAISAGEM … - ORÇAMENTO E PLANO …".
        for bloco in doc[i].get_text("dict")["blocks"]:
            for linha in bloco.get("lines", []):
                if any(s["text"].strip() == TITULO_MAPA for s in linha["spans"]):
                    paginas.append(i)
                    break
            else:
                continue
            break
    return paginas


def colunas_de_codigo(doc: pymupdf.Document, paginas: list[int]) -> tuple[float, float]:
    """Calibra as colunas (orgânica, económica) neste documento.

    Não fixa coordenadas: conta onde caem os códigos e fica com as duas colunas
    densas. Se aparecerem três, o mapa não é o que este parser sabe ler e é
    melhor falhar do que adivinhar qual é qual.
    """
    contagem: Counter[float] = Counter()
    for i in paginas:
        for bloco in doc[i].get_text("dict")["blocks"]:
            for linha in bloco.get("lines", []):
                for s in linha["spans"]:
                    t = s["text"].strip()
                    x = round(s["bbox"][0], 1)
                    if x < 100 and t.isdigit() and len(t) <= 8:
                        contagem[x] += 1
    densas = sorted(x for x, n in contagem.items() if n >= MIN_LINHAS_COLUNA)
    if len(densas) != 2:
        raise ValidationError(
            f"esperava 2 colunas de código no mapa da despesa, encontrei "
            f"{len(densas)}: {densas}"
        )
    return densas[0], densas[1]


def ler_linhas(doc: pymupdf.Document, paginas: list[int], x_org: float, x_eco: float):
    """Linhas do mapa, por ordem de leitura.

    A unidade de leitura é o **bloco de texto**, não a altura. Foi a única
    chave que serve os dois desenhos que a CMG usou nestes documentos:

      - 2023: o bloco é a linha inteira — código, designação (em duas linhas,
        centradas sobre o código, uma 3,6 pt acima e outra 3,96 pt abaixo) e
        valores;
      - 2022, 2024–2026: o bloco é a célula do código mais a designação, já com
        a quebra incluída, e os valores vêm num bloco à parte.

    Agrupar por altura parecia natural e está errado nos dois: em 2023 a
    primeira linha do nome fica *acima* do código, em 2026 fica abaixo, e a
    continuação de 2026 está mais perto da linha seguinte do que da sua. O
    bloco resolve os dois casos sem tolerâncias afinadas à mão.
    """
    for i in paginas:
        pagina = doc[i].get_text("dict")["blocks"]

        # Valores por altura, para os blocos que só trazem código e designação.
        valores_por_y: dict[float, list[tuple[float, float]]] = defaultdict(list)
        for bloco in pagina:
            for linha in bloco.get("lines", []):
                for s in linha["spans"]:
                    t = s["text"].strip()
                    if t and s["bbox"][0] > x_eco and RE_EUROS.match(t):
                        valores_por_y[round(s["bbox"][1], 2)].append(
                            (round(s["bbox"][0], 1), _numero(t))
                        )

        linhas_da_pagina: list[dict] = []
        for bloco in pagina:
            spans = [
                (round(s["bbox"][0], 1), round(s["bbox"][1], 2), s["text"].strip())
                for l in bloco.get("lines", [])
                for s in l["spans"]
                if s["text"].strip()
            ]
            codigos = [
                (y, x, t, "organica" if abs(x - x_org) < 1.5 else "economica")
                for x, y, t in spans
                if t.isdigit()
                and len(t) <= 8
                and (abs(x - x_org) < 1.5 or abs(x - x_eco) < 1.5)
            ]
            if not codigos:
                continue

            codigos.sort()

            def dono(y: float) -> float:
                """A que código pertence um span a esta altura.

                Só importa em blocos com mais de um código, e aí a designação é
                alinhada pelo topo: partilha a altura do seu código e continua
                por baixo. Logo o dono é o último código à altura do span ou
                acima dela. Escolher o código mais próximo erra — na página 105
                de 2024 a continuação «CULTURAL» fica a 7,56 pt do código a que
                pertence e a 7,32 pt do seguinte.
                """
                anteriores = [c[0] for c in codigos if c[0] <= y + 0.5]
                return anteriores[-1] if anteriores else codigos[0][0]

            for y_cod, _x, codigo, nivel in codigos:
                meus = [(x, y, t) for x, y, t in spans if dono(y) == y_cod]
                valores = sorted(
                    (x, _numero(t))
                    for x, y, t in meus
                    if x > x_eco and RE_EUROS.match(t)
                )
                if not valores:
                    perto = min(
                        valores_por_y,
                        key=lambda y: abs(y - y_cod),
                        default=None,
                    )
                    if perto is not None and abs(perto - y_cod) <= TOLERANCIA_LINHA:
                        valores = sorted(valores_por_y[perto])
                limite = valores[0][0] if valores else float("inf")
                nome = re.sub(
                    r"\s+",
                    " ",
                    " ".join(
                        t
                        for x, y, t in sorted(meus, key=lambda s: (s[1], s[0]))
                        if x > x_eco + 5 and x < limite and not RE_EUROS.match(t)
                    ),
                ).strip()
                linhas_da_pagina.append(
                    {
                        "pagina": i + 1,
                        "y": y_cod,
                        "nivel": nivel,
                        "codigo": codigo,
                        "nome": nome,
                        "valor": valores[0][1] if valores else None,
                    }
                )

        # Os blocos não vêm por ordem de leitura; a altura repõe-na.
        linhas_da_pagina.sort(key=lambda r: r["y"])
        yield from linhas_da_pagina


def extrair(caminho: Path) -> tuple[dict, dict[str, Counter]]:
    """Unidades orgânicas e, à parte, como o documento nomeia cada rubrica.

    Os rótulos das rubricas económicas contam-se ao nível do documento inteiro,
    não da unidade: o capítulo 07 chama-se "Aquisição de bens de capital" em
    todo o mapa, e é isso que permite reconhecer a linha isolada onde a CMG lhe
    pôs o nome de uma unidade orgânica por engano. Contar só dentro da unidade
    não chegava — onde o capítulo aparece uma única vez não há maioria.
    """
    doc = pymupdf.open(caminho)
    paginas = paginas_do_mapa(doc)
    if not paginas:
        return {}, {}
    x_org, x_eco = colunas_de_codigo(doc, paginas)

    unidades: dict[str, dict] = {}
    nomes_economicos: defaultdict[str, Counter] = defaultdict(Counter)
    pai_atual: str | None = None
    unidade_atual: str | None = None

    for linha in ler_linhas(doc, paginas, x_org, x_eco):
        if linha["nivel"] == "organica":
            codigo = linha["codigo"]
            if len(codigo) <= 2:
                pai_atual, unidade_atual = codigo, codigo
            else:
                unidade_atual = codigo
            u = unidades.setdefault(
                codigo,
                {
                    "codigo": codigo,
                    "nivel": 1 if len(codigo) <= 2 else 2,
                    "codigo_pai": None if len(codigo) <= 2 else pai_atual,
                    "total": 0.0,
                    "_nomes": Counter(),
                    "_paginas": {},
                    "_natureza": defaultdict(float),
                    "_natureza_nome": defaultdict(Counter),
                },
            )
            u["total"] += linha["valor"] or 0.0
            u["_nomes"][linha["nome"]] += 1
            u["_paginas"].setdefault(linha["nome"], linha["pagina"])

        elif linha["nivel"] == "economica" and len(linha["codigo"]) == 2:
            # A classificação económica de 2 dígitos é o capítulo — despesas com
            # o pessoal, aquisição de bens e serviços, e por aí. Pertence à
            # unidade mais funda aberta; somá-la também ao pai duplicava-a.
            if unidade_atual is None:
                continue
            u = unidades[unidade_atual]
            u["_natureza"][linha["codigo"]] += linha["valor"] or 0.0
            # O rótulo é por maioria, não o primeiro que aparece. O documento
            # de 2026 compõe algumas rubricas com o nome da unidade orgânica em
            # vez do da rubrica — na p. 83 a rubrica económica 01 sai como
            # "Direção Municipal de Intervenção no Território" em vez de
            # "Despesas com o pessoal". Os valores estão certos — a validação da
            # repartição por natureza fecha na mesma; é
            # só o rótulo. Como cada capítulo económico se repete sob todas as
            # unidades, o nome maioritário é o do próprio documento e corrige-se
            # sozinho — sem lista de nomes escrita por nós (L34).
            u["_natureza_nome"][linha["codigo"]][linha["nome"]] += 1
            nomes_economicos[linha["codigo"]][linha["nome"]] += 1

    return unidades, nomes_economicos


def _arrumar(
    unidades: dict[str, dict], nomes_economicos: dict[str, Counter], ano: int
) -> tuple[list[dict], list[str]]:
    """Fecha as unidades, faz subir as naturezas e reporta rótulos divergentes."""
    avisos: list[str] = []
    filhos_de: dict[str, list[dict]] = defaultdict(list)
    for u in unidades.values():
        if u["codigo_pai"]:
            filhos_de[u["codigo_pai"]].append(u)

    estrutura = _unidades_da_estrutura()
    sem_ligacao: list[str] = []
    rotulos_economicos: Counter[str] = Counter()
    for cont in nomes_economicos.values():
        vencedor = cont.most_common(1)[0][0]
        for n, q in cont.items():
            if n != vencedor:
                rotulos_economicos[n] += q

    saida = []
    for codigo in sorted(unidades):
        u = unidades[codigo]
        natureza = dict(u["_natureza"])
        # Uma unidade com filhos não tem despesa própria no mapa: a natureza
        # dela é a soma das naturezas dos filhos.
        for f in filhos_de[codigo]:
            for c, v in f["_natureza"].items():
                natureza[c] = natureza.get(c, 0.0) + v

        nomes = u["_nomes"].most_common()
        ligada = estrutura.get(_chave(nomes[0][0]))
        # A família do código 01 — Órgãos da Autarquia, Assembleia Municipal,
        # Classes Inactivas, Operações Financeiras — não tem contrapartida no
        # organograma porque não são serviços: são os órgãos políticos, as
        # pensões e a dívida. Não vale a pena avisar do que é assim por
        # construção; avisa-se do que devia ter ligação e não tem.
        if ligada is None and not codigo.startswith("01"):
            sem_ligacao.append(f"{codigo} «{nomes[0][0]}»")
        registo = {
            "codigo": codigo,
            "nome": nomes[0][0],
            "nivel": u["nivel"],
            "codigo_pai": u["codigo_pai"],
            "unidade_estrutura": ligada,
            "total": round(u["total"], 2),
            "por_natureza": [
                {
                    "codigo": c,
                    "nome": nomes_economicos[c].most_common(1)[0][0],
                    "valor": round(v, 2),
                }
                for c, v in sorted(natureza.items(), key=lambda kv: -kv[1])
            ],
        }
        # O documento de 2026 rotula uma linha do código 01 como "Direção
        # Municipal de Intervenção no Território" quando em todas as outras é
        # "Administração Municipal". O código e os filhos fecham a conta; o
        # rótulo é que está trocado. Fica registado em vez de corrigido — é a
        # fonte que o diz assim (L34).
        if len(nomes) > 1:
            registo["rotulos_divergentes"] = [
                {"nome": n, "ocorrencias": q, "primeira_pagina": u["_paginas"][n]}
                for n, q in nomes[1:]
            ]
            for n, q in nomes[1:]:
                avisos.append(
                    f"{ano}: a unidade {codigo} aparece {q}x com o rótulo «{n}» e "
                    f"{nomes[0][1]}x com «{nomes[0][0]}» (p. {u['_paginas'][n]}). "
                    f"O código e a soma dos filhos confirmam «{nomes[0][0]}»."
                )
        saida.append(registo)

    if sem_ligacao:
        avisos.append(
            f"{ano}: sem correspondência no organograma para "
            + ", ".join(sem_ligacao)
            + ". O orçamento e o despacho da estrutura orgânica nomeiam a mesma "
            "unidade de maneiras diferentes; a ligação fica a `null` em vez de "
            "ser adivinhada."
        )

    for n, q in rotulos_economicos.most_common(3):
        avisos.append(
            f"{ano}: {q} rubrica(s) económica(s) vêm no documento rotuladas "
            f"«{n}», que é nome de unidade orgânica e não de rubrica. Os valores "
            f"fecham; o rótulo publicado é o maioritário do próprio documento."
        )
    return saida, avisos


def validar_organica_bate_despesa(
    unidades: list[dict], despesa_total: float, ano: int
) -> None:
    """A soma das unidades de 1.º nível == despesa total do orçamento.

    É esta que prova que a coluna lida é mesmo a orgânica: bate ao cêntimo com
    um total que veio de outro mapa, por outro parser (`etl/orcamento.py`).
    """
    soma = sum(u["total"] for u in unidades if u["nivel"] == 1)
    v1_soma_bate_total(soma, despesa_total, f"orgânica {ano}")


def validar_subunidades_batem_unidade(unidades: list[dict], ano: int) -> None:
    """Uma unidade subdividida vale a soma das suas subunidades."""
    por_pai: dict[str, float] = defaultdict(float)
    for u in unidades:
        if u["codigo_pai"]:
            por_pai[u["codigo_pai"]] += u["total"]
    for u in unidades:
        if u["codigo"] in por_pai and abs(por_pai[u["codigo"]] - u["total"]) > 0.01:
            raise ValidationError(
                f"subunidades-batem-unidade {ano}: a unidade {u['codigo']} vale {u['total']:.2f} € mas as "
                f"subunidades somam {por_pai[u['codigo']]:.2f} €"
            )


def validar_natureza_bate_unidade(unidades: list[dict], ano: int) -> None:
    """A repartição por natureza da despesa == total da unidade."""
    for u in unidades:
        soma = sum(n["valor"] for n in u["por_natureza"])
        if abs(soma - u["total"]) > 0.01:
            raise ValidationError(
                f"natureza-bate-unidade {ano}: a unidade {u['codigo']} vale {u['total']:.2f} € mas a "
                f"repartição por natureza soma {soma:.2f} €"
            )


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
        print("Nenhum documento previsional em data/raw/. Corre `make fetch`.", file=sys.stderr)
        return 1

    orcamento = PROCESSED / "orcamento.json"
    if not orcamento.exists():
        print("Falta orcamento.json — corre `make orcamento` primeiro.", file=sys.stderr)
        return 1
    totais = {
        e["ano_referencia"]: e["despesa_total"]
        for e in json.loads(orcamento.read_text(encoding="utf-8"))["exercicios"]
        if e["tipo"] == "previsto"
    }

    validos = mod_fontes.ids_validos()
    exercicios: list[dict] = []
    sem_mapa: list[int] = []

    for ano, fonte_id in anos:
        if fonte_id not in validos:  # V6
            print(f"V6: fonte_id {fonte_id} não resolve em fontes.json", file=sys.stderr)
            return 1

        unidades, nomes_economicos = extrair(raws[fonte_id])
        if not unidades:
            sem_mapa.append(ano)
            continue

        lista, avisos_ano = _arrumar(unidades, nomes_economicos, ano)
        despesa_total = totais.get(ano)
        if despesa_total is None:
            avisos.append(
                f"{ano}: sem despesa total em orcamento.json para confrontar; ano não publicado."
            )
            continue
        try:
            validar_organica_bate_despesa(lista, despesa_total, ano)
            validar_subunidades_batem_unidade(lista, ano)
            validar_natureza_bate_unidade(lista, ano)
        except ValidationError as erro:
            # Bloqueante: o ano não é publicado, e a razão fica escrita.
            rel.check(f"organica-fecha-{ano}", False, str(erro))
            avisos.append(f"{ano} não publicado: {erro}")
            continue
        rel.check(f"organica-fecha-{ano}", True)

        avisos += avisos_ano
        exercicios.append(
            {
                "ano_referencia": ano,
                "tipo": "previsto",
                "despesa_total": round(despesa_total, 2),
                "unidades": lista,
                "fonte_id": fonte_id,
            }
        )

    if not exercicios:
        print("Nenhum ano passou as validações; nada publicado.", file=sys.stderr)
        for f in rel.falhas:
            print(f"  {f}", file=sys.stderr)
        return 1

    if sem_mapa:
        avisos.append(
            "Sem mapa legível por unidade orgânica em "
            + ", ".join(str(a) for a in sem_mapa)
            + ": nesses anos o mapa da despesa é imagem digitalizada (L25)."
        )

    destino = PROCESSED / "orcamento_organico.json"
    destino.write_text(
        json.dumps(
            {
                "_meta": {
                    "gerado_em": datetime.now(timezone.utc).isoformat(),
                    "script": "etl/orcamento_organico.py",
                    "versao_modelo": VERSAO_MODELO,
                    "validacoes": rel.ok,
                    "avisos": avisos,
                },
                "primeiro_ano": exercicios[0]["ano_referencia"],
                "ultimo_ano": exercicios[-1]["ano_referencia"],
                "exercicios": exercicios,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"{destino.relative_to(PROCESSED.parents[1])}: {len(exercicios)} exercícios")
    for e in exercicios:
        n1 = sum(1 for u in e["unidades"] if u["nivel"] == 1)
        print(
            f"  {e['ano_referencia']}: {n1} unidades de 1.º nível, "
            f"{len(e['unidades'])} no total, {e['despesa_total']:,.2f} €"
        )
    for a in avisos:
        print(f"  aviso: {a}")
    return 0


if __name__ == "__main__":
    raise SystemExit(construir())
