/* Primitivas de gráfico, desenhadas em SVG sobre escalas do D3.
 *
 * Duas decisões que atravessam tudo:
 *
 * 1. **Barras horizontais por omissão** para categorias. Os nomes aqui são
 *    longos ("Direção Municipal de Intervenção no Território, Ambiente e Ação
 *    Climática") e num ecrã de 360 px as barras verticais obrigam a rodar o
 *    rótulo ou a cortá-lo. Horizontais lêem-se na vertical, que é como se
 *    segura um telemóvel.
 * 2. **Uma série é cinzenta, várias é que ganham cor.** A paleta categórica
 *    serve identidade; quando há uma só série a cor não distingue nada e só
 *    acrescenta ruído.
 *
 * Marcas: extremidades arredondadas a 4 px ancoradas à linha de base, traços
 * de 2 px, grelha recuada, e 2 px de folga entre preenchimentos adjacentes.
 */

import { scaleLinear, scaleBand, scalePoint } from "d3-scale";
import { max, min } from "d3-array";
import { line as linhaD3 } from "d3-shape";

const NS = "http://www.w3.org/2000/svg";

export const SERIES = [
  "var(--serie-1)",
  "var(--serie-2)",
  "var(--serie-3)",
  "var(--serie-4)",
  "var(--serie-5)",
  "var(--serie-6)",
  "var(--serie-7)",
  "var(--serie-8)",
];

export function corDaSerie(i) {
  // Nunca ciclar: a partir da 9.ª, cinzento neutro. Uma cor gerada seria
  // indistinguível de outra sob daltonismo.
  return i < SERIES.length ? SERIES[i] : "var(--neutro)";
}

function no(tag, attrs = {}, texto) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  if (texto !== undefined) n.textContent = texto;
  return n;
}

/** Encurta um rótulo à largura que a goteira permite, **medindo-o**.
 *
 * Estimar a largura por um número médio de caracteres não chega: um nome em
 * maiúsculas ("COSTEIRA EMPREITEIROS - SOCIEDADE...") é muito mais largo do
 * que a mesma contagem em minúsculas, transbordava a goteira e o SVG cortava
 * as primeiras letras. `getComputedTextLength` dá a largura real.
 */
function ajustarRotulo(nodo, texto, larguraMax) {
  nodo.textContent = texto;
  if (nodo.getComputedTextLength() <= larguraMax) return;
  // Busca binária pelo maior prefixo que cabe: evita medir carácter a carácter.
  let baixo = 1;
  let alto = texto.length;
  while (baixo < alto) {
    const meio = Math.ceil((baixo + alto) / 2);
    nodo.textContent = `${texto.slice(0, meio)}…`;
    if (nodo.getComputedTextLength() <= larguraMax) baixo = meio;
    else alto = meio - 1;
  }
  nodo.textContent = `${texto.slice(0, baixo)}…`;
}

function ligarDica(alvo, texto) {
  // Tooltip por toque e por rato: em telemóvel não há hover, e o briefing
  // exige que a informação esteja acessível ao toque.
  alvo.append(no("title", {}, texto));
  alvo.style.cursor = "pointer";
}

/** Altura que um gráfico de barras precisa para N categorias. */
export function alturaBarras(n, { espessura = 34, folga = 14, extra = 8 } = {}) {
  return n * (espessura + folga) + extra;
}

/**
 * Barras horizontais.
 * @param {SVGElement} svg
 * @param {object} o
 * @param {Array} o.dados  [{rotulo, valor, cor?}]
 * @param {Function} o.formatar  valor → texto do rótulo direto
 */
export function barrasHorizontais(svg, largura, altura, o) {
  const {
    dados,
    formatar = String,
    corUnica = "var(--serie-1)",
    // Percentagens têm de ir até 100: com escala [0, máximo], 79% e 84%
    // aparecem ambos quase a toda a largura e a diferença desaparece.
    maximo = null,
    // Se existir, cada barra torna-se acionável (descer um nível).
    aoEscolher = null,
    // `(d) => boolean`: quais das barras é que têm nível abaixo.
    temDetalhe = () => true,
  } = o;
  if (!dados.length) return;

  const estreito = largura < 480;
  const larguraRotulo = estreito
    ? Math.min(140, largura * 0.42)
    : Math.min(260, largura * 0.34);
  const margem = { topo: 4, dir: estreito ? 8 : 12, fundo: 4, esq: larguraRotulo };
  const larguraUtil = Math.max(40, largura - margem.esq - margem.dir);

  const y = scaleBand()
    .domain(dados.map((d) => d.rotulo))
    .range([margem.topo, altura - margem.fundo])
    .paddingInner(0.3);

  // Marcas finas: com poucas categorias, a banda disponível daria barras de
  // 90 px de altura, que gritam sem informar mais.
  const ESPESSURA_MAX = 34;
  const espessura = Math.max(6, Math.min(ESPESSURA_MAX, y.bandwidth()));
  const centrar = (yy) => yy + (y.bandwidth() - espessura) / 2;

  const maxValor = maximo ?? max(dados, (d) => d.valor) ?? 0;
  const x = scaleLinear().domain([0, maxValor || 1]).range([0, larguraUtil]);

  const g = no("g");
  svg.append(g);

  for (const d of dados) {
    const yy = centrar(y(d.rotulo));
    const alt = espessura;
    const comp = Math.max(0, x(d.valor ?? 0));
    const acionavel = Boolean(aoEscolher) && temDetalhe(d) && d.valor !== null;

    // A barra vive dentro de um grupo. Quando é acionável, é o grupo que
    // recebe o clique, o foco e o nome acessível — e a área sensível é a
    // faixa inteira, não a barra: a barra tem 34 px de altura e o mínimo
    // para um alvo de toque são 44.
    const grupo = no("g", acionavel
      ? {
          role: "button",
          tabindex: "0",
          class: "barra-acionavel",
          "aria-label": `${d.rotulo}: ${formatar(d.valor)}. Ver o detalhe.`,
        }
      : {});
    g.append(grupo);

    if (acionavel) {
      const faixa = no("rect", {
        x: 0,
        y: y(d.rotulo),
        width: largura,
        height: Math.max(44, y.bandwidth()),
        fill: "transparent",
        class: "barra-faixa",
      });
      grupo.append(faixa);
      const escolher = () => aoEscolher(d);
      grupo.addEventListener("click", escolher);
      grupo.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          escolher();
        }
      });
    }

    const rot = no("text", {
      x: margem.esq - 8,
      y: yy + alt / 2,
      "text-anchor": "end",
      "dominant-baseline": "central",
      class: acionavel ? "g-rotulo g-rotulo--acionavel" : "g-rotulo",
    });
    grupo.append(rot);
    // Só depois de estar no DOM é que o texto se pode medir.
    ajustarRotulo(rot, d.rotulo, margem.esq - 12);
    rot.append(no("title", {}, d.rotulo));

    if (d.valor === null || d.valor === undefined) {
      grupo.append(no("text", {
        x: margem.esq + 4,
        y: yy + alt / 2,
        "dominant-baseline": "central",
        class: "g-sem-dado",
      }, "Dado não disponível"));
      continue;
    }

    const barra = no("rect", {
      x: margem.esq,
      y: yy,
      width: comp,
      height: alt,
      rx: 4,
      fill: d.cor ?? corUnica,
    });
    if (!acionavel) ligarDica(barra, `${d.rotulo}: ${formatar(d.valor)}`);
    grupo.append(barra);

    // Rótulo directo: dentro da barra se couber, fora se não. É a compensação
    // exigida pelos tons de baixo contraste no tema claro.
    const texto = formatar(d.valor);
    const cabeDentro = comp > texto.length * 7.2 + 14;
    grupo.append(no("text", {
      x: cabeDentro ? margem.esq + comp - 8 : margem.esq + comp + 6,
      y: yy + alt / 2,
      "text-anchor": cabeDentro ? "end" : "start",
      "dominant-baseline": "central",
      class: cabeDentro ? "g-valor g-valor--dentro" : "g-valor",
    }, texto));
  }
}

/**
 * Linha temporal, uma ou mais séries.
 * @param {object} o
 * @param {Array} o.series  [{nome, pontos:[{x, y}]}]
 */
export function linhaTemporal(svg, largura, altura, o) {
  const { series, formatar = String, formatarX = String } = o;
  const visiveis = series.filter((s) => s.pontos.some((p) => p.y !== null));
  if (!visiveis.length) return;

  const estreito = largura < 480;
  const margem = {
    topo: 16,
    dir: estreito ? 14 : 22,
    fundo: 30,
    esq: estreito ? 52 : 72,
  };

  const xs = [...new Set(series.flatMap((s) => s.pontos.map((p) => p.x)))].sort();
  const x = scalePoint().domain(xs).range([margem.esq, largura - margem.dir]).padding(0.5);

  const todos = visiveis.flatMap((s) => s.pontos.map((p) => p.y)).filter((v) => v !== null);
  const baixo = Math.min(0, min(todos) ?? 0);
  const y = scaleLinear()
    .domain([baixo, max(todos) ?? 1])
    .nice(4)
    .range([altura - margem.fundo, margem.topo]);

  // Grelha recuada: informa sem competir com os dados.
  const g = no("g");
  svg.append(g);
  for (const t of y.ticks(4)) {
    g.append(no("line", {
      x1: margem.esq, x2: largura - margem.dir, y1: y(t), y2: y(t), class: "g-grelha",
    }));
    g.append(no("text", {
      x: margem.esq - 8, y: y(t), "text-anchor": "end",
      "dominant-baseline": "central", class: "g-eixo",
    }, formatar(t)));
  }

  for (const px of xs) {
    g.append(no("text", {
      x: x(px), y: altura - margem.fundo + 18, "text-anchor": "middle", class: "g-eixo",
    }, formatarX(px)));
  }

  const gerar = linhaD3()
    .defined((p) => p.y !== null)
    .x((p) => x(p.x))
    .y((p) => y(p.y));

  visiveis.forEach((s, i) => {
    // Uma série só não precisa de cor para se distinguir de nada.
    const cor = visiveis.length === 1 ? "var(--serie-1)" : corDaSerie(i);
    g.append(no("path", {
      d: gerar(s.pontos),
      fill: "none",
      stroke: cor,
      "stroke-width": 2,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    }));
    for (const p of s.pontos) {
      if (p.y === null) continue;
      const c = no("circle", {
        cx: x(p.x), cy: y(p.y), r: 5, fill: cor,
        // Anel da cor da superfície: separa marcas que se sobrepõem.
        stroke: "var(--superficie)", "stroke-width": 2,
      });
      ligarDica(c, `${s.nome} · ${formatarX(p.x)}: ${formatar(p.y)}`);
      g.append(c);
    }
    // Rótulo directo no último ponto, em vez de legenda, quando são poucas.
    const ultimo = [...s.pontos].reverse().find((p) => p.y !== null);
    if (ultimo && visiveis.length <= 4 && !estreito) {
      g.append(no("text", {
        x: x(ultimo.x), y: y(ultimo.y) - 12, "text-anchor": "end", class: "g-valor",
      }, s.nome));
    }
  });
}

/** Legenda em HTML: identidade nunca fica só na cor. */
export function legenda(nomes) {
  const ul = document.createElement("ul");
  ul.className = "legenda";
  nomes.forEach((nome, i) => {
    const li = document.createElement("li");
    const marca = document.createElement("span");
    marca.className = "legenda__marca";
    marca.style.background = corDaSerie(i);
    li.append(marca, document.createTextNode(nome));
    ul.append(li);
  });
  return ul;
}
