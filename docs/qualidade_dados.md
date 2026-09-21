# Qualidade dos dados e lacunas conhecidas

Última atualização: 2026-09-21 · Fase 1.

Este ficheiro regista **tudo o que não foi possível obter ou validar**. É um
entregável tão importante como os dados: o dashboard mostra "Dado não disponível"
sempre que uma lacuna aqui registada afetar um indicador.

## Lacunas bloqueantes

### L1 — Bloqueio total de acesso às fontes

**Severidade: bloqueante.** Impede as Fases 1 (recolha), 2 (ETL) e a parte de
dados da Fase 3.

O ambiente de execução desta sessão encaminha todo o tráfego HTTPS por um proxy de
egresso com política da organização. Essa política **rejeita (HTTP 403 ao CONNECT)**
todos os domínios de dados públicos do projeto. Verificado a 2026-09-21:

| Domínio | Resultado | Fontes afetadas |
|---|---|---|
| `www.cm-guimaraes.pt` | 403 `connect_rejected` | S01–S22 — **todas as fontes municipais** |
| `www.base.gov.pt` | 403 `connect_rejected` | S24, S25, S26 |
| `dados.gov.pt` | 403 `connect_rejected` | S23, S34 |
| `www.portalautarquico.dgal.gov.pt` | 403 `connect_rejected` | S27 |
| `dre.pt` | 403 `connect_rejected` | S30 |
| `www.ine.pt` | 403 `connect_rejected` | S32 |
| `www.pordata.pt` | 403 `connect_rejected` | S33 |
| `www.cne.pt` | 403 `connect_rejected` | S31 |
| `autarquicas2025.mai.gov.pt` | 403 `connect_rejected` | S31 |
| `en.wikipedia.org` | 403 `connect_rejected` | (contexto) |

O bloqueio abrange `curl` **e** a ferramenta de *fetch* do agente — ambos saem pelo
mesmo proxy. Confirmado em `GET $HTTPS_PROXY/__agentproxy/status`, que lista cada
rejeição como `connect_rejected: "gateway answered 403 to CONNECT (policy denial)"`.

Continuam acessíveis: `pypi.org`, `registry.npmjs.org`, `github.com`,
`raw.githubusercontent.com` — ou seja, **é possível instalar dependências,
desenvolver e publicar código, mas não obter dados**.

A documentação do proxy (`/root/.ccr/README.md`) instrui explicitamente a **não
contornar nem repetir** negações de política, mas a reportá-las. Foi o que se fez:
não houve qualquer tentativa de contornar o bloqueio.

**Consequência assumida:** em vez de preencher o dashboard com números aproximados
— o que violaria a regra 1 do briefing —, esta fase entrega o **inventário, o modelo
de dados e o pipeline executável**, prontos a correr assim que houver acesso.
`data/raw/` e `data/processed/` ficam **vazios por decisão deliberada**, não por
omissão.

**Vias de desbloqueio (por ordem de preferência):**

1. **Autorizar os domínios** na política de egresso do ambiente — a lista da tabela
   acima está pronta a colar. É a única via que torna o pipeline reprodutível
   (regra 4) no próprio ambiente.
2. **Correr o ETL localmente.** O pipeline é Python simples e não depende deste
   ambiente: `make etl` numa máquina com rede aberta produz `data/raw/` e
   `data/processed/`, que se commitam ao repositório.
3. **Carregar os documentos manualmente** para `data/raw/` (arrastando os PDF/XLSX
   para o repositório). Os *parsers* correm sobre ficheiros locais e não precisam de
   rede; só o passo de *download* precisa.

A via 2 é a mais rápida para ter o dashboard com dados reais.

### L2 — Mandato 2025–2029 não confirmado em fonte oficial

**Severidade: bloqueante para a secção "Quem governa".**

A regra 5 exige verificação nas fontes oficiais. As fontes com valor legal — o mapa
oficial homologado publicado pela CMG (S16) e a CNE/MAI (S31) — estão bloqueadas
por L1.

A pesquisa web devolveu uma composição plausível e coerente entre várias notícias
(ver `fontes.md` §6), mas **resultados de motor de busca não são fonte primária** e
não satisfazem a regra 5. Esses valores estão registados apenas no inventário, em
prosa e marcados como não verificados; **não foram escritos para `data/processed/`**
e não alimentam o dashboard.

**Lacuna adicional:** a composição da **Assembleia Municipal** eleita em 2025 não
foi apurada por nenhuma via — nem sequer indicativamente.

## Lacunas estruturais (independentes de L1)

Estas persistem mesmo com acesso à rede e condicionam o desenho do dashboard.

| ID | Lacuna | Impacto | Mitigação |
|---|---|---|---|
| L3 | Secção de documentos previsionais (S08) e Balanço Social (S19) sem URL localizado | Sem Orçamento/GOP/PPI não há secções 1, 5, 6 e 7 do dashboard | Varrimento da secção de gestão financeira do site; em último recurso, pedido de acesso à informação administrativa (LADA) |
| L4 | Organograma (S03) pode ser imagem | Impede extração automática da estrutura orgânica | Usar o **texto normativo** (S05 + S06) como fonte, não a imagem — é mais fiável e é o que tem valor legal |
| L5 | Estrutura orgânica de 2023 alterada em 2024 (S06) | Usar só S05 produz um organograma **errado** | Aplicar obrigatoriamente o Despacho 9070/2024 antes de publicar a secção 3 |
| L6 | Mapa de Pessoal em PDF, possivelmente digitalizado | Tabelas largas: risco de colunas trocadas ou perdidas | `camelot` (lattice→stream) com validação de somas; OCR (`ocrmypdf`) se necessário; **qualquer discrepância de total bloqueia a publicação** |
| L7 | API do Portal BASE exige autorização do IMPIC (S24) | Sem credencial, não há atualização diária | Usar o dataset semanal do dados.gov (S23), que não exige credencial; assumir desfasamento até 7 dias e mostrá-lo no dashboard |
| L8 | NIF das empresas municipais desconhecidos | Sem eles não se filtram os contratos das participadas no BASE | Extrair o perímetro de consolidação de S11 e resolver cada NIF antes do ETL de contratos |
| L9 | Duas convenções de URL no site da CMG (`/uploads/` e `/cmguimaraes/uploads/`) | Um crawler que assuma um único padrão perde documentos antigos | O `fetch` aceita ambos os padrões (ver `etl/common/fetch.py`) |
| L10 | Moradas dos equipamentos em texto livre | Geocodificação falha ou devolve pontos errados | Cachear respostas do Nominatim, registar taxa de sucesso e **marcar no mapa** os pontos de baixa confiança em vez de os esconder |
| L11 | Comparação entre municípios (secção 11) | Extrações próprias de PDF de municípios diferentes não são comparáveis | Usar exclusivamente séries já normalizadas da DGAL (S27); não misturar com extrações próprias |
| L12 | Séries históricas com mudanças de classificação (POCAL → SNC-AP) | Evolução plurianual pode mostrar "saltos" que são artefactos contabilísticos | Marcar a quebra de série no gráfico e explicá-la no glossário |

## Validações a implementar no ETL (Fase 2)

Nenhuma pôde ser executada nesta fase — não há dados. Ficam especificadas para
serem automáticas e **bloqueantes**: uma extração que falhe não é publicada.

| ID | Validação | Critério |
|---|---|---|
| V1 | Soma das rubricas = total declarado no documento | Tolerância de arredondamento: **±0,01 €** |
| V2 | Receita total = Despesa total (orçamento é equilibrado por lei) | Igualdade exata |
| V3 | Mapa de pessoal: postos ocupados ≤ postos previstos, por unidade | Sempre verdadeiro; violação = erro de extração |
| V4 | Contratos: somatório por adjudicatário = total do filtro | Igualdade exata |
| V5 | Cobertura temporal: sem anos em falta no meio de uma série | Série contínua ou lacuna explicitada |
| V6 | Toda a linha de `data/processed/` tem `fonte_id` válido em `fontes.json` | Integridade referencial, 100% |
| V7 | Valores per capita usam sempre a mesma série de população | Um único `populacao.json` partilhado |
| V8 | Geocodificação: % de equipamentos com coordenadas | Registar; < 80% exige revisão manual |

## Princípio de publicação

Um indicador só aparece no dashboard se: **(a)** tiver `fonte_id` rastreável,
**(b)** passar as validações aplicáveis e **(c)** o seu ano de referência for
explícito. Caso contrário, o dashboard mostra **"Dado não disponível"** com ligação
a esta página. Estimativas, se alguma vez existirem, aparecem com rótulo visual
distinto e nunca em cartões de destaque.
