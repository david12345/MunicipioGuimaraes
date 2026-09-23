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

**Fase 2 concluída. Fase 3 (dashboard) construída e publicada.**

Nove das doze secções têm dados. As outras três — obras, investimentos e
comparação com outros municípios — existem, dizem "Dado não disponível" e
explicam porquê. Ver `docs/dashboard.md`.

`make check-acesso`: 26 fontes, todas alcançáveis quando o INE responde.
Em `data/processed/`:

| Ficheiro | Conteúdo |
|---|---|
| `executivo.json`, `orgaos_eleitos.json` | 11 vereadores; 45,33% / 6 mandatos à coligação |
| `estrutura_organica.json` | 48 unidades orgânicas |
| `mapa_pessoal.json` | 1 830 postos ocupados de 2 047 previstos (2026) |
| `orcamento.json` | 220,3 M€ previstos para 2026; execução 79–84% (2021–2025) |
| `orcamento_organico.json` | despesa por unidade orgânica, 2022–2026; a DMITAAC leva 63,7% do orçamento de 2026 |
| `contratos_2019…2026.json` | 4 110 contratos, 441,1 M€ |
| `empresas_municipais.json` | 42 entidades, 11 no perímetro; grupo com 647,3 M€ de ativo |
| `equipamentos.json` | 22 equipamentos, 19 com coordenadas |
| `populacao.json` | 165 554 habitantes (2025) |

**L1 e L2 resolvidas.** Das 36 lacunas registadas, 10 estão fechadas; as
restantes são limitações das fontes, não do código.

**`data/raw/` no git:** commitam-se os originais municipais **até ~15 MB**. Ficam
de fora, no `.gitignore`, os datasets nacionais (~515 MB: contratos do BASE, Mapa
Oficial do DR, resposta da API do INE) e os **documentos previsionais** (808 MB,
83–188 MB cada — dois passam o limite rígido de 100 MB/ficheiro do GitHub).
De todos se commita o `.meta.json` com URL e `sha256`: reproduzem-se com
`make fetch` e a substituição silenciosa continua detetável, que é o que dá valor
à regra 3. **Não usar Git LFS** — os contratos são republicados semanalmente e
esgotariam a quota.

**Publicação:** `.github/workflows/publicar.yml` constrói e publica em GitHub
Pages a cada envio. A verificação corre **antes** e bloqueia: um dashboard que
desça de 90 no Lighthouse, que ganhe scroll horizontal ou que perca contraste
não vai para o ar.

**Próximo passo:** não há testes — nem do ETL nem do dashboard. Duas quebras em
tempo de execução escaparam a toda a verificação automática e só apareceram ao
olhar para a página. Um teste de contrato entre os JSON e o que cada secção
espera apanharia essa classe de erro.

Depois disso: o PPI (bloqueado — mapas digitalizados, L26) e os quadros da DGAL
(L13), ambos dependentes de fontes que ainda não estão resolvidas.

## Comandos

```bash
make setup        # cria .venv e instala requests + PyYAML
make check-acesso # diz que fontes estão alcançáveis daqui; sai com 1 se alguma falhar
make fetch        # descarrega originais para data/raw/, com descoberta de 2.º nível
make fontes       # gera data/processed/fontes.json
make etl          # fetch + fontes + todos os parsers
make setup-parse  # dependências de extração (pymupdf, openpyxl)

make dashboard-setup      # npm install
make dashboard            # servidor de desenvolvimento
make dashboard-build      # gera dist/
make dashboard-verificar  # requisitos não negociáveis + Lighthouse
```

`make help` lista os alvos por secção (`make contratos`, `make orcamento`, …).

Correr `make check-acesso` primeiro em qualquer ambiente novo. O Python do sistema
é gerido externamente (PEP 668): **tudo corre no `.venv`**, que o `make setup` cria.

## Estrutura

```
data/raw/        originais + sidecar .meta.json (url, sha256, data_download)
data/processed/  JSON normalizado, um ficheiro por secção do dashboard
etl/
  sources.yaml   registo das fontes escritas à mão (o inventário tem 39)
  descobertas.yaml  GERADO: fontes derivadas das páginas-índice; commitado de
                 propósito, porque é no diff que se vê um URL a mudar
  run.py         orquestrador: --fase fetch|fontes, --check-acesso
  <seccao>.py    um parser por secção (quem_governa, contratos, orcamento, …)
  common/        fetch.py (idempotente), descoberta.py, fontes.py, validate.py, paths.py
docs/            fontes.md, modelo_dados.md, qualidade_dados.md, dashboard.md
src/             dashboard: nucleo/ (figura, gráficos, formato, glossário),
                 seccoes/ (um módulo por secção, carregado a pedido), estilo/
scripts/         copiar-dados.mjs, verificar-ui.mjs
.github/workflows/publicar.yml
```

## Documentos a ler antes de mexer

| Ficheiro | Porquê |
|---|---|
| `docs/fontes.md` | As fontes e, para cada uma, **o que foi mesmo verificado** (coluna *Verificação*; §6-B tem a cadeia normativa da estrutura orgânica, §6-C o arquivo financeiro) |
| `docs/modelo_dados.md` | Esquemas JSON, convenções e **4 questões em aberto por decidir** |
| `docs/qualidade_dados.md` | 32 lacunas (10 resolvidas) e as validações que cada parser corre |
| `docs/dashboard.md` | Decisões de visualização, medições e o que as sustenta |

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
V5 série sem anos em falta · V6 `fonte_id` resolve · V7 população de uma única série.

**V8 caiu**: pressupunha geocodificação, e as coordenadas dos equipamentos vêm
na origem. Em vez dela, valida-se que a coordenada é plausível.

Cada parser acrescenta as suas: a identidade do balanço nas participadas, os
totais por unidade no mapa de pessoal, o equilíbrio do artigo 40.º do RFALEI na
execução orçamental.

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
- **Estrutura orgânica: são TRÊS documentos, não dois.** `S05` (14897/2022) →
  **`S38` (6751/2024)** → `S06` (9070/2024). O elo do meio não está ligado em nenhuma
  página da CMG e cria um departamento inteiro (DITDE) mais o renome de DCEI para
  Dep. de Cultura e Turismo. Todos já em `data/raw/`; ver `docs/fontes.md` §6-B.
- **A CMG reutiliza siglas** (`DF`, `DE`, `DC`, `DCT` designam duas unidades cada) e
  não atribui sigla a todas (a Divisão de Mobilidade não tem). Nunca chavear uma
  estrutura pela sigla — usar o `id` qualificado de `estrutura_organica.json` (L23).
- **População:** série única, indicador INE **0012918**, e cobre **só 2021–2025**.
  Não há per capita para 2019, 2020 nem 2026 (L21). Trocar de indicador implica trocar
  a série toda — misturar viola a V7.
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
- **Classificação orgânica e económica têm códigos do mesmo formato.** No mapa
  da despesa do documento previsional, `01`, `0103` e `010101` tanto podem ser
  orgânicos como económicos: **só a coluna os distingue**, e a coluna muda de ano
  para ano (x≈48,4 em 2022–2025, x≈50,6 em 2026). `etl/orcamento_organico.py`
  calibra as colunas em cada documento; fixá-las lia o mapa errado sem dar sinal.
  A prova de que leu a coluna certa é a soma bater com o `despesa_total` que
  `etl/orcamento.py` extraiu de outro mapa.
- **Ler os mapas por bloco de texto, não por altura.** A CMG usou dois desenhos:
  em 2023 a designação de duas linhas fica **centrada** sobre o código (primeira
  linha acima dele), em 2026 fica alinhada ao topo e a continuação está mais
  perto da linha seguinte do que da sua. Agrupar por `y` erra nos dois.
- **A reorganização de 2023 reaproveitou os códigos orgânicos** (L36): `03` é o
  Departamento de Obras Municipais em 2022 e a DMITAAC a partir de 2023. Nenhuma
  série por código pode atravessar 2022→2023.
- **O documento previsional rotula mal algumas linhas** (L34): uma vez por ano a
  unidade `01` sai com o nome da DMITAAC, e há rubricas económicas com nome de
  unidade orgânica. Os rótulos publicam-se **por maioria do próprio documento**,
  contada sobre o mapa inteiro — dentro de uma unidade só não há maioria.
- **Comparação entre municípios:** usar só séries já normalizadas da DGAL (S27).
  Extrações próprias de PDF de municípios diferentes não são comparáveis.
- **Quebra de série POCAL → SNC-AP:** pode aparecer como "salto" num gráfico
  plurianual. Marcar no gráfico e explicar no glossário.

## Requisitos do briefing que continuam a valer

Estes são critérios de aceitação, não história: aplicam-se a tudo o que se
acrescentar. `make dashboard-verificar` verifica-os por código e **falha** se
algum regredir.

Breakpoints 360–480 / 768 / 1280 px; **sem scroll horizontal** em nenhuma
largura; D3 com `viewBox` + `ResizeObserver`; **alternativa móvel para
visualizações complexas** — o organograma é uma árvore desdobrável e não um
diagrama de caixas, precisamente por isto; tooltips por toque; alvos ≥ 44×44 px
(as ligações dentro de texto corrido estão isentas, WCAG 2.5.8); lazy loading
por secção; primeira vista útil < 3 s em 4G; Lighthouse ≥ 90 em Performance e
Acessibilidade no perfil móvel.

**UX:** começar sempre pelo resumo em linguagem simples ("Em 2026, a Câmara
prevê gastar X €, o equivalente a Y € por habitante") e só depois o detalhe.
Termos técnicos marcados no texto abrem o glossário (`src/nucleo/glossario.js`).

## Forma de trabalhar

- Trabalhar por fases e mostrar o resultado no fim de cada uma.
- **Fonte inacessível → dizer qual e propor alternativa**, nunca avançar em silêncio
  nem contornar políticas de rede.
