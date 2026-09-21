# Inventário de fontes — Câmara Municipal de Guimarães

**Estado:** Fase 2 (secções 2, 3, 4, 8, 9 e população). Última atualização: 2026-09-21.

> ### ⚠️ Como ler este inventário
>
> Este inventário **nasceu sem acesso às fontes**: o ambiente da Fase 1 bloqueava,
> por política de rede, todos os domínios de dados públicos do projeto. Os URLs e
> conteúdos foram então identificados por pesquisa web, não por leitura da fonte.
>
> **Desde 2026-09-21 há acesso** e o pipeline correu: 19 fontes descarregadas para
> `data/raw/` com `sha256`, 19/19 alcançáveis. Mas **só algumas linhas foram
> reconfirmadas** — as que alimentam a secção 2 do dashboard.
>
> A coluna *Verificação* é a única coisa que diz, linha a linha, o que foi mesmo
> confirmado: `PRIM` = conteúdo lido na fonte; `DESC` = ficheiro descarregado, por
> ler; `URL-S`/`EXIST-S`/`CONHEC` = ainda como estava, por confirmar. Uma linha que
> não esteja em `PRIM` **não é dado validado**.
>
> As fontes-filhas descobertas (`S07-2026`, `S16-DRE`, `S23-2019`…`S23-2026`) não
> estão nesta tabela: vivem em `etl/descobertas.yaml`, gerado pelo pipeline.

## Legenda da coluna *Verificação*

| Marca | Significado |
|---|---|
| `URL-S` | URL obtido em resultados de pesquisa; **não aberto**. Pode estar morto ou desatualizado. |
| `EXIST-S` | A existência do documento/secção é referida por resultados de pesquisa; URL exato por confirmar. |
| `CONHEC` | Identificado por conhecimento geral do domínio (estrutura típica das autarquias PT); **a confirmar integralmente**. |
| `DESC` | Original **descarregado** para `data/raw/` com `sha256` registado; conteúdo ainda por ler. Mais forte que `URL-S` (o URL responde e o ficheiro existe), mais fraco que `PRIM`. |
| `PRIM` | Confirmado na fonte primária: o conteúdo foi lido. |

---

## 1. Site institucional da CMG (`cm-guimaraes.pt`)

Entidade responsável: Município de Guimarães. Acesso nesta sessão: **bloqueado**.

| # | Fonte | URL | Formato | Anos | Periodicidade | Conteúdo / indicadores que alimenta | Qualidade e limitações | Verificação |
|---|---|---|---|---|---|---|---|---|
| S01 | Executivo Municipal | `/municipio/camara-municipal/executivo-municipal` | HTML | Mandato corrente | Por mandato | `executivo.json`: nomes, cargos, pelouros, fotos oficiais | Pelouros em prosa, não tabelados → extração frágil, exige parsing manual | `PRIM` |
| S02 | Câmara Municipal (composição) | `/municipio/camara-municipal` | HTML | Corrente | Por mandato | `orgaos_eleitos.json`: composição do órgão executivo | — | `PRIM` |
| S03 | Organograma (índice) | `/municipio/camara-municipal/organograma` | HTML → PDF | Corrente | Irregular | `estrutura_organica.json` (verificação cruzada) | O `organograma_06_24.pdf` (`S03-06_24`) **tem camada de texto**, com nomes e siglas, e já reflete o Despacho 9070/2024. Verificação cruzada, não fonte da hierarquia (L4) | `PRIM` |
| S04 | Estrutura e Organização dos Serviços Municipais (índice) | `/noticia-6/estrutura-e-organizacao-dos-servicos-municipais` | HTML | 2023– | Irregular | Ponto de entrada para o texto normativo no DR | É daqui que se descobre o Despacho 9070/2024 (S06) | `PRIM` |
| S05 | Orgânica dos Serviços Municipais 2023 — Despacho n.º 14897/2022 | `/cmguimaraes/uploads/writer_file/document/9902/organica_2023.pdf` | PDF | 2023 | — | `estrutura_organica.json`: base da hierarquia | **Fonte preferencial** para a hierarquia: texto normativo. **Não basta sozinho** — ver S38 e S06 | `PRIM` |
| S06 | **Despacho n.º 9070/2024** — alteração à estrutura orgânica | `files.diariodarepublica.pt/2s/2024/08/154000000/0041500418.pdf` | PDF | 2024 | — | Reorganiza os Dep. de Intervenção Social e de Recursos Humanos | DR 2.ª série n.º 154, 09-08-2024. Altera os art. 5.º, 30.º e 31.º, adita o 54.º-A (GAIS) e revoga o 56.º. **Obrigatório**: sem isto, S05 está desatualizado (L5) | `PRIM` |
| S07 | Mapa de Pessoal (índice) | `/areas-de-intervencao/educacao-e-recursos-humanos/recursos-humanos/mapa-de-pessoal` | HTML → PDF | Série anual | Anual | `mapa_pessoal.json`: postos por carreira, categoria e unidade orgânica; ocupados vs. previstos | Página índice; o PDF do ano é descoberto a partir daqui (`S07-2026`). O de 2026 **tem camada de texto** — não foi preciso OCR | `PRIM` |
| S08 | Documentos previsionais (Orçamento + GOP + PPI + PAM) | Secção de gestão financeira do site | PDF | Série anual | Anual (aprovação em dezembro) | `orcamento.json` (previsto), `investimentos.json` (PPI/GOP) | **Não localizei o URL exato da secção.** A pesquisa por "documentos previsionais Guimarães" devolveu sobretudo outros municípios | `CONHEC` |
| S09 | Relatório e Contas 2024 (notícia de aprovação) | `/areas-de-intervencao/noticia/relatorio-e-contas-de-2024-aprovado-por-maioria-em-reuniao-de-camara` | HTML | 2024 | Anual | Ponto de entrada para o R&C 2024 | Notícia, não o documento | `URL-S` |
| S10 | Relatório e Contas 2021 | `/cmguimaraes/uploads/document/file/18944/relatorio_e_contas_2021.pdf` | PDF | 2021 | Anual | `orcamento.json` (executado), dívida, indicadores | Padrão de URL (`/uploads/document/file/<id>/<slug>.pdf`) permite descobrir outros anos por varrimento da secção | `DESC` |
| S11 | Consolidação de Contas 2023 | `/cmguimaraes/uploads/document/file/21681/consolidacao_de_contas_2023.pdf` | PDF | 2023 | Anual | `empresas_municipais.json`: perímetro de consolidação, fluxos CMG↔empresas | **Fonte-chave** para identificar o universo de entidades participadas | `PRIM` |
| S12 | Consolidação de Contas 2021 | `/cmguimaraes/uploads/document/file/19124/consolidacao_de_contas_2021.pdf` | PDF | 2021 | Anual | idem, série histórica | — | `URL-S` |
| S13 | Certificação Legal de Contas Consolidadas 2014 | `/uploads/document/file/11167/Certifica__o_legal_de_contas_consolidado_2014.pdf` | PDF | 2014 | Anual | Ressalvas do ROC (qualidade dos dados) | Mostra que a série recua pelo menos a 2014; **nota: padrão de URL diferente** (`/uploads/` sem `/cmguimaraes/`) → o site mudou de CMS, o crawler tem de aceitar os dois | `URL-S` |
| S14 | Índice de Transparência Municipal | `/municipio/indice-transparencia-municipal` | HTML | — | Anual | Secção de transparência; benchmark de divulgação | Equivale à "secção de transparência" pedida no briefing | `URL-S` |
| S15 | Regulamentos | `/municipio/camara-municipal/publicacoes/regulamentos` | HTML → PDF | Vários | Contínua | Contexto normativo | — | `URL-S` |
| S16 | Mapa oficial dos resultados das eleições autárquicas | `/noticias/noticia/mapa-oficial-dos-resultados-das-eleicoes-autarquicas` | HTML → PDF | 2025 | Por eleição | `orgaos_eleitos.json` — **mapa oficial homologado** | **Fonte preferencial** para os resultados de 2025 (valor legal) | `PRIM` |
| S17 | Resultados finais homologados | `/areas-de-intervencao/noticia/resultados-finais-homologados-das-ultimas-eleicoes-autarquicas` | HTML | 2025 | Por eleição | idem | — | `PRIM` |
| S18 | Atas e deliberações (Câmara e Assembleia Municipal) | `/cmguimaraes/uploads/document/file/<id>/ata_no_*.pdf` | PDF | Série longa | Por reunião | Deliberações sobre empresas municipais, contratos, transferências | **Volume elevado, texto corrido** → baixa prioridade; útil por pesquisa dirigida, não por extração sistemática | `URL-S` |
| S19 | Balanço Social | Secção de RH do site | PDF | Série anual | Anual | Complementa `mapa_pessoal.json`: efetivos reais, idade, género, habilitações, absentismo | **Não localizei URL.** Distinguir de S07: o Balanço Social traz *efetivos*, o Mapa de Pessoal traz *postos* | `CONHEC` |
| S20 | Equipamentos municipais | Secções temáticas (desporto, cultura, educação, social) | HTML | Corrente | Contínua | `equipamentos.json`: tipo, nome, morada | Disperso por várias secções; moradas em texto livre → geocodificação via Nominatim, com taxa de falha a registar | `CONHEC` |
| S21 | Obras / empreitadas / projetos cofinanciados | Secções de obras e de fundos comunitários | HTML/PDF | Corrente | Contínua | `investimentos.json`: estado das obras, PRR / Portugal 2030 / Norte 2030 | Frequentemente só em notícias → estado das obras pouco estruturado | `CONHEC` |
| S22 | Vitrus Ambiente, EM SA (ficha) | `/areas-de-intervencao/ambiente/servicos-urbanos/gestao-de-residuos/gestao-dos-residuos-urbanos/poi/vitrus-ambiente-em-sa-92` | HTML | Corrente | — | `empresas_municipais.json` | Ficha operacional, não financeira | `URL-S` |
| S37 | Assembleia Municipal (composição do órgão) | `/municipio/assembleia-municipal` | HTML | Corrente | Por mandato | `orgaos_eleitos.json`: dimensão do órgão deliberativo | Dá 111 membros (56 eleitos + 55 presidentes de junta por inerência) mas **não** a distribuição por força política nem os nomes (L16) | `PRIM` |
| S38 | **Despacho n.º 6751/2024** — elo em falta da estrutura orgânica | `files.diariodarepublica.pt/2s/2024/06/115000000/0021500223.pdf` | PDF | 2024 | — | Cria o Dep. de Inovação, Transformação Digital e Economia; Dep. de Cultura, Economia e Inovação passa a Dep. de Cultura e Turismo | **Não está ligado em nenhuma página da CMG.** Sem ele falta um departamento inteiro e três divisões (L22) | `PRIM` |

## 2. Contratação pública

| # | Fonte | URL | Formato | Anos | Periodicidade | Conteúdo | Qualidade e limitações | Verificação |
|---|---|---|---|---|---|---|---|---|
| S23 | **dados.gov.pt — Contratos Públicos Portal BASE (IMPIC)** | `https://dados.gov.pt/pt/datasets/contratos-publicos-portal-base-impic-contratos-de-2012-a-2025/` | XLSX, JSON | 2012–2026 | **Semanal** | `contratos.json`: objeto, procedimento, adjudicatário, valor, datas, prazo | **Via de acesso recomendada.** Dataset nacional completo → filtrar por NIF/nome da entidade adjudicante. Sem autenticação. Ficheiro grande → processar em *chunks* | `PRIM` |
| S24 | Portal BASE — API IMPIC | `https://www.base.gov.pt/Base4/pt/noticias/2025/api-para-consulta-de-dados-do-portal-base/` | JSON | — | **Diária** | idem, mais atual | **Requer pedido de autorização** via helpdesk do IMPIC → não utilizável sem credencial. Usar S23 como base e a API só se a credencial for obtida | `URL-S` |
| S25 | Portal BASE — pesquisa web | `https://www.base.gov.pt/Base4/pt/pesquisa/` | HTML | 2008– | Contínua | idem | Scraping paginado, frágil; **preferir S23** | `URL-S` |
| S26 | Portal BASE — formas de obter dados (documentação) | `https://www.base.gov.pt/Base4/pt/documentacao/formas-de-obter-dados-sobre-os-contratos-publicos/` | HTML | — | — | Documenta as vias de acesso oficiais | Ler antes de implementar o ETL de contratos | `URL-S` |

> **Nota de âmbito:** o briefing pede contratos do Município **e das empresas municipais**.
> No dataset do BASE estas são entidades adjudicantes *distintas*, com NIF próprio.
> O ETL tem de resolver primeiro a lista de NIF (a partir de S11) e só depois filtrar.

## 3. Finanças locais e comparação entre municípios

| # | Fonte | URL | Entidade | Formato | Anos | Periodicidade | Conteúdo | Limitações | Verificação |
|---|---|---|---|---|---|---|---|---|---|
| S27 | Portal Autárquico — finanças locais | `https://www.portalautarquico.dgal.gov.pt/` | DGAL | XLSX/HTML | Série longa | Trimestral/anual | Endividamento, transferências do OE, execução orçamental, SEL, RH — **já normalizado entre municípios** | **Melhor fonte para a secção "Comparar"** (S12 do briefing): evita comparar extrações próprias de PDF entre municípios | `URL-S` |
| S28 | Anuário Financeiro dos Municípios Portugueses | Ordem dos Contabilistas Certificados | PDF | Série anual | Anual | Rankings, indicadores, grupos de municípios comparáveis | PDF extenso; publicação com desfasamento (~1–2 anos) | `CONHEC` |
| S29 | Tribunal de Contas | `https://www.tcontas.pt/` | TdC | PDF | Vários | Irregular | Auditorias ao município / empresas municipais | Pesquisa dirigida; pode não existir nenhuma no período | `CONHEC` |

## 4. Legislação, eleições e estatística

| # | Fonte | URL | Entidade | Formato | Conteúdo | Limitações | Verificação |
|---|---|---|---|---|---|---|---|
| S30 | Diário da República | `https://dre.pt/` | INCM | HTML/PDF | Estrutura orgânica (S05/S06), mapas de pessoal, concursos | Pesquisa por entidade é pouco precisa; **DR 2.ª série** nem sempre indexada com qualidade | `CONHEC` |
| S31 | Mapa oficial de resultados — CNE / MAI | `https://www.cne.pt/`, `https://autarquicas2025.mai.gov.pt/` | CNE / SGMAI | HTML/PDF | Resultados 2025: Câmara, AM, freguesias; histórico | **Fonte oficial** para `orgaos_eleitos.json`, a par de S16 | `CONHEC` |
| S32 | INE — População residente, estimativas anuais (**indicador 0012918**, NUTS 2024) | `json_indicador/pindica.jsp?op=2&varcd=0012918&Dim1=…` | INE | JSON | **Denominador de todas as métricas per capita**; Guimarães = `geocod` 1190308 | Cobre **2021–2025**. Sem `Dim1` devolve só o último ano. API intolerante à cadência: um 429 bloqueia o host durante horas | `PRIM` |
| S33 | PORDATA | `https://www.pordata.pt/` | Fund. F. M. dos Santos | XLSX | Indicadores municipais consolidados, comparação | Fonte secundária (agrega INE/DGAL) → citar sempre a fonte original | `CONHEC` |
| S34 | dados.gov.pt — datasets do município | `https://dados.gov.pt/` | AMA | Vários | Qualquer dataset publicado por/sobre Guimarães | Por inventariar: pode não haver nenhum específico do município | `CONHEC` |
| S35 | OpenStreetMap / Nominatim | `https://nominatim.openstreetmap.org/` | OSM Foundation | JSON | Geocodificação de `equipamentos.json`; tiles do Leaflet | **Limite de 1 req/s** e *User-Agent* identificável obrigatórios; resultados a cachear em disco e a rever manualmente | `CONHEC` |
| S36 | CAOP — Carta Administrativa Oficial de Portugal | DGT | SHP/GeoJSON | Limites das 48 freguesias do concelho, para mapas coropléticos | Simplificar geometrias para peso em rede móvel | `CONHEC` |

## 5. Empresas municipais e participadas (a confirmar em S11)

Universo **preliminar**, referido por resultados de pesquisa — a substituir
integralmente pelo perímetro de consolidação do Relatório de Contas Consolidadas (S11)
e pelo registo do SEL da DGAL (S27), que são as fontes com valor probatório.

| Entidade | Natureza (indicada) | Área | Verificação |
|---|---|---|---|
| Vimágua, EIM | Empresa intermunicipal | Água e saneamento | `EXIST-S` |
| Vitrus Ambiente, EM SA | Empresa municipal | Resíduos e limpeza urbana | `URL-S` (S22) |
| Casfig, EM | Empresa municipal | Habitação / gestão do parque habitacional | `EXIST-S` |
| Tempo Livre | Cooperativa | Desporto e tempos livres | `EXIST-S` |
| A Oficina | Cooperativa | Cultura | `EXIST-S` |
| Taipas Turitermas | Cooperativa | Turismo e termas | `EXIST-S` |
| Fraterna | Cooperativa | Ação social | `EXIST-S` |
| Laboratório da Paisagem | Associação | Ambiente | `EXIST-S` |

> **Atenção metodológica:** só parte destas entidades são *empresas municipais* na
> aceção da Lei n.º 50/2012. As restantes são cooperativas ou associações
> participadas. O dashboard **não deve tratá-las como equivalentes** — a ficha de
> cada entidade tem de indicar a natureza jurídica e a percentagem de participação,
> e a secção deve chamar-se "Empresas e entidades participadas".

## 6. Mandato 2025–2029 — **verificado na fonte primária**

A regra 5 está cumprida desde 2026-09-21. Os valores abaixo foram lidos nas páginas
do próprio Município (S02 e S01), descarregadas para `data/raw/` com `sha256`
registado, e estão em `data/processed/executivo.json` e `orgaos_eleitos.json`.

### Resultados da eleição de 12 de outubro de 2025 (Câmara Municipal) — fonte S02

| Força política | % | Mandatos |
|---|---:|---:|
| Coligação "Juntos por Guimarães" (PPD/PSD.CDS-PP) | 45,33 | 6 |
| Partido Socialista (PS) | 37,50 | 4 |
| Chega (CH) | 8,06 | 1 |
| **Total** | **90,89** | **11** |

**A soma das percentagens não é 100%**: S02 só discrimina as forças que obtiveram
mandato. Os restantes ~9,11% não estão repartidos na fonte e **não são inventados**.
Votos absolutos e abstenção: nenhuma fonte acessível os publica → `null`.

### Executivo

Presidente **Ricardo José Machado Pereira da Silva Araújo** (PPD/PSD.CDS-PP), em
funções desde 25-10-2025. Vice-presidente **Eduardo Manuel da Rocha Fernandes
Leite**. Seis membros da coligação exercem em permanência e com pelouros; os cinco
da oposição (4 PS + 1 CH) constam como vereadores sem competências delegadas.

O que a pesquisa da Fase 1 indicava bateu certo com a fonte primária — mas o que
está publicado vem da fonte, não da pesquisa.

### Armadilha de extração, registada porque quase produziu um erro

Na página do executivo, um vereador vem marcado como `Nome (PS<span>)</span>`. Ao
remover as tags, o `)` cai para a linha seguinte, o nome não casa com o de S02 e o
**e-mail seguinte é atribuído à pessoa anterior**. Foi o que aconteceu na primeira
extração: Isabel Ferreira ficou com o endereço de Ricardo Costa. O parser repara
agora parênteses partidos (`_juntar_parenteses`), e o cruzamento S01↔S02 por
conjunto de palavras do nome é o que torna o erro detetável.

### Lacuna que subsiste

A **composição da Assembleia Municipal por força política** continua por apurar
(L16). A CMG publica apenas a dimensão do órgão: 111 membros, 56 eleitos
diretamente e 55 presidentes de junta por inerência (S37). O Mapa Oficial do DR
(S16-DRE) tem essa informação mas é digitalizado (L17).

## 6-A. Perímetro de consolidação e NIF (verificado)

Do Quadro 1 do Relatório de Contas Consolidadas de 2023 (S11) saíram **42
entidades participadas**, das quais **11 no perímetro de consolidação**, todas
com NIPC. É esse conjunto que torna filtráveis os contratos do BASE.

A distinção de `natureza` vem da fonte e não é cosmética: no perímetro há duas
empresas municipais (Casfig, Vitrus), uma empresa **inter**municipal (Vimágua),
quatro cooperativas e uma régie cooperativa (A Oficina), uma fundação (Fundação
Cidade Guimarães) e duas associações (Laboratório da Paisagem, Curtir Ciência).

**NIF do Município de Guimarães: `505948605`**, resolvido do próprio dataset do
IMPIC e validado como único nos oito anos (2019–2026).

### Verificação cruzada do NIF do Município

O NIF `505948605` foi resolvido a partir do dataset do IMPIC e **confirmado
independentemente** no timbre do Mapa de Pessoal 2026 (S07-2026, pág. 2), onde a
própria CMG imprime `NIPC: 505 948 605`. Duas fontes distintas, o mesmo número.

### Porque é que o filtro não pode ser por nome

Procurar "Guimarães" na coluna do adjudicante do ficheiro de 2024 devolve **33
entidades distintas**. Entre elas: o Hospital da Senhora da Oliveira, treze
agrupamentos de escolas, a Escola Secundária Martins Sarmento, o Tribunal da
Relação de Guimarães e os bombeiros voluntários — nenhum é do município. No
sentido inverso, a **Vimágua aparece com quatro grafias diferentes** do mesmo
nome, todas com o mesmo NIF (`505993082`). Filtrar por nome erraria nos dois
sentidos ao mesmo tempo.

## 6-B. A cadeia normativa da estrutura orgânica

A estrutura orgânica **não se lê num documento só**. A cadeia verificada é:

| Documento | Publicação | O que faz |
|---|---|---|
| **S05** — Despacho n.º 14897/2022 | DR 2.ª série n.º 251, 30-12-2022 | Estrutura base, em vigor desde 01-01-2023 |
| **S38** — Despacho n.º 6751/2024 | DR 2.ª série n.º 115, 17-06-2024 | Cria o DITDE; DCEI passa a Dep. de Cultura e Turismo; revoga DSI, DDSI e DDE |
| **S06** — Despacho n.º 9070/2024 | DR 2.ª série n.º 154, 09-08-2024 | Reorganiza Intervenção Social e Recursos Humanos; adita o GAIS; extingue o GASI |

O inventário da Fase 1 supunha `S05 + S06`. **Faltava S38**, e sem ele o
organograma publicado teria menos um departamento e três divisões.

O que denunciou a falta foi a **numeração das alíneas**: em S05 o Departamento
de Intervenção Social é a alínea h) do artigo 5.º; em S06 é a i). S38 explica o
desvio, ao inserir o DITDE em e) e renumerar as seguintes. Nenhuma página da
CMG liga a S38 — foi localizado por pesquisa e confirmado no Diário da
República.

### Porque é que o organograma não substitui o texto

O organograma é **verificação cruzada**, e boa: foi a ausência do GASI no
diagrama que revelou que o Despacho 9070/2024 o extingue (dá nova redação à
alínea sem a cláusula que o criava), e foi a presença de `DM` no diagrama que
revelou que a Divisão de Mobilidade tinha desaparecido da extração por o DR
não lhe atribuir sigla. Mas quem tem valor legal é o texto — e onde divergem,
é o texto que prevalece (L24).

## 7. Fontes descartadas nesta fase

| Fonte | Razão |
|---|---|
| Wikipédia (PT/EN) | Fonte terciária. Útil para *orientar* a pesquisa, nunca como fonte de um indicador. |
| Órgãos de comunicação locais (Jornal de Guimarães, Mais Guimarães, Guimarães Digital, Observador, CNN Portugal) | Secundárias. Admissíveis apenas para *datar* um facto (ex.: data de tomada de posse) e sempre com a primária a par. |
| `racius.com` e agregadores comerciais | Dados de registo comercial reprocessados, sem garantia de atualização. |
