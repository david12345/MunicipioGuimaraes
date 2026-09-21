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

**Fase 1 (inventário e modelo de dados) concluída. Não há dados nem dashboard.**

`data/raw/` e `data/processed/` estão vazios **por decisão deliberada**, não por
esquecimento: o ambiente remoto onde a Fase 1 correu bloqueia por política de rede
todos os domínios de dados (`cm-guimaraes.pt`, `dados.gov.pt`, `base.gov.pt`,
`dgal.gov.pt`, `dre.pt`, `ine.pt`, `pordata.pt`, `cne.pt`). Preencher o dashboard a
partir de resumos de pesquisa violaria a regra 1.

O único ficheiro em `data/processed/` é `fontes.json` — é o registo das fontes,
gerado de `etl/sources.yaml`, não dados sobre o município.

**Próximo passo:** correr `make fetch` numa máquina com rede aberta e commitar
`data/raw/`. A partir daí a extração deixa de precisar de rede.

## Comandos

```bash
make setup        # requests + PyYAML (não precisa de ghostscript)
make check-acesso # diz que fontes estão alcançáveis daqui; sai com 1 se alguma falhar
make fetch        # descarrega originais para data/raw/
make fontes       # gera data/processed/fontes.json
make setup-parse  # dependências de extração (Fase 2; camelot exige ghostscript)
```

Correr `make check-acesso` primeiro em qualquer ambiente novo.

## Estrutura

```
data/raw/        originais + sidecar .meta.json (url, sha256, data_download)
data/processed/  JSON normalizado, um ficheiro por secção do dashboard
etl/
  sources.yaml   registo das fontes (9 com URL; o inventário tem 36)
  run.py         orquestrador: --fase fetch|fontes, --check-acesso
  common/        fetch.py (idempotente), fontes.py, validate.py, paths.py
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

- **Regra 5 por cumprir.** O executivo 2025–2029 **não está confirmado em fonte
  oficial**. A pesquisa apontou para Ricardo Araújo (coligação PSD/CDS "Juntos por
  Guimarães", 6 de 11 mandatos, fim de 36 anos de PS), mas isso é imprensa. Esses
  nomes estão **só em prosa** em `docs/fontes.md` §6, marcados como não verificados —
  **não entram em `data/processed/` nem no dashboard** antes de ler o mapa oficial
  homologado (S16) ou a CNE/MAI (S31). A composição da Assembleia Municipal está em
  branco.
- **Estrutura orgânica:** o documento de 2023 (S05) foi alterado pelo **Despacho
  9070/2024** (S06), que reorganizou os departamentos de Intervenção Social e de
  Recursos Humanos. Usar só o de 2023 produz um organograma errado. Preferir sempre o
  **texto normativo** à imagem do organograma — é mais fiável e é o que tem valor legal.
- **Nem todas as "empresas municipais" o são.** Vimágua, Vitrus e Casfig são empresas;
  Tempo Livre, A Oficina, Taipas Turitermas e Fraterna são cooperativas; Laboratório da
  Paisagem é associação. Tratá-las como equivalentes é factualmente errado — daí o
  campo `natureza` e o nome da secção ser "Empresas e entidades participadas".
- **Contratos do BASE:** o Município e cada empresa municipal são entidades
  adjudicantes distintas, com NIF próprio. Resolver os NIF a partir do perímetro de
  consolidação (S11) **antes** de filtrar o dataset.
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
