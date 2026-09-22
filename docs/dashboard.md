# Dashboard (Fase 3)

Site estático em Vite + D3, sem backend, publicável em GitHub Pages.

```bash
make dashboard-setup                        # npm install (uma vez)
npx playwright install chromium             # só para verificar (uma vez)

make dashboard                              # servidor de desenvolvimento
make dashboard-verificar                    # constrói, serve e verifica
URL=https://... make dashboard-verificar    # verifica um site já publicado
```

`make dashboard-verificar` arranca o servidor e encontra o Chromium sozinho.
Uma verificação que exige três passos preparatórios é uma verificação que
ninguém corre.

**No ar:** <https://david12345.github.io/MunicipioGuimaraes/>, publicado por
`.github/workflows/publicar.yml` a cada envio, com a verificação a correr antes
e a bloquear.

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

## O brasão, e porque não é o logótipo

O cabeçalho usa o **brasão de armas do concelho**, aprovado pela Portaria
131/85 e publicado em Diário da República. É o símbolo heráldico do
território.

**Não** usa a imagem institucional da Câmara — a marca de 2014, que tem manual
de normas próprio. Essa é a identidade da instituição, e um sítio que não é
oficial não a deve vestir.

A advertência "projeto independente · não é um sítio oficial" está **ao lado
do brasão**, no cabeçalho, e não só no rodapé. Quem chega vê as duas coisas ao
mesmo tempo.

A imagem é servida daqui, não do sítio da Câmara: usar a largura de banda
alheia para carregar um logótipo é má prática, e um URL que muda partia a
página. Está registada como fonte (`S40`), com `sha256`, como tudo o resto.

## Ligações para ficheiros

Uma ligação para um XLSX abria um segundo separador que ficava aberto enquanto
o download corria.

**Não é possível forçar "só descarregar" a partir da página.** Isso depende de
o servidor enviar `Content-Disposition: attachment`, e o do dados.gov não envia
sequer `Content-Type`; descarregar por código também está fora, porque não há
`Access-Control-Allow-Origin`. Tentar tirar o `target="_blank"` piorou: a
página navegava para o ficheiro e perdia-se o dashboard.

O que a página controla é o resto: o separador novo mantém-se (para o
dashboard não se perder) e cada ligação para ficheiro passa a mostrar
**formato e tamanho** — um dos ficheiros de contratos tem 33,5 MB, e ninguém
quer descobrir isso em dados móveis.

## Uma secção de cada vez

O menu **não** são atalhos para posições numa página longa: cada secção é a
sua própria página, com endereço próprio (`…/#contratos`), título de janela
próprio e entrada no histórico. Doze secções numa rolagem contínua obrigavam
a percorrer muito para chegar ao que se procura, e depois de saltar perdia-se
a noção de onde se estava.

O endereço usa `#` porque o GitHub Pages serve ficheiros estáticos e não sabe
reescrever `/contratos` para o `index.html`. Para quem usa não muda nada: o
endereço é partilhável, o botão "voltar" funciona, e os atalhos antigos
continuam a abrir a secção certa.

Ao mudar de secção o foco vai para o título e a página volta ao topo — mudar
de secção é mudar de página, e quem navega por teclado ou leitor de ecrã tem
de ir parar ao início do conteúdo novo. No fim de cada secção há **anterior e
seguinte**, para quem quiser ler tudo por ordem.

**A verificação teve de mudar com isto.** Antes percorria a página a rolar;
com uma secção visível de cada vez, isso passou a cobrir só a primeira e a
dizer que estava tudo bem. Agora **visita as doze**, em cada uma das quatro
larguras e nos dois temas — 96 combinações, cerca de três minutos.

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

### O mapa

Leaflet sobre OpenStreetMap, carregado **só** quando a secção dos equipamentos
abre: são ~43 kB comprimidos que não fazem falta a quem vem ver o orçamento.

Os marcadores são SVG desenhado, não a imagem que o Leaflet traz — essa é
referida por caminho relativo e não sobrevive ao empacotamento (aparecia o
texto alternativo em vez do pino). Desenhá-los evita dois pedidos de imagem,
segue o tema, e permite distinguir municipal de não municipal por **forma e
preenchimento**, não só por cor: cheio contra vazado lê-se sem ver cor.

O mapa e a lista mostram sempre o mesmo conjunto e o filtro age nos dois. A
lista não é a versão de recurso: num telemóvel dá morada e telefone sem obrigar
a apontar o dedo a um alfinete.

## O que falta

- Secções 6, 7 e 11 existem, dizem "Dado não disponível" e explicam porquê.
- Não há testes automatizados do comportamento das secções, só das métricas.
