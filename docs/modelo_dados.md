# Modelo de dados — proposta

Última atualização: 2026-09-21 · Fase 1 · **Proposta para aprovação antes da Fase 2.**

## Princípios

1. **Rastreabilidade por construção.** Todo o registo que contenha um número tem um
   campo `fonte_id` que resolve contra `fontes.json`. Um registo sem `fonte_id`
   **não passa** na validação V6 e não é publicado. Não há exceções: é isto que
   torna a regra 2 do briefing verificável por código em vez de por revisão manual.
2. **Um ficheiro por secção do dashboard**, para o telemóvel só descarregar o que
   abre (requisito de *lazy loading*). Ficheiros grandes (contratos) são
   particionados por ano.
3. **Valores monetários em euros, `number`, com 2 casas decimais.** Sem separadores
   nem símbolos nos dados — a formatação portuguesa (`1 234 567,89 €`) é
   responsabilidade da camada de apresentação, via `Intl.NumberFormat('pt-PT')`.
4. **`null` significa "dado não disponível"**, e é renderizado como tal. Nunca `0`,
   nunca `""`, nunca omissão silenciosa do campo. A distinção entre "zero euros" e
   "não sabemos" é a diferença entre informar e enganar.
5. **Nenhum dado pessoal** além de titulares de cargos públicos cujos nomes a CMG
   publica. `mapa_pessoal.json` contém **apenas agregados** — nunca uma linha por
   trabalhador, mesmo que a fonte a traga.
6. Chaves e valores de enumeração em `snake_case` sem acentos; os rótulos legíveis
   (com acentuação) vivem no dashboard, não nos dados.

## Convenções transversais

```jsonc
{
  "_meta": {
    "gerado_em": "2026-09-21T18:00:00Z",   // ISO 8601 UTC
    "script": "etl/orcamento.py",           // quem produziu este ficheiro
    "versao_modelo": "1.0",
    "fontes": ["S08-2026", "S10-2024"],     // fonte_id usados neste ficheiro
    "avisos": []                            // discrepâncias não bloqueantes
  },
  "dados": [ /* ... */ ]
}
```

- `ano_referencia` (integer): o ano a que o **dado** diz respeito.
- `data_publicacao` (date): quando a **fonte** foi publicada. São diferentes e o
  dashboard mostra ambos.
- `estimativa` (boolean, default `false`): se `true`, o dashboard marca visualmente.

## `fontes.json` — a raiz de tudo

Gerado a partir de `docs/fontes.md`; todos os outros ficheiros lhe apontam.

```jsonc
{
  "S10-2021": {
    "id": "S10-2021",
    "nome": "Relatório e Contas 2021",
    "entidade": "Município de Guimarães",
    "url": "https://www.cm-guimaraes.pt/cmguimaraes/uploads/document/file/18944/relatorio_e_contas_2021.pdf",
    "formato": "pdf",
    "ano_referencia": 2021,
    "data_publicacao": "2022-04-28",
    "data_download": "2026-09-21",
    "ficheiro_raw": "data/raw/2026-09-21_relatorio_e_contas_2021.pdf",
    "sha256": "…",                  // prova de que a extração corresponde a este ficheiro
    "periodicidade": "anual",
    "verificacao": "PRIM",
    "limitacoes": "Tabelas em PDF; totais validados contra o mapa resumo."
  }
}
```

O `sha256` é o que permite detetar que uma fonte foi **substituída em silêncio** —
prática comum nos sites autárquicos, onde um PDF é corrigido mantendo o URL.

## Ficheiros por secção

| Ficheiro | Secção do dashboard | Partição | Peso estimado |
|---|---|---|---|
| `visao_geral.json` | 1 · Visão geral | — | < 10 kB |
| `executivo.json` | 2 · Quem governa | — | < 20 kB |
| `orgaos_eleitos.json` | 2 · Quem governa | — | < 15 kB |
| `estrutura_organica.json` | 3 · Como está organizada | — | < 50 kB |
| `mapa_pessoal.json` | 4 · Quem lá trabalha | por ano | < 100 kB/ano |
| `orcamento.json` | 5 · De onde vem o dinheiro | por ano | < 150 kB/ano |
| `orcamento_organico.json` | 5 · De onde vem o dinheiro | — | ~80 kB (5 anos) |
| `investimentos.json` | 7 · Obras e investimentos | — | < 200 kB |
| `contratos_<ano>.json` | 8 · Contratos públicos | **por ano** | ~0,5–2 MB/ano |
| `empresas_municipais.json` | 9 · Empresas participadas | — | < 50 kB |
| `equipamentos.json` | 10 · Equipamentos | — | < 150 kB |
| `comparacao.json` | 11 · Comparar | — | < 50 kB |
| `populacao.json` | transversal (per capita) | — | < 5 kB |
| `fontes.json` | 12 · Fontes e metodologia | — | < 30 kB |

`visao_geral.json` é **derivado** dos restantes (não extraído), para que a primeira
vista útil carregue um ficheiro pequeno e cumpra o objetivo dos 3 s em 4G.

## Esquemas essenciais

### `executivo.json`
```jsonc
{
  "mandato": { "inicio": 2025, "fim": 2029, "tomada_posse": "2025-10-25" },
  "membros": [{
    "nome": "…",
    "cargo": "presidente",              // presidente | vice_presidente | vereador
    "partido": "PPD/PSD.CDS-PP",
    "coligacao": "Juntos por Guimarães",
    "em_permanencia": true,             // vereadores sem pelouro não estão em permanência
    "pelouros": ["…"],                  // lista normalizada
    "foto_url": null,
    "fonte_id": "S01"
  }]
}
```

### `orgaos_eleitos.json`
```jsonc
{
  "camara_municipal": {
    "total_mandatos": 11,
    "resultados": [{
      "forca_politica": "PPD/PSD.CDS-PP",
      "votos": null, "percentagem": null, "mandatos": null,
      "fonte_id": "S16"
    }]
  },
  "assembleia_municipal": { /* idem — inclui presidentes de junta por inerência */ },
  "freguesias": [ /* … */ ]
}
```
> A Assembleia Municipal integra os presidentes de junta **por inerência**. O modelo
> separa `mandatos_eleitos` de `mandatos_inerencia`, senão o hemiciclo fica errado.

### `orcamento.json`
Chave do dashboard. Estrutura **longa** (*tidy*), não larga — permite agregar por
qualquer eixo em D3 sem reprocessar:

```jsonc
{
  "ano_referencia": 2026,
  "linhas": [{
    "fluxo": "despesa",                 // receita | despesa
    "momento": "previsto",              // previsto | executado
    "class_economica_cod": "01.01.04",
    "class_economica_desc": "Remunerações certas e permanentes",
    "nivel": 3,
    "cod_pai": "01.01",
    "class_funcional_cod": "2.1.2",
    "class_funcional_desc": "Educação",
    "corrente_capital": "corrente",     // corrente | capital
    "valor": 12345678.90,
    "fonte_id": "S08-2026"
  }],
  "totais_declarados": {                // transcritos do documento, para a validação V1
    "receita_total": null, "despesa_total": null
  }
}
```

`totais_declarados` é o que permite a V1/V2: comparamos a **nossa** soma com o que o
documento **diz**. Divergência → entrada em `qualidade_dados.md` e o indicador não sai.

### `orcamento_organico.json`
A despesa arrumada por **quem a gasta**, e não por natureza do gasto. Vem do mapa
"Orçamento e plano orçamental plurianual — da despesa" do documento previsional,
onde a classificação orgânica aparece embutida e não resumida.

```jsonc
{
  "primeiro_ano": 2022, "ultimo_ano": 2026,
  "exercicios": [{
    "ano_referencia": 2026,
    "tipo": "previsto",                  // nunca "executado": não há execução por unidade (L37)
    "despesa_total": 220345685.00,       // vem de orcamento.json, e é contra ele que se valida
    "unidades": [{
      "codigo": "0103",                  // código orgânico, e é ele a identidade (nunca o nome)
      "nome": "ORGÃOS DA AUTARQUIA",     // como a fonte o escreve; a maiúscula cai na apresentação
      "nivel": 2,
      "codigo_pai": "01",                // null no 1.º nível
      "total": 6660741.00,
      "unidade_estrutura": {             // ligação a estrutura_organica.json, ou null (L35)
        "id": "GCRP", "sigla": "GCRP", "nome": "Gabinete de Comunicação e Relações Públicas"
      },
      "por_natureza": [                  // classificação económica, capítulo (2 dígitos)
        { "codigo": "01", "nome": "DESPESAS COM O PESSOAL", "valor": 1440630.00 }
      ],
      "rotulos_divergentes": [           // só quando a fonte se contradiz (L34)
        { "nome": "…", "ocorrencias": 1, "primeira_pagina": 102 }
      ]
    }],
    "fonte_id": "S08-2026"
  }]
}
```

**`codigo` é a chave, nunca o `nome`.** A CMG reaproveita códigos entre
reorganizações (L36) e escreve o mesmo nome de maneiras diferentes (L34, L35);
o código é o que a soma das subunidades confirma.

`unidade_estrutura` a `null` quer dizer "o organograma não tem unidade com este
nome", não "não existe" — e é renderizado como tal.

### `mapa_pessoal.json` (só agregados)
```jsonc
{
  "ano_referencia": 2026,
  "postos": [{
    "unidade_organica": "Departamento de Recursos Humanos",
    "unidade_organica_id": "DRH",       // liga a estrutura_organica.json
    "carreira": "Assistente Técnico",
    "categoria": "Assistente Técnico",
    "previstos": 12, "ocupados": 10, "vagos": 2,
    "fonte_id": "S07-2026"
  }]
}
```

### `contratos_<ano>.json`
```jsonc
{
  "ano_referencia": 2025,
  "contratos": [{
    "id_base": "…",
    "objeto": "…",
    "tipo_procedimento": "ajuste_direto",
    "tipo_contrato": "empreitada",
    "adjudicante_nif": "…",
    "adjudicante": "Município de Guimarães",
    "adjudicatario_nif": "…",
    "adjudicatario": "…",
    "valor": 0.00,
    "data_celebracao": "2025-03-14",
    "prazo_execucao_dias": 180,
    "cpv": "…",
    "url_base": "…",                    // ligação ao registo no Portal BASE
    "fonte_id": "S23"
  }]
}
```
> **Nota:** `adjudicatario_nif` é de **pessoa coletiva**, não pessoal — mas
> adjudicatários podem ser empresários em nome individual. Nesses casos o NIF é
> pessoal e **não é incluído**; fica só o nome, que o BASE já publica.

### `equipamentos.json`
```jsonc
{
  "equipamentos": [{
    "nome": "…", "tipo": "desportivo",  // desportivo|cultural|educativo|social|outro
    "morada": "…", "freguesia": "…",
    "lat": null, "lon": null,
    "geocodificacao": {                 // honestidade sobre a qualidade do ponto
      "metodo": "nominatim",
      "confianca": "alta",              // alta | media | baixa | falhou
      "data": "2026-09-21"
    },
    "fonte_id": "S20"
  }]
}
```

### `estrutura_organica.json`
Árvore recursiva, para alimentar diretamente o `d3.hierarchy` da secção 3:
```jsonc
{
  "id": "CMG", "nome": "Município de Guimarães", "tipo": "municipio",
  "filhos": [{
    "id": "DRH", "nome": "Departamento de Recursos Humanos",
    "tipo": "departamento",             // departamento|divisao|unidade|gabinete
    "dirigente": null,                  // só se publicado pela CMG
    "competencias": ["…"],
    "fonte_id": "S05",
    "filhos": []
  }]
}
```

### `empresas_municipais.json`
```jsonc
{
  "entidades": [{
    "nome": "Vitrus Ambiente, EM SA",
    "nif": null,
    "natureza": "empresa_municipal",    // empresa_municipal|empresa_intermunicipal|cooperativa|associacao|fundacao
    "objeto": "…",
    "participacao_municipio_pct": null,
    "no_perimetro_consolidacao": true,
    "orgaos_sociais": [{ "nome": "…", "cargo": "…" }],
    "trabalhadores": null,
    "financeiro_por_ano": [{
      "ano": 2023,
      "volume_negocios": null, "resultado_liquido": null,
      "transferencias_do_municipio": null,
      "fonte_id": "S11-2023"
    }]
  }]
}
```
> A distinção `natureza` é essencial: tratar uma cooperativa como empresa municipal
> seria factualmente errado (ver nota em `fontes.md` §5).

## Fluxo do pipeline

```
  FONTES (web)                data/raw/              data/processed/         src/ (dashboard)
  ───────────                 ─────────              ───────────────         ────────────────
  cm-guimaraes.pt  ──┐                                                       carrega só o
  dados.gov.pt     ──┼─ fetch ─> <data>_<nome>.pdf ─ parse ─> *.json ─ build ─> JSON da
  DGAL / INE       ──┘           + .meta.json       + validate    (gzip)       secção aberta
                                 (sha256, URL,        │
                                  data, fonte_id)     └─ falha ─> docs/qualidade_dados.md
```

Cada passo é idempotente e re-executável (regra 4): `fetch` não volta a descarregar
se o `sha256` não mudou, `parse` reprocessa sempre a partir de `data/raw/`.

## Questões em aberto para decisão

1. **Profundidade da série histórica.** Proposta: **2019–2026** (cobre POCAL→SNC-AP
   com a quebra marcada, e dois mandatos). Mais anos multiplicam o trabalho de
   extração com retorno decrescente. **Já aplicado aos contratos** (`ano_minimo`
   na descoberta de S23); por confirmar para as secções financeiras.
2. **Âmbito dos contratos do BASE.** ~~Proposta~~ **decidido e implementado**:
   Município **+** entidades do perímetro de consolidação, com o campo
   `adjudicante_municipio` (boolean) em cada contrato para o dashboard poder
   separar os dois. O filtro é **por NIF**, nunca por nome — ver a docstring de
   `etl/contratos.py` para a razão.
3. **Municípios de comparação.** Proposta: Braga, V. N. Famalicão, Barcelos — mais
   um agregado "média dos municípios de 100–200 mil habitantes" da DGAL, que é mais
   informativo do que qualquer município isolado.
4. **`estimativa`**: confirmar que o dashboard nunca usa estimativas em cartões de
   destaque, apenas em séries de contexto.
