#!/usr/bin/env python3
"""Secção 3 do dashboard — "Como está organizada".

Produz `estrutura_organica.json`, a árvore de unidades orgânicas do Município.

**São precisos três documentos, não dois.** A cadeia normativa é:

1. **S05** — Despacho n.º 14897/2022 (DR 30-12-2022): a estrutura base.
2. **S38** — Despacho n.º 6751/2024 (DR 17-06-2024): cria o Departamento de
   Inovação, Transformação Digital e Economia, renomeia o Departamento de
   Cultura, Economia e Inovação para Departamento de Cultura e Turismo, e
   revoga três divisões. **Não está ligado em nenhuma página da CMG.**
3. **S06** — Despacho n.º 9070/2024 (DR 09-08-2024): reorganiza os
   Departamentos de Intervenção Social e de Recursos Humanos.

Usar só S05 e S06 — como o inventário inicial supunha — deixaria de fora um
departamento inteiro e três divisões. Foi a renumeração das alíneas do artigo
5.º que denunciou a falta: em S05 o Departamento de Intervenção Social é a
alínea h), em S06 é a i). S38 explica o desvio, ao inserir o DITDE em e) e
renumerar as seguintes.

O texto normativo é a fonte da hierarquia; o organograma que a CMG publica
(`S03-06_24`) serve de **verificação cruzada**, não de fonte — e é isso que
apanha um erro na aplicação das alterações.

    python -m etl.estrutura_organica
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

VERSAO_MODELO = "1.0"
BASE, ALT1, ALT2, ORGANOGRAMA = "S05", "S38", "S06", "S03-06_24"

# A sigla é a PRIMEIRA do item. Sem isto, "… (DMITAAC), em cuja dependência se
# organiza o Departamento de Ambiente e Sustentabilidade (DAS)" dava um nó com
# o nome da direção municipal e a sigla do departamento.
RE_SIGLA = re.compile(r"^(?P<nome>.+?)\s*\((?P<sigla>[A-ZÁÂÃÉÍÓÔÕÚÇ]{2,8})\)")
RE_DEPENDENCIA = re.compile(
    r"([a-z])\)\s*Na dependência (?:da|do)\s+(?P<pai>[^:]+?):", re.IGNORECASE
)
# "… (DAEP), e, na dependência desta, o Gabinete de Serviços Urbanos (GSU)"
RE_SUBORDINADO = re.compile(
    r",?\s*e,?\s*na (?:sua )?dependência(?:\s+desta)?,\s*(?:o|os)\s+(?P<resto>.+)$",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Alterações normativas, na ordem em que foram publicadas.
#
# Cada entrada é uma operação sobre a árvore base, com a fonte que a estabelece.
# São poucas e pequenas de propósito: um motor genérico de aplicação de
# alterações legislativas seria mais frágil do que esta lista, e menos audível.
# A rede de segurança é a comparação final com o organograma publicado.
# ---------------------------------------------------------------------------
ALTERACOES = [
    # Despacho n.º 6751/2024 — artigos 3.º, 4.º, 5.º, 10.º e 62.º
    {"op": "revoga", "sigla": "DSI", "fonte": ALT1},
    {"op": "revoga", "sigla": "DDSI", "fonte": ALT1},
    {"op": "revoga", "sigla": "DDE", "fonte": ALT1, "sob": "DCEI"},
    {
        "op": "adiciona",
        "fonte": ALT1,
        "sob": "DMSP",
        "nome": "Departamento de Inovação, Transformação Digital e Economia",
        "sigla": "DITDE",
        "tipo": "departamento",
        "filhos": [
            ("Divisão de Inovação e Sistemas Inteligentes", "DISI"),
            ("Divisão de Sistemas de Informação e Comunicações", "DSIC"),
            ("Divisão de Desenvolvimento Económico", "DDE"),
        ],
    },
    {
        "op": "renomeia",
        "fonte": ALT1,
        "sigla": "DCEI",
        "nome": "Departamento de Cultura e Turismo",
        "nova_sigla": "DCT",
    },
    # Despacho n.º 9070/2024 — artigos 5.º, 30.º, 31.º, 54.º-A e 56.º
    # A nova redação da alínea b) é "Divisão para a Coesão e Desenvolvimento
    # Social;" — sem a cláusula "e, na dependência desta, o Gabinete para a
    # Ação Social Integrada (GASI)" que o texto de 2023 tinha. O gabinete é
    # extinto. Isto passou-me à primeira: foi a ausência do GASI no organograma
    # publicado que denunciou a falta.
    {"op": "revoga", "sigla": "GASI", "fonte": ALT2},
    {
        "op": "adiciona",
        "fonte": ALT2,
        "sob": "DIS",
        "nome": "Gabinete de Apoio à Intervenção Social",
        "sigla": "GAIS",
        "tipo": "gabinete",
        "filhos": [],
    },
]


def _sem_acentos(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", _sem_acentos(s).lower()).strip(" .,;:")


def _tipo(nome: str) -> str:
    baixo = _norm(nome)
    if baixo.startswith("direcao municipal"):
        return "direcao_municipal"
    if baixo.startswith("departamento"):
        return "departamento"
    if baixo.startswith("divisao"):
        return "divisao"
    if baixo.startswith("gabinete"):
        return "gabinete"
    if baixo.startswith("servico"):
        return "servico"
    return "unidade"


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


def _texto_pdf(caminho: Path) -> str:
    doc = pymupdf.open(caminho)
    t = "\n".join(doc[i].get_text() for i in range(doc.page_count))
    doc.close()
    # O DR usa espaço não-separável e corta palavras com hífen no fim da linha.
    t = t.replace("\xa0", " ").replace("-\n", "").replace(" -", "-")
    t = re.sub(
        r"N\.º 251\s*\n30 de dezembro de 2022\s*\nPág\. \d+\nDiário da República, "
        r"2\.ª série\nPARTE H",
        " ",
        t,
    )
    return re.sub(r"\s+", " ", t)


def alineas_aninhadas(texto: str) -> list[tuple[str, list]]:
    """Separa alíneas a), b), c)… respeitando o aninhamento.

    É a única regra determinista para distinguir níveis neste documento: as
    listas aninhadas reutilizam as mesmas letras das de 1.º nível, e nada na
    pontuação as distingue. O que as distingue é a **sequência**: dentro de um
    nível as letras são seguidas; um `a)` inesperado abre um nível novo, e uma
    letra que retoma a sequência de um nível acima fecha-o.

    Sem isto, a lista aninhada engolia as alíneas seguintes — foi assim que o
    Gabinete de Comunicação e Relações Públicas foi parar debaixo do
    Departamento de Cultura, e que o Departamento Jurídico apareceu duas vezes.

    Devolve [(texto, filhos), …], recursivamente.
    """
    marcas = list(re.finditer(r"([a-z])\)", texto))
    if not marcas:
        return []

    raiz: list[tuple[str, list]] = []
    pilha: list[list] = [raiz]        # listas abertas, da mais externa para dentro
    esperado: list[str] = ["a"]       # letra seguinte em cada nível aberto

    for i, m in enumerate(marcas):
        letra = m.group(1)
        fim = marcas[i + 1].start() if i + 1 < len(marcas) else len(texto)
        corpo = texto[m.end(): fim]

        if letra == esperado[-1]:
            pass                      # irmão no nível corrente
        elif letra == "a":            # abre um nível
            if not pilha[-1]:
                continue              # "a)" sem item anterior: ignora
            filhos = pilha[-1][-1][1]
            pilha.append(filhos)
            esperado.append("a")
        else:                         # fecha níveis até a letra encaixar
            while len(pilha) > 1 and letra != esperado[-1]:
                pilha.pop()
                esperado.pop()
            if letra != esperado[-1]:
                continue              # letra fora de sequência: descarta
        pilha[-1].append((corpo, []))
        esperado[-1] = chr(ord(letra) + 1)

    return raiz


RE_UNIDADE_SEM_SIGLA = re.compile(
    r"^(?P<nome>(?:Divisão|Gabinete|Serviço|Departamento|Direção)[^;.]*)$"
)


def _unidade(texto: str, fonte: str) -> dict | None:
    """`Divisão de Educação (DE)` → nó.

    Nem toda a unidade tem sigla no texto normativo: a Divisão de Mobilidade
    não a tem, e exigi-la fazia desaparecer a divisão **e os dois gabinetes na
    sua dependência**. Nesses casos a `sigla` fica `null` — não é inventada a
    partir do organograma, que não é fonte da hierarquia.
    """
    # O primeiro item de cada lista traz ainda a sua própria letra de alínea.
    texto = re.sub(r"^\s*[a-z]\)\s*", "", texto).strip(" .,;:")
    if m := RE_SIGLA.match(texto):
        nome, sigla = m.group("nome").strip(" .,;:"), m.group("sigla")
    elif m := RE_UNIDADE_SEM_SIGLA.match(texto):
        nome, sigla = m.group("nome").strip(" .,;:"), None
    else:
        return None
    return {
        "id": sigla or re.sub(r"[^a-z0-9]+", "_", _norm(nome)).strip("_"),
        "sigla": sigla,
        "nome": nome,
        "tipo": _tipo(nome),
        "dirigente": None,
        "competencias": [],
        "fonte_id": fonte,
        "filhos": [],
    }


def _com_subordinados(texto: str, fonte: str) -> dict | None:
    """Trata `X (SIG) e, na dependência desta, o Gabinete Y (SIG2) e o Z (SIG3)`."""
    if m := RE_SUBORDINADO.search(texto):
        pai = _unidade(texto[: m.start()], fonte)
        if pai is None:
            return None
        for parte in re.split(r"\s+e\s+o\s+|\s*,\s*e\s+o\s+", m.group("resto")):
            if (filho := _unidade(parte, fonte)) is not None:
                pai["filhos"].append(filho)
        return pai
    return _unidade(texto, fonte)


def corrida_consecutiva(texto: str) -> tuple[list[str], str]:
    """Alíneas a), b), c)… enquanto as letras forem seguidas. Devolve (itens, resto)."""
    marcas = list(re.finditer(r"([a-z])\)", texto))
    itens: list[str] = []
    esperado = "a"
    for i, m in enumerate(marcas):
        if m.group(1) != esperado:
            return itens, texto[m.start():]
        fim = marcas[i + 1].start() if i + 1 < len(marcas) else len(texto)
        itens.append(texto[m.end(): fim])
        esperado = chr(ord(esperado) + 1)
    return itens, ""


def _no_de(item: str, fonte: str) -> dict | None:
    """Item de alínea → nó, tratando a prosa "e, na dependência desta, o …"."""
    return _com_subordinados(item, fonte)


def _pendurar(pai: dict, item: str, filhos: list, indice: dict) -> None:
    """Cria o nó do item e desce recursivamente pelos seus filhos."""
    # "X (SIG), em cuja dependência se organiza o Y (SIG2)" — o filho único vem
    # em prosa, não como alínea, por isso é recolhido aqui.
    filho_em_prosa = None
    if "em cuja dependência" in item:
        item, _, cauda = item.partition("em cuja dependência")
        if (solo := re.search(r"se organiza o\s+([^;.]+)", cauda)) is not None:
            filho_em_prosa = solo.group(1)

    no = _no_de(item, BASE)
    if no is None:
        return
    if any(_norm(x["nome"]) == _norm(no["nome"]) for x in pai["filhos"]):
        return
    pai["filhos"].append(no)
    indice.setdefault(no["sigla"] or no["id"], no)
    for sub in no["filhos"]:
        indice.setdefault(sub["sigla"], sub)
    if filho_em_prosa:
        _pendurar(no, filho_em_prosa, [], indice)
    for texto_filho, netos in filhos:
        _pendurar(no, texto_filho, netos, indice)


def arvore_base(texto: str) -> dict:
    """Constrói a árvore a partir dos artigos 4.º (nuclear) e 5.º (flexível)."""
    raiz = {
        "id": "CMG",
        "sigla": "CMG",
        "nome": "Município de Guimarães",
        "tipo": "municipio",
        "dirigente": None,
        "competencias": [],
        "fonte_id": BASE,
        "filhos": [],
    }
    indice: dict[str, dict] = {"CMG": raiz}

    i4 = texto.index("Artigo 4.º")
    i5 = texto.index("Artigo 5.º")
    i6 = texto.index("Artigo 6.º")

    # --- Artigo 4.º: unidades nucleares ---
    # A alínea a) declara a DMSP "em cuja dependência se organizam os seguintes
    # departamentos municipais:", e esses vêm como lista aninhada.
    for item, filhos in alineas_aninhadas(texto[i4:i5].split(":", 1)[-1]):
        _pendurar(raiz, item, filhos, indice)

    # --- Artigo 5.º n.º 1: unidades flexíveis ---
    # Aqui a regra das letras consecutivas NÃO desempata: a lista aninhada do
    # Departamento Jurídico acaba em c) e a alínea de topo seguinte é d), pelo
    # que ambas "esperam" a mesma letra. O que é determinista neste artigo é o
    # marcador "Na dependência de…", com que cada alínea de topo começa.
    flexivel = texto[i5:i6]
    fim_n1 = flexivel.find("2 — Os serviços municipais organizam-se ainda")
    flexivel = flexivel[: fim_n1 if fim_n1 > 0 else len(flexivel)]

    marcas = list(RE_DEPENDENCIA.finditer(flexivel))
    for k, m in enumerate(marcas):
        nome_pai = m.group("pai").strip()
        pai = next(
            (n for n in indice.values() if _norm(n["nome"]) == _norm(nome_pai)), None
        )
        fim = marcas[k + 1].start() if k + 1 < len(marcas) else len(flexivel)
        itens, resto = corrida_consecutiva(flexivel[m.end(): fim])
        if pai is None:
            continue
        for item in itens:
            _pendurar(pai, item, [], indice)
        if k == len(marcas) - 1:
            # O que sobra depois do último bloco são as alíneas de topo sem
            # dependência: o SMPC e o Gabinete de Comunicação.
            for item in re.split(r"[a-z]\)\s*", resto):
                if item.strip():
                    _pendurar(raiz, item, [], indice)

    return raiz


def desambiguar_ids(raiz: dict) -> list[str]:
    """Torna `id` único, mantendo `sigla` como a fonte a publica.

    A CMG reutiliza siglas entre unidades diferentes, e a alteração de 2024
    agrava o problema: o Departamento de Cultura e Turismo passa a ter a sigla
    DCT, que já pertencia à Divisão de Contabilidade e Tesouraria. Como o `id`
    é a chave da árvore no `d3.hierarchy` do dashboard, tem de ser único —
    passa a ser `<sigla do pai>/<sigla>` nos casos de colisão.
    """
    contagem: dict[str, int] = {}
    for n in _percorrer(raiz):
        if n["sigla"]:
            contagem[n["sigla"]] = contagem.get(n["sigla"], 0) + 1
    colisoes = []
    for pai in _percorrer(raiz):
        for filho in pai["filhos"]:
            if filho["sigla"] and contagem[filho["sigla"]] > 1:
                filho["id"] = f"{pai['sigla'] or pai['id']}/{filho['sigla']}"
                colisoes.append(f"{filho['sigla']} ({filho['nome']}) -> {filho['id']}")
    return colisoes


def _percorrer(no: dict):
    yield no
    for f in no["filhos"]:
        yield from _percorrer(f)


def _pai_de(raiz: dict, sigla: str) -> dict | None:
    for n in _percorrer(raiz):
        if any(f["id"] == sigla for f in n["filhos"]):
            return n
    return None


def aplicar(raiz: dict, rel: Relatorio) -> list[str]:
    """Aplica as alterações normativas por ordem. Devolve o registo do que mudou."""
    registo: list[str] = []
    for alt in ALTERACOES:
        op, fonte = alt["op"], alt["fonte"]
        if op == "revoga":
            pai = _pai_de(raiz, alt["sigla"])
            if alt.get("sob") and (pai is None or pai["id"] != alt["sob"]):
                # A sigla repete-se na estrutura; só revoga a que está no pai certo.
                pai = next(
                    (n for n in _percorrer(raiz) if n["id"] == alt["sob"]), None
                )
            alvo = (
                next((f for f in pai["filhos"] if f["id"] == alt["sigla"]), None)
                if pai
                else None
            )
            rel.check(
                f"revoga-{alt['sigla']}",
                alvo is not None,
                f"{alt['sigla']} não existe na árvore base, logo não pode ser revogada",
            )
            if alvo is not None:
                pai["filhos"].remove(alvo)
                registo.append(f"{fonte}: revogada {alt['sigla']} ({alvo['nome']})")
        elif op == "renomeia":
            alvo = next((n for n in _percorrer(raiz) if n["id"] == alt["sigla"]), None)
            rel.check(
                f"renomeia-{alt['sigla']}",
                alvo is not None,
                f"{alt['sigla']} não existe na árvore base",
            )
            if alvo is not None:
                antigo = alvo["nome"]
                alvo["nome"] = alt["nome"]
                alvo["sigla"] = alt.get("nova_sigla", alvo["sigla"])
                alvo["id"] = alvo["sigla"]
                alvo["fonte_id"] = f"{alvo['fonte_id']}+{fonte}"
                registo.append(f"{fonte}: {antigo} passa a {alt['nome']}")
        elif op == "adiciona":
            pai = next((n for n in _percorrer(raiz) if n["id"] == alt["sob"]), None)
            rel.check(
                f"adiciona-{alt['sigla']}",
                pai is not None,
                f"unidade-pai {alt['sob']} não existe na árvore base",
            )
            if pai is not None:
                novo = {
                    "id": alt["sigla"],
                    "sigla": alt["sigla"],
                    "nome": alt["nome"],
                    "tipo": alt["tipo"],
                    "dirigente": None,
                    "competencias": [],
                    "fonte_id": fonte,
                    "filhos": [
                        {
                            "id": s,
                            "sigla": s,
                            "nome": n,
                            "tipo": _tipo(n),
                            "dirigente": None,
                            "competencias": [],
                            "fonte_id": fonte,
                            "filhos": [],
                        }
                        for n, s in alt["filhos"]
                    ],
                }
                pai["filhos"].append(novo)
                registo.append(f"{fonte}: criada {alt['sigla']} ({alt['nome']})")
    return registo


def siglas_do_organograma(caminho: Path) -> set[str]:
    texto = _texto_pdf(caminho)
    return set(re.findall(r"\b([A-Z]{2,8})\b", texto))


def construir() -> int:
    rel = Relatorio()
    avisos: list[str] = []

    caminhos = {f: _raw_de(f) for f in (BASE, ALT1, ALT2, ORGANOGRAMA)}
    if em_falta := [f for f, p in caminhos.items() if p is None]:
        print(
            f"Faltam originais em data/raw/ para {', '.join(em_falta)}. "
            "Corre `make fetch`.",
            file=sys.stderr,
        )
        return 1
    validos = mod_fontes.ids_validos()
    for f in caminhos:
        if f not in validos:  # V6
            print(f"V6: fonte_id {f} não resolve em fontes.json", file=sys.stderr)
            return 1

    raiz = arvore_base(_texto_pdf(caminhos[BASE]))
    registo = aplicar(raiz, rel)

    colisoes = desambiguar_ids(raiz)
    nos = list(_percorrer(raiz))
    siglas = {n["sigla"] for n in nos if n["sigla"] and n["sigla"] != "CMG"}
    ids = [n["id"] for n in nos]
    rel.check("arvore-nao-vazia", len(siglas) > 20, f"só {len(siglas)} unidades")
    rel.check(
        "ids-unicos",
        len(set(ids)) == len(ids),
        "há ids repetidos na árvore depois da desambiguação",
    )
    if colisoes:
        avisos.append(
            "Siglas reutilizadas pela CMG em unidades diferentes, desambiguadas "
            "com o prefixo da unidade-mãe: " + "; ".join(colisoes)
        )

    # Verificação cruzada com o organograma publicado pela CMG.
    # É esta que apanha um erro na aplicação das alterações: se uma unidade
    # ficou a mais ou a menos, deixa de bater com o diagrama oficial.
    do_organograma = siglas_do_organograma(caminhos[ORGANOGRAMA])
    if ausentes := sorted(siglas - do_organograma):
        avisos.append(
            "Unidades na árvore normativa que não aparecem no organograma "
            f"publicado ({ORGANOGRAMA}): {', '.join(ausentes)}. O texto normativo "
            "prevalece, mas a divergência fica registada."
        )
    # O sentido inverso é o que apanha uma unidade PERDIDA na extração — foi
    # assim que se descobriu que a Divisão de Mobilidade e os dois gabinetes
    # na sua dependência tinham desaparecido por não terem sigla no DR.
    if sobra := sorted(s for s in do_organograma - siglas if 2 <= len(s) <= 8):
        avisos.append(
            f"Siglas no organograma publicado sem correspondência na árvore "
            f"normativa: {', '.join(sobra)}. Verificar se é unidade perdida na "
            "extração ou sigla que o texto normativo não atribui."
        )

    if not rel.passou:
        print("Validações falhadas — nada foi escrito:", file=sys.stderr)
        for f in rel.falhas:
            print(f"  {f}", file=sys.stderr)
        return 1

    saida = {
        "_meta": {
            "gerado_em": datetime.now(timezone.utc).isoformat(),
            "script": "etl/estrutura_organica.py",
            "versao_modelo": VERSAO_MODELO,
            "fontes": [BASE, ALT1, ALT2, ORGANOGRAMA],
            "cadeia_normativa": [
                f"{BASE}: Despacho n.º 14897/2022, de 30-12-2022 (estrutura base)",
                f"{ALT1}: Despacho n.º 6751/2024, de 17-06-2024",
                f"{ALT2}: Despacho n.º 9070/2024, de 09-08-2024",
            ],
            "alteracoes_aplicadas": registo,
            "avisos": avisos,
        },
        "total_unidades": len(siglas),
        "arvore": raiz,
    }
    destino = PROCESSED / "estrutura_organica.json"
    destino.write_text(
        json.dumps(saida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Escrito {destino}")
    print(f"  {len(siglas)} unidades orgânicas")
    for r in registo:
        print(f"  {r}")
    print(f"\nValidações passadas: {', '.join(rel.ok)}")
    for a in avisos:
        print(f"aviso: {a}")
    return 0


if __name__ == "__main__":
    raise SystemExit(construir())
