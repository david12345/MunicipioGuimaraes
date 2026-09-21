# Qualidade dos dados e lacunas conhecidas

Última atualização: 2026-09-21 · Fase 2 (secções 2, 3, 4, 5, 8, 9, 10 e população).

Este ficheiro regista **tudo o que não foi possível obter ou validar**. É um
entregável tão importante como os dados: o dashboard mostra "Dado não disponível"
sempre que uma lacuna aqui registada afetar um indicador.

## Lacunas bloqueantes

**Nenhuma neste momento.** L1 e L2, que bloqueavam a Fase 1, foram resolvidas —
o histórico fica registado abaixo porque explica porque é que `data/raw/` esteve
vazio e porque é que o executivo não foi publicado mais cedo.

### L1 — Bloqueio de acesso às fontes · **RESOLVIDA em 2026-09-21**

O ambiente remoto onde a Fase 1 correu encaminhava todo o tráfego HTTPS por um
proxy de egresso cuja política rejeitava (403 ao CONNECT) **todos** os domínios de
dados do projeto: `cm-guimaraes.pt`, `dados.gov.pt`, `base.gov.pt`, `dgal.gov.pt`,
`dre.pt`, `ine.pt`, `pordata.pt`, `cne.pt`. O bloqueio abrangia `curl` e a
ferramenta de *fetch* do agente. Não houve qualquer tentativa de o contornar: em
vez de preencher o dashboard com números de resultados de pesquisa — o que violaria
a regra 1 —, a Fase 1 entregou inventário, modelo de dados e pipeline executável.

Foi aplicada a via 2 das então propostas: **correr o ETL numa máquina com rede
aberta**. `make fetch` descarregou as 19 fontes (9 do inventário + 10 descobertas),
e `make check-acesso` dá 19/19 alcançáveis.

Duas falhas que pareciam política de rede eram afinal configuração das fontes:

| Fonte | Sintoma | Causa real |
|---|---|---|
| S27 (DGAL) | `SSLError` | Servem certificado `*.dgal.gov.pt`, que **não cobre** `www.portalautarquico.dgal.gov.pt` — o *wildcard* só cobre um nível. Sem o `www.` verifica. Corrigido no URL, **sem desativar a verificação de TLS** |
| S32 (INE) | `ConnectionError` | Rejeita `HEAD`. O `check-acesso` passou a usar `GET` em *streaming* |

### L2 — Mandato 2025–2029 não confirmado · **RESOLVIDA em 2026-09-21**

A regra 5 está cumprida. A composição do executivo e os resultados eleitorais foram
lidos nas páginas do próprio Município (S02 e S01), não em imprensa:

- Coligação "Juntos por Guimarães" (PPD/PSD.CDS-PP): 45,33%, **6 mandatos**
- PS: 37,50%, **4 mandatos** · Chega (CH): 8,06%, **1 mandato** · total **11**
- Presidente: Ricardo José Machado Pereira da Silva Araújo, desde 25-10-2025

Duas validações cruzadas passam: a soma dos mandatos (6+4+1) iguala o total
declarado (11), e a lista nominal tem exatamente 11 membros. O que a pesquisa da
Fase 1 indicava bateu certo, mas **os valores publicados vêm da fonte primária**.

Subsistem lacunas na secção, agora registadas como L15–L17.

## Lacunas estruturais (independentes de L1)

Estas persistem mesmo com acesso à rede e condicionam o desenho do dashboard.

| ID | Lacuna | Impacto | Mitigação |
|---|---|---|---|
| L3 | ~~Documentos previsionais (S08) sem URL~~ · **RESOLVIDA** (o Balanço Social, S19, continua por localizar) | — | O arquivo é `/publicacoes/gestao-e-financas/dados-economico-financeiros` (`S39`), alcançado pelo ponto **8.1 do Índice de Transparência Municipal**. Árvore de pastas ano → tipo, com ids opacos e paginação. De lá saíram `S08-2021`…`S08-2026` e a série de Relatórios e Contas de 2021 a 2025 |
| L4 | ~~Organograma (S03) pode ser imagem~~ · **RESOLVIDA** | — | O `organograma_06_24.pdf` da CMG (`S03-06_24`) **tem camada de texto**, com nomes e siglas das unidades, e já reflete o Despacho 9070/2024. Continua a servir de verificação cruzada, não de fonte: a hierarquia sai do texto normativo (S05+S06), que é o que tem valor legal. O organograma anexo ao próprio despacho **é imagem** |
| L5 | ~~Estrutura orgânica de 2023 alterada em 2024~~ · **RESOLVIDA** | Usar só S05 produz um organograma **errado** | Despacho n.º 9070/2024 localizado e descarregado (DR 2.ª série n.º 154, 09-08-2024), via a página S04 da CMG. Altera os artigos 5.º, 30.º e 31.º, **adita** o artigo 54.º-A (Gabinete de Apoio à Intervenção Social) e **revoga** o artigo 56.º, a alínea h) do 30.º e a c) do 31.º. Aplicar sobre S05 continua a ser obrigatório antes de publicar a secção 3 |
| L6 | ~~Mapa de Pessoal possivelmente digitalizado~~ · **RESOLVIDA** | — | O de 2026 tem camada de texto; `pymupdf` chega e o `camelot`/OCR não foi preciso. O risco de colunas trocadas é coberto por validação: as linhas de cada unidade têm de reconstituir o `TOTAL` que o próprio documento imprime, nas 9 colunas — 63 verificações, todas a passar. Um mapa digitalizado de outro ano voltará a exigir OCR |
| L7 | API do Portal BASE exige autorização do IMPIC (S24) | Sem credencial, não há atualização diária | Usar o dataset semanal do dados.gov (S23), que não exige credencial; assumir desfasamento até 7 dias e mostrá-lo no dashboard |
| L8 | NIF das empresas municipais desconhecidos | Sem eles não se filtram os contratos das participadas no BASE | Extrair o perímetro de consolidação de S11 e resolver cada NIF antes do ETL de contratos |
| L9 | Duas convenções de URL no site da CMG (`/uploads/` e `/cmguimaraes/uploads/`) | Um crawler que assuma um único padrão perde documentos antigos | O `fetch` aceita ambos os padrões (ver `etl/common/fetch.py`) |
| L10 | ~~Moradas dos equipamentos em texto livre~~ · **RESOLVIDA** | — | Não é preciso geocodificar: cada ficha de equipamento da CMG publica `data-lat`/`data-long` na origem. Dispensa o Nominatim e a V8. O que se valida é que a coordenada é plausível (bloqueante) e se cai dentro do concelho (informativo) |
| L11 | Comparação entre municípios (secção 11) | Extrações próprias de PDF de municípios diferentes não são comparáveis | Usar exclusivamente séries já normalizadas da DGAL (S27); não misturar com extrações próprias |
| L12 | Séries históricas com mudanças de classificação (POCAL → SNC-AP) | Evolução plurianual pode mostrar "saltos" que são artefactos contabilísticos | Marcar a quebra de série no gráfico e explicá-la no glossário |
| L13 | URL exato dos quadros da DGAL (S27) por localizar | Sem ele não há secção 11 (comparar municípios) | Varrer `portalautarquico.dgal.gov.pt` (sem `www.`) pela secção de finanças locais |
| L14 | ~~Série de população do INE por localizar~~ · **RESOLVIDA** | — | Indicador **0012918** (NUTS 2024), Guimarães = `geocod` 1190308, **2021–2025**. Em `populacao.json`, com V5 e V7 a passar. O INE voltou a responder no fim da sessão e o `fetch` apanhou-o |
| L15 | Edital de Apuramento Geral (S17) devolve **404** | Perde-se a fonte local com valor legal para os resultados de 2025 | O URL publicado pela CMG está morto. Os resultados vieram de S02; pedir o edital por LADA ou localizar o novo URL |
| L16 | Composição da Assembleia Municipal por força política **não publicada** | O hemiciclo da secção 2 não pode ser desenhado | A CMG publica só a dimensão (111 = 56 eleitos + 55 presidentes de junta por inerência). Obter de S16-DRE (exige OCR, L17) ou da CNE |
| L17 | Mapa Oficial n.º 2-B/2025 (S16-DRE) é **digitalizado** | 611 páginas sem camada de texto a partir da 3.ª: não é extraível por *parsing* | Confirmado com `pymupdf`: 0 caracteres e 1 imagem por página. Exige OCR (`ocrmypdf`/`tesseract`) e, tratando-se de fonte com valor legal, **revisão humana do que o OCR devolver** |
| L18 | Ligação ao registo no Portal BASE (`url_base`) **não verificável** | Um *deep link* errado levaria o cidadão ao contrato errado | O padrão `detalhe/?type=contratos&id=<idcontrato>` é o do portal, mas a página é renderizada no cliente: um id inexistente também devolve 200 e HTML idêntico. Fica publicado com o aviso no `_meta` de cada `contratos_<ano>.json`. Confirmar quando houver credencial da API do IMPIC (S24) |
| L19 | **Preço total efetivo desconhecido na maioria dos contratos** | O dashboard pode mostrar o que foi *contratado*, **não** o que foi de facto *gasto* | O BASE publica `0` neste campo enquanto o contrato não é fechado: em 2023 eram 435 de 519 contratos, todos com preço contratual positivo. Esse `0` é convertido em `null` (nunca publicado como zero euros) e o número de casos consta dos avisos. A execução real só se obtém do Relatório e Contas (S10) |
| L20 | Entidades participadas **sem NIPC** na fonte (S11) | Não são filtráveis no dataset do BASE: contratos seus ficam de fora | São entidades internacionais (ICLEI, AICE, CIUMED). Nenhuma está no perímetro de consolidação, pelo que não afeta os totais publicados |
| L21 | Série de população começa em **2021**; contratos começam em 2019 | **Não há métricas per capita para 2019 e 2020**, nem para 2026 | O indicador 0012918 (NUTS 2024) cobre 2021–2025. O 0008273 (NUTS 2013) cobre 2011–2023 e daria 2019–2020, mas perdia 2024 e 2025 — e **misturar as duas séries viola a V7**. Escolheu-se a recência. Para 2026 não há população: ou se usa 2025 dizendo-o, ou fica `null` |
| L22 | A cadeia normativa da estrutura orgânica tinha **um elo em falta** | Sem ele, o organograma perderia um departamento inteiro e três divisões | O inventário supunha `S05 + S06`. Falta o **Despacho n.º 6751/2024** (`S38`, DR 17-06-2024), que cria o Dep. de Inovação, Transformação Digital e Economia e renomeia o Dep. de Cultura, Economia e Inovação para Dep. de Cultura e Turismo. **Não está ligado em nenhuma página da CMG** — foi encontrado por pesquisa e confirmado no DR. Pista que o denunciou: em S05 o Dep. de Intervenção Social é a alínea h) do art. 5.º, em S06 é a i) |
| L23 | A CMG **reutiliza siglas** entre unidades diferentes | Uma árvore chaveada pela sigla junta unidades distintas ou perde-as | `DF` é Departamento Financeiro **e** Divisão de Fiscalização; `DE` é Divisão de Empreitadas **e** Divisão de Educação; depois de 2024, `DCT` é Departamento de Cultura e Turismo **e** Divisão de Contabilidade e Tesouraria. O `id` da árvore é qualificado com a unidade-mãe nas colisões; a `sigla` publicada fica num campo à parte |
| L24 | Divergências entre o texto normativo e o organograma publicado | Pequenas, mas não devem ser corrigidas em silêncio | O DR escreve `(DCG)` para o Gabinete de Contabilidade de Gestão, o organograma escreve `GCG`. O DR **não atribui sigla** à Divisão de Mobilidade, que o organograma trata por `DM` — no JSON a `sigla` fica `null`, não é copiada do organograma. O texto normativo prevalece; as divergências constam dos avisos do ficheiro |
| L25 | GOP e Orçamento de **2021** integralmente digitalizado | Sem orçamento previsto de 2021; a série começa em 2022 | O PDF tem 663 páginas e **zero caracteres** de camada de texto. O de 2025 é maioritariamente imagem mas o mapa-resumo é texto, pelo que passa. Exige OCR com revisão, como L17 |
| L26 | Os documentos previsionais são **mistos**: texto e imagem | Só os mapas com camada de texto são extraíveis | Em 2026, 423 das 948 páginas quase não têm texto. O mapa "Resumo da Receita e da Despesa" é texto em 2022–2026 e concentra os agregados; os mapas detalhados de rubrica e o PPI estão em grande parte digitalizados, e por isso a secção 7 (investimentos) ainda não foi tentada |
| L27 | Totais de **receita cobrada** e **despesa paga** não publicados com rótulo | O dashboard mostra o *grau* de execução e os agregados correntes, não o total gasto | Nos Relatórios e Contas os totais existem nos mapas de execução, mas em linhas **sem rótulo**, identificadas só pela posição na página. Extraí-los seria adivinhar. O que é rotulado — e extraído — é a tabela "Principais indicadores orçamentais" e o quadro do equilíbrio orçamental |
| L28 | O Relatório e Contas de **2022** codifica o euro como `¬` | Um extrator que procure `€` não encontra valor nenhum nesse ano | Problema de mapeamento de glifo na fonte do PDF. O parser aceita os dois símbolos |
| L29 | **Instalações desportivas não constam** dos equipamentos | Piscinas, pavilhões e campos ficam de fora da secção 10 | São geridas pela **Tempo Livre**, cooperativa do perímetro de consolidação, e o sítio do município não as lista. Obtê-las exigiria ir ao sítio da Tempo Livre, que é outra entidade e outra fonte |
| L30 | Uma ficha de equipamento aponta para **fora do concelho** | Incluí-la no enquadramento do mapa afastava a vista 20 km | O **IPDJ Braga** é listado pela CMG como contacto de apoio à juventude. É uma ficha legítima, não um erro: fica com `no_concelho: false`, aparece no mapa e na lista assinalado, mas não enquadra a vista |
| L31 | Três equipamentos **sem coordenadas** na fonte | Não aparecem no mapa | ASMAV, Centro de Criação de Candoso e Cine Clube de Guimarães. Constam da lista com morada e contacto, e o cartão diz que a localização não está disponível — não são geocodificados a partir da morada |
| L32 | **Financeiro por entidade participada** não consta do relatório consolidado | A secção 9 mostra o perímetro e os agregados do grupo, não o volume de negócios ou o resultado de cada entidade | O Relatório de Contas Consolidadas **consolida, não desagrega**. Obter o financeiro de cada uma exigiria as contas próprias das onze entidades do perímetro — onze fontes diferentes, algumas provavelmente não publicadas em linha |

### Verificação — não há reestruturação orgânica de 2026 em Guimarães

Ao procurar o elo em falta da estrutura orgânica (L22), motores de busca
devolveram dois documentos que pareciam ser uma reestruturação de 2026 do
Município de Guimarães. **Não são.** Confirmado nos sumários do Diário da
República, que são fonte primária e listam cada ato com a entidade emissora:

| Documento | DR | Entidade real |
|---|---|---|
| Regulamento n.º 83/2026 — *Regulamento Interno dos Serviços Municipais e Estrutura Orgânica para 2026* | 2.ª série n.º 16, 23-01-2026 | **Município de Alfândega da Fé** |
| Despacho n.º 3836/2026 — equiparação do coordenador municipal de proteção civil e criação de unidades orgânicas | 2.ª série n.º 58, 24-03-2026 | **Município da Amadora** |

É o caso exemplar da regra 1: o resumo do motor de busca juntou atos de três
municípios diferentes numa narrativa plausível sobre Guimarães. Só a leitura do
sumário oficial desfez o engano.

Três indícios primários confirmam que a estrutura em vigor é a de 2024:

1. A página do organograma da CMG serve hoje `organica_2023.pdf` e
   `organograma_06_24.pdf` — não há documento posterior.
2. A página S04 (setembro de 2024) descreve o Despacho 9070/2024 como a
   alteração mais recente.
3. O **Mapa de Pessoal 2026**, publicado pela própria CMG, organiza-se pelas
   unidades posteriores ao Despacho 6751/2024 (incluindo o Departamento de
   Cultura e Turismo) e não conhece nenhum departamento novo.

**A confirmar antes da Fase 3**, por não ser possível excluir por estes meios
uma alteração publicada e ainda não refletida no site.

### Nota operacional — o INE bloqueia quem insiste

Ao procurar a série de população (L14) encadearam-se pedidos rápidos à API do INE
(`json_indicador/pindica.jsp`). O primeiro devolveu **429 Too Many Requests** e, a
partir daí, **todo o host `www.ine.pt` passou a dar `ConnectTimeout`** — incluindo a
homepage, que minutos antes respondia 200 e chegou a ser descarregada para
`data/raw/`. Cinco tentativas espaçadas não recuperaram o acesso.

Não se tentou contornar o bloqueio. Para quem retomar isto:

- **Um pedido de cada vez, com pausa entre eles.** A API do INE é generosa no
  conteúdo mas intolerante à cadência.
- O **catálogo do dados.gov responde normalmente** e é onde se descobrem os
  indicadores sem tocar no INE — foi assim que 0012918 foi identificado.
- O `fetch` é idempotente: quando o acesso voltar, `make fetch` apanha S32 e mais
  nada. Não é preciso repetir a pesquisa, que está registada em `sources.yaml`.

## Validações do ETL

São automáticas e **bloqueantes**: uma extração que falhe não é publicada.

**Executadas até agora**, todas a passar:

| Secção | Parser | Validações |
|---|---|---|
| 2 · Quem governa | `etl/quem_governa.py` | V1 em duas formas (soma dos mandatos = total declarado; lista nominal = mesmo total) e V6 |
| 8 · Contratos | `etl/contratos.py` | **V4** nos oito anos (2019–2026), V6, e unicidade do NIF do Município no dataset |
| 9 · Participadas | `etl/empresas_participadas.py` | V6, "toda a entidade no perímetro tem NIPC" — é essa que garante que o filtro dos contratos não perde entidades — e a **identidade do balanço** (ativo = passivo + património líquido) nos cinco anos consolidados |
| 4 · Quem lá trabalha | `etl/mapa_pessoal.py` | **V3**, V6, e 63 verificações de total (7 unidades × 9 colunas) contra o `TOTAL` impresso no documento |
| 3 · Como está organizada | `etl/estrutura_organica.py` | V6, unicidade dos `id`, existência do alvo de cada alteração normativa, e **verificação cruzada nos dois sentidos** contra o organograma publicado |
| 5 · De onde vem o dinheiro | `etl/orcamento.py` | **V2** nos cinco anos (receita total = despesa total, por imposição legal), **V1** em quatro formas por ano, V6, e a regra do equilíbrio orçamental do art. 40.º do RFALEI em cada ano de execução |
| 10 · Equipamentos | `etl/equipamentos.py` | V6, propriedade conhecida em todas as fichas, e coordenadas plausíveis (bloqueante). Substitui a V8, que pressupunha geocodificação |
| transversal · População | `etl/populacao.py` | **V5**, **V7**, V6, soma homens+mulheres = total em cada ano, e soma dos grupos etários = total do ano |

V4 estava especificada desde a Fase 1 mas não implementada; foi escrita com o
parser dos contratos (`v4_soma_por_adjudicatario` em `etl/common/validate.py`).
As restantes aguardam os parsers das secções respetivas.

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
