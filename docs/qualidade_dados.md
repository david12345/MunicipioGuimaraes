# Qualidade dos dados e lacunas conhecidas

Última atualização: 2026-09-21 · Fase 1.5 (pipeline consolidado, secção 2 extraída).

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
| L13 | URL exato dos quadros da DGAL (S27) por localizar | Sem ele não há secção 11 (comparar municípios) | Varrer `portalautarquico.dgal.gov.pt` (sem `www.`) pela secção de finanças locais |
| L14 | URL da série de população do INE (S32) por localizar | **Bloqueia todas as métricas per capita**, que são transversais ao dashboard | Localizar o quadro de estimativas anuais; até lá, nenhum valor per capita é publicado |
| L15 | Edital de Apuramento Geral (S17) devolve **404** | Perde-se a fonte local com valor legal para os resultados de 2025 | O URL publicado pela CMG está morto. Os resultados vieram de S02; pedir o edital por LADA ou localizar o novo URL |
| L16 | Composição da Assembleia Municipal por força política **não publicada** | O hemiciclo da secção 2 não pode ser desenhado | A CMG publica só a dimensão (111 = 56 eleitos + 55 presidentes de junta por inerência). Obter de S16-DRE (exige OCR, L17) ou da CNE |
| L17 | Mapa Oficial n.º 2-B/2025 (S16-DRE) é **digitalizado** | 611 páginas sem camada de texto a partir da 3.ª: não é extraível por *parsing* | Confirmado com `pymupdf`: 0 caracteres e 1 imagem por página. Exige OCR (`ocrmypdf`/`tesseract`) e, tratando-se de fonte com valor legal, **revisão humana do que o OCR devolver** |

## Validações do ETL

São automáticas e **bloqueantes**: uma extração que falhe não é publicada.

**Executadas até agora** (secção 2, `etl/quem_governa.py`): V1 em duas formas —
soma dos mandatos por força política igual ao total declarado, e contagem da lista
nominal igual ao mesmo total — e V6 sobre `S01`, `S02` e `S37`. Todas passam.
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
