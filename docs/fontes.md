# Inventário de fontes — Câmara Municipal de Guimarães

**Estado:** Fase 1 (investigação). Última atualização: 2026-09-21.

> ### ⚠️ Aviso de acesso — ler antes de usar este documento
>
> Este inventário foi construído **sem acesso direto às fontes**. O ambiente de
> execução desta sessão bloqueia, por política de rede da organização, o acesso a
> **todos** os domínios de dados públicos necessários (ver
> [`qualidade_dados.md`](qualidade_dados.md#l1--bloqueio-total-de-acesso-às-fontes)).
>
> Em consequência:
>
> - **Nenhum documento foi descarregado.** `data/raw/` está vazio.
> - **Nenhum número foi extraído.** `data/processed/` não contém dados reais.
> - Os URLs, formatos e conteúdos abaixo foram identificados por **pesquisa web
>   (motor de busca)**, não por leitura da fonte primária. A coluna *Verificação*
>   diz, para cada linha, o que foi efetivamente confirmado.
>
> Nada neste ficheiro deve ser tratado como dado validado. Ao correr o ETL num
> ambiente com rede aberta, cada linha tem de ser reconfirmada e a coluna
> *Verificação* atualizada.

## Legenda da coluna *Verificação*

| Marca | Significado |
|---|---|
| `URL-S` | URL obtido em resultados de pesquisa; **não aberto**. Pode estar morto ou desatualizado. |
| `EXIST-S` | A existência do documento/secção é referida por resultados de pesquisa; URL exato por confirmar. |
| `CONHEC` | Identificado por conhecimento geral do domínio (estrutura típica das autarquias PT); **a confirmar integralmente**. |
| `PRIM` | Confirmado na fonte primária. **Nenhuma linha tem este estado nesta sessão.** |

---

## 1. Site institucional da CMG (`cm-guimaraes.pt`)

Entidade responsável: Município de Guimarães. Acesso nesta sessão: **bloqueado**.

| # | Fonte | URL | Formato | Anos | Periodicidade | Conteúdo / indicadores que alimenta | Qualidade e limitações | Verificação |
|---|---|---|---|---|---|---|---|---|
| S01 | Executivo Municipal | `/municipio/camara-municipal/executivo-municipal` | HTML | Mandato corrente | Por mandato | `executivo.json`: nomes, cargos, pelouros, fotos oficiais | Pelouros em prosa, não tabelados → extração frágil, exige parsing manual | `URL-S` |
| S02 | Câmara Municipal (composição) | `/municipio/camara-municipal` | HTML | Corrente | Por mandato | `orgaos_eleitos.json`: composição do órgão executivo | — | `URL-S` |
| S03 | Organograma | `/municipio/camara-municipal/organograma` | HTML + provável PDF/imagem | Corrente | Irregular | `estrutura_organica.json` | Se for imagem, **não é extraível por parsing** → transcrição manual a partir do texto em DR (S05) | `URL-S` |
| S04 | Estrutura e Organização dos Serviços Municipais | `/noticia-6/estrutura-e-organizacao-dos-servicos-municipais` | HTML | 2023– | Irregular | Contexto da estrutura orgânica | Página de notícia; conteúdo normativo está em DR | `URL-S` |
| S05 | Orgânica dos Serviços Municipais 2023 (texto DR) | `/cmguimaraes/uploads/writer_file/document/9902/organica_2023.pdf` | PDF | 2023 | — | `estrutura_organica.json`: departamentos → divisões → unidades, competências | **Fonte preferencial** para a hierarquia: texto normativo, estruturado. Publicado em DR 2.ª série n.º 251, 30-12-2022 | `URL-S` |
| S06 | Alteração à estrutura orgânica (Despacho 9070/2024) | via DRE (ver S30) | PDF/HTML | 2024 | — | Reorganização do Dep. de Intervenção Social e do Dep. de Recursos Humanos | **Obrigatório**: sem isto, S05 está desatualizado | `EXIST-S` |
| S07 | Mapa de Pessoal | `/areas-de-intervencao/educacao-e-recursos-humanos/recursos-humanos/mapa-de-pessoal` | PDF (provável) | Série anual | Anual | `mapa_pessoal.json`: postos por carreira, categoria, unidade orgânica; previstos vs. ocupados | Mapas de pessoal são tabelas largas em PDF → `camelot`/`pdfplumber`; risco de PDF digitalizado (→ OCR) | `URL-S` |
| S08 | Documentos previsionais (Orçamento + GOP + PPI + PAM) | Secção de gestão financeira do site | PDF | Série anual | Anual (aprovação em dezembro) | `orcamento.json` (previsto), `investimentos.json` (PPI/GOP) | **Não localizei o URL exato da secção.** A pesquisa por "documentos previsionais Guimarães" devolveu sobretudo outros municípios | `CONHEC` |
| S09 | Relatório e Contas 2024 (notícia de aprovação) | `/areas-de-intervencao/noticia/relatorio-e-contas-de-2024-aprovado-por-maioria-em-reuniao-de-camara` | HTML | 2024 | Anual | Ponto de entrada para o R&C 2024 | Notícia, não o documento | `URL-S` |
| S10 | Relatório e Contas 2021 | `/cmguimaraes/uploads/document/file/18944/relatorio_e_contas_2021.pdf` | PDF | 2021 | Anual | `orcamento.json` (executado), dívida, indicadores | Padrão de URL (`/uploads/document/file/<id>/<slug>.pdf`) permite descobrir outros anos por varrimento da secção | `URL-S` |
| S11 | Consolidação de Contas 2023 | `/cmguimaraes/uploads/document/file/21681/consolidacao_de_contas_2023.pdf` | PDF | 2023 | Anual | `empresas_municipais.json`: perímetro de consolidação, fluxos CMG↔empresas | **Fonte-chave** para identificar o universo de entidades participadas | `URL-S` |
| S12 | Consolidação de Contas 2021 | `/cmguimaraes/uploads/document/file/19124/consolidacao_de_contas_2021.pdf` | PDF | 2021 | Anual | idem, série histórica | — | `URL-S` |
| S13 | Certificação Legal de Contas Consolidadas 2014 | `/uploads/document/file/11167/Certifica__o_legal_de_contas_consolidado_2014.pdf` | PDF | 2014 | Anual | Ressalvas do ROC (qualidade dos dados) | Mostra que a série recua pelo menos a 2014; **nota: padrão de URL diferente** (`/uploads/` sem `/cmguimaraes/`) → o site mudou de CMS, o crawler tem de aceitar os dois | `URL-S` |
| S14 | Índice de Transparência Municipal | `/municipio/indice-transparencia-municipal` | HTML | — | Anual | Secção de transparência; benchmark de divulgação | Equivale à "secção de transparência" pedida no briefing | `URL-S` |
| S15 | Regulamentos | `/municipio/camara-municipal/publicacoes/regulamentos` | HTML → PDF | Vários | Contínua | Contexto normativo | — | `URL-S` |
| S16 | Mapa oficial dos resultados das eleições autárquicas | `/noticias/noticia/mapa-oficial-dos-resultados-das-eleicoes-autarquicas` | HTML → PDF | 2025 | Por eleição | `orgaos_eleitos.json` — **mapa oficial homologado** | **Fonte preferencial** para os resultados de 2025 (valor legal) | `URL-S` |
| S17 | Resultados finais homologados | `/areas-de-intervencao/noticia/resultados-finais-homologados-das-ultimas-eleicoes-autarquicas` | HTML | 2025 | Por eleição | idem | — | `URL-S` |
| S18 | Atas e deliberações (Câmara e Assembleia Municipal) | `/cmguimaraes/uploads/document/file/<id>/ata_no_*.pdf` | PDF | Série longa | Por reunião | Deliberações sobre empresas municipais, contratos, transferências | **Volume elevado, texto corrido** → baixa prioridade; útil por pesquisa dirigida, não por extração sistemática | `URL-S` |
| S19 | Balanço Social | Secção de RH do site | PDF | Série anual | Anual | Complementa `mapa_pessoal.json`: efetivos reais, idade, género, habilitações, absentismo | **Não localizei URL.** Distinguir de S07: o Balanço Social traz *efetivos*, o Mapa de Pessoal traz *postos* | `CONHEC` |
| S20 | Equipamentos municipais | Secções temáticas (desporto, cultura, educação, social) | HTML | Corrente | Contínua | `equipamentos.json`: tipo, nome, morada | Disperso por várias secções; moradas em texto livre → geocodificação via Nominatim, com taxa de falha a registar | `CONHEC` |
| S21 | Obras / empreitadas / projetos cofinanciados | Secções de obras e de fundos comunitários | HTML/PDF | Corrente | Contínua | `investimentos.json`: estado das obras, PRR / Portugal 2030 / Norte 2030 | Frequentemente só em notícias → estado das obras pouco estruturado | `CONHEC` |
| S22 | Vitrus Ambiente, EM SA (ficha) | `/areas-de-intervencao/ambiente/servicos-urbanos/gestao-de-residuos/gestao-dos-residuos-urbanos/poi/vitrus-ambiente-em-sa-92` | HTML | Corrente | — | `empresas_municipais.json` | Ficha operacional, não financeira | `URL-S` |

## 2. Contratação pública

| # | Fonte | URL | Formato | Anos | Periodicidade | Conteúdo | Qualidade e limitações | Verificação |
|---|---|---|---|---|---|---|---|---|
| S23 | **dados.gov.pt — Contratos Públicos Portal BASE (IMPIC)** | `https://dados.gov.pt/pt/datasets/contratos-publicos-portal-base-impic-contratos-de-2012-a-2025/` | XLSX, JSON | 2012–2026 | **Semanal** | `contratos.json`: objeto, procedimento, adjudicatário, valor, datas, prazo | **Via de acesso recomendada.** Dataset nacional completo → filtrar por NIF/nome da entidade adjudicante. Sem autenticação. Ficheiro grande → processar em *chunks* | `URL-S` |
| S24 | Portal BASE — API IMPIC | `https://www.base.gov.pt/Base4/pt/noticias/2025/api-para-consulta-de-dados-do-portal-base/` | JSON | — | **Diária** | idem, mais atual | **Requer pedido de autorização** via helpdesk do IMPIC → não utilizável sem credencial. Usar S23 como base e a API só se a credencial for obtida | `URL-S` |
| S25 | Portal BASE — pesquisa web | `https://www.base.gov.pt/Base4/pt/pesquisa/` | HTML | 2008– | Contínua | idem | Scraping paginado, frágil; **preferir S23** | `URL-S` |
| S26 | Portal BASE — formas de obter dados (documentação) | `https://www.base.gov.pt/Base4/pt/documentacao/formas-de-obter-dados-sobre-os-contratos-publicos/` | HTML | — | — | Documenta as vias de acesso oficiais | Ler antes de implementar o ETL de contratos | `URL-S` |

> **Nota de âmbito:** o briefing pede contratos do Município **e das empresas municipais**.
> No dataset do BASE estas são entidades adjudicantes *distintas*, com NIF próprio.
> O ETL tem de resolver primeiro a lista de NIF (a partir de S11) e só depois filtrar.

## 3. Finanças locais e comparação entre municípios

| # | Fonte | URL | Entidade | Formato | Anos | Periodicidade | Conteúdo | Limitações | Verificação |
|---|---|---|---|---|---|---|---|---|---|
| S27 | Portal Autárquico — finanças locais | `https://www.portalautarquico.dgal.gov.pt/` | DGAL | XLSX/HTML | Série longa | Trimestral/anual | Endividamento, transferências do OE, execução orçamental, SEL, RH — **já normalizado entre municípios** | **Melhor fonte para a secção "Comparar"** (S12 do briefing): evita comparar extrações próprias de PDF entre municípios | `CONHEC` |
| S28 | Anuário Financeiro dos Municípios Portugueses | Ordem dos Contabilistas Certificados | PDF | Série anual | Anual | Rankings, indicadores, grupos de municípios comparáveis | PDF extenso; publicação com desfasamento (~1–2 anos) | `CONHEC` |
| S29 | Tribunal de Contas | `https://www.tcontas.pt/` | TdC | PDF | Vários | Irregular | Auditorias ao município / empresas municipais | Pesquisa dirigida; pode não existir nenhuma no período | `CONHEC` |

## 4. Legislação, eleições e estatística

| # | Fonte | URL | Entidade | Formato | Conteúdo | Limitações | Verificação |
|---|---|---|---|---|---|---|---|
| S30 | Diário da República | `https://dre.pt/` | INCM | HTML/PDF | Estrutura orgânica (S05/S06), mapas de pessoal, concursos | Pesquisa por entidade é pouco precisa; **DR 2.ª série** nem sempre indexada com qualidade | `CONHEC` |
| S31 | Mapa oficial de resultados — CNE / MAI | `https://www.cne.pt/`, `https://autarquicas2025.mai.gov.pt/` | CNE / SGMAI | HTML/PDF | Resultados 2025: Câmara, AM, freguesias; histórico | **Fonte oficial** para `orgaos_eleitos.json`, a par de S16 | `CONHEC` |
| S32 | INE — Censos e estimativas de população | `https://www.ine.pt/` | INE | XLSX/API | **Denominador de todas as métricas per capita**; área; freguesias | Escolher e documentar uma única série (estimativa anual a 31-12) e usá-la em todo o dashboard | `CONHEC` |
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

## 6. Mandato 2025–2029 — estado da verificação

A regra 5 do briefing exige confirmar a composição atual **nas fontes oficiais**.
**Isso não foi possível nesta sessão** (S01, S16, S31 bloqueados).

O que a pesquisa web indica, **por confirmar e não carregado para `data/processed/`**:

- Coligação `PPD/PSD.CDS-PP` ("Juntos por Guimarães") vence a Câmara com ~45,3% e
  **6 dos 11 mandatos** (maioria absoluta), terminando 36 anos de governação do PS.
- **Ricardo Araújo** — Presidente, desde 25-10-2025.
- **Eduardo Leite** — Vice-Presidente.
- Oposição: 4 PS + 1 Chega. PS com ~37,5%.
- Vereadores/pelouros referidos: Vânia Silva, Constantino Veiga, António Martins, Isabel Ferreira.
- **Composição da Assembleia Municipal em 2025: não apurada.** Lacuna aberta.

Nenhum destes valores entra no dashboard antes de leitura de S16/S31.

## 7. Fontes descartadas nesta fase

| Fonte | Razão |
|---|---|
| Wikipédia (PT/EN) | Fonte terciária. Útil para *orientar* a pesquisa, nunca como fonte de um indicador. |
| Órgãos de comunicação locais (Jornal de Guimarães, Mais Guimarães, Guimarães Digital, Observador, CNN Portugal) | Secundárias. Admissíveis apenas para *datar* um facto (ex.: data de tomada de posse) e sempre com a primária a par. |
| `racius.com` e agregadores comerciais | Dados de registo comercial reprocessados, sem garantia de atualização. |
