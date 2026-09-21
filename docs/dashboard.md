# Dashboard (Fase 3)

Site estático em Vite + D3, sem backend, publicável em GitHub Pages.

```bash
make dashboard-setup      # npm install
make dashboard            # servidor de desenvolvimento
make dashboard-build      # gera dist/
make dashboard-verificar  # requisitos não negociáveis + Lighthouse
```

`scripts/copiar-dados.mjs` copia `data/processed/` para `public/dados/` antes de
cada arranque e de cada build; `public/dados/` é gerado e não é commitado.

## Medições

Lighthouse, perfil móvel (390×844, estrangulamento de 4G):

| | |
|---|---|
| Performance | **100** |
| Acessibilidade | **100** |
| Boas práticas | **100** |
| SEO | **100** |
| First Contentful Paint | 1,0 s |
| Largest Contentful Paint | **1,5 s** (requisito: < 3 s) |
| Cumulative Layout Shift | 0 |

Verificado também, em 360 / 480 / 768 / 1280 px e nos dois temas: **zero scroll
horizontal**, contraste do texto 18:1 e 7,7:1 (AA exige 4,5:1), nenhum rótulo a
transbordar o gráfico, controlos com 44 px, e o atalho de teclado a funcionar.

Tudo isto corre em `make dashboard-verificar` e **falha a build** se regredir.

## Decisões que valem mais do que o código

### A primeira secção renderiza antes de ser inserida

A primeira medição deu **Performance 75**, por um **CLS de 1,67**. A causa não
era visível a olho: o contentor das secções era pintado vazio e só depois
preenchido, e tudo o que estava por baixo saltava.

A correção foi renderizar a visão geral *antes* de a inserir no DOM, e reservar
altura para o rodapé não subir. CLS passou a 0 e a Performance a 100. É o
exemplo de por que é que "parece rápido" não substitui medir.

### Barras horizontais por omissão

Os nomes aqui são longos — "Direção Municipal de Intervenção no Território,
Ambiente e Ação Climática" — e num ecrã de 360 px as barras verticais obrigam a
rodar o rótulo ou a cortá-lo.

Os rótulos são **medidos** com `getComputedTextLength`, não estimados por
contagem de caracteres: um nome em maiúsculas é bem mais largo do que a mesma
contagem em minúsculas, transbordava a goteira e o SVG cortava as primeiras
letras.

### Sem organograma em caixas e sem hemiciclo

O organograma clássico não sobrevive a 360 px: ou encolhe até ser ilegível, ou
obriga a rolar na horizontal. Está substituído por uma **árvore desdobrável**
com a mesma informação, navegável por teclado e que abre um nível de cada vez.

O hemiciclo exigiria a composição da Assembleia Municipal por força política,
que **não é publicada** (L16). Um hemiciclo inventado seria pior do que nenhum.

### Paleta validada por script

Oito tons categóricos, ordem fixa, nunca ciclada — a partir da nona série é
cinzento neutro, porque uma cor gerada seria indistinguível de outra sob
daltonismo. Ambos os temas passam os testes de separação (ΔE ≥ 8 sob protanopia)
e de banda de luminosidade.

No tema claro, três tons ficam **abaixo de 3:1 de contraste** com a superfície.
Isso obriga a compensação: rótulos directos visíveis em cada barra, e a tabela
de dados por trás de cada gráfico — que o briefing já exigia.

### Escalas de percentagem vão até 100

Com escala `[0, máximo]`, uma execução de 79,26% e outra de 84% apareciam ambas
quase a toda a largura e a diferença desaparecia. Num dashboard sobre dinheiro
público, isso é enganar com um gráfico tecnicamente correto.

## Cada gráfico traz sempre

Tabela de dados, botão de CSV (separador `;` e BOM, para o Excel português não
estragar os acentos) e a ficha da fonte: nome do documento, ligação, entidade,
ano de referência e data de recolha.

`null` é renderizado como **"Dado não disponível"** — nunca zero, nunca omissão
silenciosa.

## O que falta

- **Leaflet e o mapa**: a secção de equipamentos não tem dados, por isso o mapa
  ainda não faz sentido.
- Secções 6, 7, 10 e 11 existem, dizem "Dado não disponível" e explicam porquê.
- Não há testes automatizados do comportamento das secções, só das métricas.
