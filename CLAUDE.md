# Dashboard do Município de Guimarães — contexto do projeto

Dashboard web público sobre a Câmara Municipal de Guimarães (CMG), para o cidadão
comum: organização, governo, pessoal, receita e despesa, contratos, obras,
equipamentos. Site estático, sem backend.

## Regras invioláveis

Estas vêm do briefing e **não se negoceiam**. Na dúvida, escolhe sempre não publicar.

1. **Não inventar dados.** Cada número vem de uma fonte pública identificada. Sem
   fonte → o dashboard mostra **"Dado não disponível"** e a lacuna é registada em
   `docs/qualidade_dados.md`. Nunca preencher com estimativas sem as marcar como tal.
   Resumos de motor de busca, Wikipédia e notícias **não são fonte** para um número.
2. **Rastreabilidade total.** Todo o registo tem `fonte_id` que resolve contra
   `fontes.json` (validação V6). Cada gráfico/tabela mostra nome do documento, URL,
   data de publicação e ano de referência.
3. **Guardar os originais** em `data/raw/`, com o nome original e a data de download.
4. **Pipeline reprodutível**: a extração é script re-executável, não trabalho manual.
5. **Confirmar o mandato atual** (2025–2029) em fontes oficiais, não em conhecimento
   prévio nem em imprensa. Houve autárquicas em outubro de 2025.
6. **Laptop e telemóvel**: nenhuma secção está concluída sem funcionar bem nos dois.
7. **Sem dados pessoais** além de titulares de cargos públicos publicados pela CMG.
   `mapa_pessoal.json` só tem agregados — nunca uma linha por trabalhador, mesmo que
   a fonte a traga.

## Estado atual

**Fase 2 em curso. Três secções extraídas: 2 (quem governa), 8 (contratos), 9
(participadas).** Não há dashboard — a Fase 3 está por começar.

`make check-acesso` dá **19/19**. 22 fontes em `data/raw/` com `sha256` verificado.
Em `data/processed/`: `fontes.json`, `executivo.json`, `orgaos_eleitos.json`,
`empresas_municipais.json` e `contratos_2019.json`…`contratos_2026.json`
(4 110 contratos, 441,1 M€ contratados entre 2019 e 2026).

**L1 e L2 estão resolvidas** (ver `docs/qualidade_dados.md`): o bloqueio de rede
era do ambiente da Fase 1, não das fontes, e a regra 5 está cumprida com leitura
da fonte primária. Restam L13–L17, nenhuma bloqueante para o ETL.

**`data/raw/` no git:** commitam-se os **originais municipais** (~22 MB) — é neles
que a regra 3 tem valor, porque a CMG substitui PDF mantendo o URL. Os **datasets
nacionais** (~515 MB: contratos do BASE, Mapa Oficial do DR) ficam no `.gitignore`;
commita-se o `.meta.json` com URL e `sha256`, que os reproduz com `make fetch` e
mantém a integridade verificável. **Não usar Git LFS** — os contratos são
republicados semanalmente e esgotariam a quota.

**Próximo passo:** os parsers que faltam. Os originais já estão em disco, por isso
a extração não precisa de rede. Mapa de pessoal (S07-2026), estrutura orgânica
(S05+S06 — falta o URL de S06), orçamento (S10; falta S08, sem URL, L3).

**NIF do Município: `505948605`** (resolvido do dataset do IMPIC, único nos 8 anos).
Os NIF do perímetro saem de `empresas_municipais.json` — é por isso que
`make contratos` depende de `make empresas`.

## Comandos

```bash
make setup        # cria .venv e instala requests + PyYAML
make check-acesso # diz que fontes estão alcançáveis daqui; sai com 1 se alguma falhar
make fetch        # descarrega originais para data/raw/, com descoberta de 2.º nível
make fontes       # gera data/processed/fontes.json
make quem-governa # extrai a secção 2
make etl          # fetch + fontes + parsers existentes
make setup-parse  # dependências de extração (Fase 2; camelot exige ghostscript)
```

Correr `make check-acesso` primeiro em qualquer ambiente novo. O Python do sistema
é gerido externamente (PEP 668): **tudo corre no `.venv`**, que o `make setup` cria.

## Estrutura

```
data/raw/        originais + sidecar .meta.json (url, sha256, data_download)
data/processed/  JSON normalizado, um ficheiro por secção do dashboard
etl/
  sources.yaml   registo das fontes (12 com URL; o inventário tem 37)
  descobertas.yaml  GERADO: fontes derivadas das páginas-índice; commitado de
                 propósito, porque é no diff que se vê um URL a mudar
  run.py         orquestrador: --fase fetch|fontes, --check-acesso
  quem_governa.py   parser da secção 2
  common/        fetch.py (idempotente), descoberta.py, fontes.py, validate.py, paths.py
docs/            fontes.md, modelo_dados.md, qualidade_dados.md
src/             dashboard estático — Fase 3, por construir
```

## Documentos a ler antes de mexer

| Ficheiro | Porquê |
|---|---|
| `docs/fontes.md` | As 36 fontes e, para cada uma, **o que foi mesmo verificado** (coluna *Verificação*: `PRIM` = confirmado na fonte primária; nenhuma linha está em `PRIM`) |
| `docs/modelo_dados.md` | Esquemas JSON, convenções e **4 questões em aberto por decidir** |
| `docs/qualidade_dados.md` | Bloqueios (L1, L2), 12 lacunas estruturais, 8 validações do ETL |

## Convenções

- **Tudo em português europeu**: interface, documentação, commits, comentários.
- Chaves e enums em `snake_case` sem acentos; rótulos legíveis (com acentos) só na
  camada de apresentação.
- Valores monetários: `number` com 2 casas, em euros, **sem formatação nos dados**.
  A formatação portuguesa (`1 234 567,89 €`) faz-se com `Intl.NumberFormat('pt-PT')`.
- **`null` = "dado não disponível"** e é renderizado como tal. Nunca `0`, nunca `""`,
  nunca omitir o campo em silêncio. Distinguir "zero euros" de "não sabemos" é a
  diferença entre informar e enganar.
- `ano_referencia` (ano do dado) ≠ `data_publicacao` (data da fonte). Mostrar ambos.
- Commits pequenos e descritivos.

## Validações (em `etl/common/validate.py`)

São **bloqueantes**: uma extração que falhe não é publicada; regista-se a
discrepância em `docs/qualidade_dados.md` e o indicador fica `null`.

V1 soma == total declarado (±0,01 €) · V2 receita == despesa (o orçamento é
equilibrado por lei) · V3 ocupados ≤ previstos · V4 soma por adjudicatário == total ·
V5 série sem anos em falta · V6 `fonte_id` resolve · V7 população de uma única série ·
V8 % de geocodificação (< 80% exige revisão).

O `fetch` guarda `sha256` de cada original — é assim que se deteta que uma autarquia
**substituiu um PDF em silêncio mantendo o URL**, prática comum nos sites autárquicos.

## Armadilhas conhecidas

- **Regra 5 cumprida** para a Câmara, **não** para a Assembleia. O executivo
  2025–2029 está verificado em S02 e S01 (páginas do próprio Município) e publicado
  em `data/processed/`. Mas a **composição da Assembleia Municipal por força
  política continua em branco** (L16): a CMG só publica a dimensão do órgão — 111
  membros, 56 eleitos e 55 presidentes de junta por inerência. Está no Mapa Oficial
  do DR (S16-DRE), que é **digitalizado** (L17) e exigiria OCR com revisão humana.
  Não preencher o hemiciclo com nada que não venha daí.
- **HTML da CMG parte parênteses ao meio.** `Nome (PS<span>)</span>` vira duas
  linhas ao remover as tags. Isto já atribuiu o e-mail de um vereador a outra
  pessoa. Qualquer parser novo de páginas da CMG deve usar `_juntar_parenteses` de
  `etl/quem_governa.py` e cruzar sempre duas fontes quando existam.
- **Estrutura orgânica:** o documento de 2023 (S05) foi alterado pelo **Despacho
  9070/2024** (S06), que reorganizou os departamentos de Intervenção Social e de
  Recursos Humanos. Usar só o de 2023 produz um organograma errado. Preferir sempre o
  **texto normativo** à imagem do organograma — é mais fiável e é o que tem valor legal.
- **Nem todas as "empresas municipais" o são.** Vimágua, Vitrus e Casfig são empresas;
  Tempo Livre, A Oficina, Taipas Turitermas e Fraterna são cooperativas; Laboratório da
  Paisagem é associação. Tratá-las como equivalentes é factualmente errado — daí o
  campo `natureza` e o nome da secção ser "Empresas e entidades participadas".
- **Contratos do BASE:** filtrar **por NIF, nunca por nome** — já implementado em
  `etl/contratos.py`. Procurar "Guimarães" em 2024 devolve 33 entidades, incluindo
  o hospital, 13 agrupamentos de escolas e o Tribunal da Relação; ao mesmo tempo a
  Vimágua aparece com 4 grafias do mesmo nome. Erraria nos dois sentidos.
- **`PrecoTotalEfetivo` do BASE vem a `0`** enquanto o contrato não é fechado —
  em 2023, 435 de 519 contratos, todos com preço contratual positivo. É convertido
  em `null` (L19). **O dashboard mostra o que foi contratado, não o que foi gasto**;
  a execução real só vem do Relatório e Contas.
- **API do BASE exige credencial** do IMPIC. Usar o dataset semanal do dados.gov
  (S23), que é aberto — custa até 7 dias de desfasamento, a mostrar no dashboard.
- **Comparação entre municípios:** usar só séries já normalizadas da DGAL (S27).
  Extrações próprias de PDF de municípios diferentes não são comparáveis.
- **Quebra de série POCAL → SNC-AP:** pode aparecer como "salto" num gráfico
  plurianual. Marcar no gráfico e explicar no glossário.

## Fases seguintes

**Fase 2 — ETL.** Um parser por fonte em `etl/`, com as validações ligadas.
`pdfplumber`/`camelot` para tabelas em PDF, `ocrmypdf`/`tesseract` se houver
digitalizados, `pandas` para limpeza. Normalizar para `data/processed/` segundo
`docs/modelo_dados.md`, dividido por secção para o telemóvel só descarregar o que abre.

**Fase 3 — Dashboard.** Vite + D3 + Leaflet/OpenStreetMap, estático, deployável em
GitHub Pages. **Mobile-first desde o início**, não adaptado no fim. 12 secções (ver
briefing). Acessível (contraste AA, teclado, tabela de dados por detrás de cada
gráfico), modo claro/escuro, CSV descarregável por gráfico.

Requisitos não negociáveis do responsivo: breakpoints 360–480 / 768 / 1280 px; sem
scroll horizontal na página; D3 com `viewBox` + `ResizeObserver`; **alternativa móvel
para visualizações complexas** (Sankey, sunburst, organograma, hemiciclo) — barras
horizontais, acordeão ou drill-down com os mesmos dados; tooltips por toque; alvos
≥ 44×44 px; lazy loading por secção; primeira vista útil < 3 s em 4G; Lighthouse ≥ 90
em Performance e Acessibilidade no perfil móvel.

**UX:** começar sempre pelo resumo em linguagem simples ("Em 2026, a Câmara prevê
gastar X €, o equivalente a Y € por habitante") e só depois o detalhe. Glossário para
termos técnicos (despesa corrente, GOP, PPI, cabimento, mapa de pessoal).

## Forma de trabalhar

- Trabalhar por fases e mostrar o resultado no fim de cada uma.
- **Fonte inacessível → dizer qual e propor alternativa**, nunca avançar em silêncio
  nem contornar políticas de rede.
