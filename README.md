# Dashboard do Município de Guimarães

Visão consolidada e verificável da Câmara Municipal de Guimarães: como está
organizada, quem a governa, quantas pessoas emprega, quanto recebe e gasta, em quê,
e que obras faz. Dirigido ao cidadão comum, em português europeu, para telemóvel e
laptop.

## ⚠️ Estado: Fase 1 concluída — sem dados

O projeto está na fase de **inventário de fontes e modelo de dados**. Ainda **não
existe dashboard nem dados extraídos**, e isso é deliberado:

> O ambiente onde este trabalho foi executado bloqueia, por política de rede da
> organização, o acesso a **todos** os domínios de dados públicos necessários —
> `cm-guimaraes.pt`, `base.gov.pt`, `dados.gov.pt`, `dgal.gov.pt`, `dre.pt`,
> `ine.pt`, `pordata.pt`, `cne.pt`. Nenhum documento pôde ser descarregado.

Em vez de preencher o dashboard com números aproximados — o que violaria a regra de
não inventar dados —, esta fase entrega o **inventário**, o **modelo de dados** e o
**pipeline executável**, prontos a correr assim que houver acesso.

`data/raw/` e `data/processed/` estão vazios (exceto `fontes.json`, que é o registo
das fontes, não dados sobre o município). Ver
[`docs/qualidade_dados.md`](docs/qualidade_dados.md#l1--bloqueio-total-de-acesso-às-fontes)
para o diagnóstico completo e as vias de desbloqueio.

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/fontes.md`](docs/fontes.md) | Inventário de 36 fontes: URL, entidade, formato, anos, periodicidade, limitações e **estado de verificação de cada uma** |
| [`docs/modelo_dados.md`](docs/modelo_dados.md) | Modelo de dados proposto, esquemas JSON e questões em aberto |
| [`docs/qualidade_dados.md`](docs/qualidade_dados.md) | Lacunas, bloqueios e as 8 validações bloqueantes do ETL |

## Estrutura

```
data/raw/        originais descarregados, com o nome original + sidecar .meta.json (sha256)
data/processed/  JSON normalizado, um ficheiro por secção do dashboard
etl/             pipeline Python, um módulo por fonte
  common/        fetch (idempotente), registo de fontes, validações
  sources.yaml   registo legível por máquina das fontes
docs/            inventário, modelo de dados, qualidade
src/             dashboard estático (Fase 3 — por construir)
```

## Correr o ETL

```bash
make setup           # instala dependências Python
make check-acesso    # diagnostica que fontes estão alcançáveis daqui
make fetch           # descarrega os originais para data/raw/
make fontes          # gera data/processed/fontes.json
```

`make check-acesso` é o primeiro comando a correr num ambiente novo: diz
imediatamente se o bloqueio descrito acima se aplica. Sai com código 1 se alguma
fonte estiver inacessível.

O `fetch` é **idempotente**: não volta a descarregar conteúdo cujo `sha256` não
mudou, e não duplica originais. Cada ficheiro em `data/raw/` fica acompanhado de um
`.meta.json` com URL, data de download e `sha256` — o que permite detetar que uma
fonte foi substituída em silêncio mantendo o mesmo URL, algo comum nos sites
autárquicos.

### Correr com dados reais

Se este ambiente continuar bloqueado, a via mais rápida é correr o ETL numa máquina
com rede aberta e commitar o resultado:

```bash
git clone <repo> && cd MunicipioGuimaraes
make setup && make etl
git add data/ && git commit -m "dados: extração de <data>"
```

Os *parsers* trabalham sobre ficheiros locais e não precisam de rede — só o passo de
*download* precisa. Também é viável colocar os PDF/XLSX manualmente em `data/raw/`.

## Princípios não negociáveis

1. **Nenhum número sem fonte.** Todo o registo tem `fonte_id` que resolve contra
   `fontes.json`; a validação V6 rejeita órfãos. Sem fonte, o dashboard mostra
   *"Dado não disponível"* — nunca uma estimativa não assinalada.
2. **Totais têm de bater.** A soma extraída é confrontada com o total declarado no
   documento (±0,01 €). Discrepância = não publica, e fica registada em
   `docs/qualidade_dados.md`.
3. **Os originais ficam guardados**, com o nome original e a data de download.
4. **O pipeline é re-executável** quando saírem novos documentos.
5. **Sem dados pessoais** além dos titulares de cargos públicos que a CMG publica.
   `mapa_pessoal.json` contém apenas agregados, nunca uma linha por trabalhador.

## Próximos passos

- **Fase 1 (a aguardar decisão):** desbloquear o acesso às fontes; aprovar o modelo
  de dados e as 4 questões em aberto em `docs/modelo_dados.md`.
- **Fase 2:** *parsers* por fonte, validações, `data/processed/`.
- **Fase 3:** dashboard estático (Vite + D3 + Leaflet), *mobile-first*, 12 secções.
