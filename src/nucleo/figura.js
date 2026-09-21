/* A "figura": gráfico + tabela de dados + CSV + ficha da fonte.
 *
 * Nenhum gráfico do dashboard existe sozinho. Cada um vem sempre com:
 *
 * - **a tabela de dados por detrás**, exigida pelo briefing e que também é a
 *   compensação obrigatória para os três tons da paleta clara que ficam
 *   abaixo de 3:1 de contraste;
 * - **o CSV**, para quem quiser refazer as contas;
 * - **a ficha da fonte** — nome do documento, URL, data de publicação e ano de
 *   referência — que é a regra 2 do briefing tornada visível.
 *
 * O SVG é desenhado com `viewBox` e redimensionado por `ResizeObserver`: o
 * gráfico acompanha o contentor sem nunca provocar scroll horizontal.
 */

import { fonte as obterFonte } from "./dados.js";
import { data as formatarData, NAO_DISPONIVEL } from "./formato.js";

let contador = 0;

function el(tag, props = {}, filhos = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k === "texto") n.textContent = v;
    else if (k === "html") n.innerHTML = v;
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  for (const f of [].concat(filhos)) {
    if (f) n.append(f);
  }
  return n;
}

function paraCSV(colunas, linhas) {
  const escapar = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Separador `;`: é o que o Excel em português europeu espera.
  return [
    colunas.map((c) => escapar(c.titulo)).join(";"),
    ...linhas.map((l) => colunas.map((c) => escapar(c.valor(l))).join(";")),
  ].join("\r\n");
}

function descarregarCSV(nome, texto) {
  // BOM para o Excel reconhecer UTF-8 e não estragar os acentos.
  const blob = new Blob([`﻿${texto}`], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function fichaDaFonte(ids) {
  const lista = el("ul", { class: "figura__fontes" });
  for (const id of [].concat(ids).filter(Boolean)) {
    const f = await obterFonte(id);
    if (!f) {
      lista.append(el("li", { texto: `Fonte ${id}: não resolve em fontes.json` }));
      continue;
    }
    const item = el("li");
    const nome = f.url
      ? el("a", { href: f.url, rel: "noopener", target: "_blank", texto: f.nome })
      : el("span", { texto: f.nome });
    item.append(nome);
    const detalhe = [];
    if (f.ano_referencia) detalhe.push(`ano de referência ${f.ano_referencia}`);
    if (f.data_download) detalhe.push(`recolhido em ${formatarData(f.data_download)}`);
    if (f.entidade) detalhe.push(f.entidade);
    if (detalhe.length) {
      item.append(el("span", { class: "figura__meta", texto: ` — ${detalhe.join(" · ")}` }));
    }
    lista.append(item);
  }
  return lista;
}

/**
 * Cria uma figura completa.
 *
 * @param {object} opcoes
 * @param {string} opcoes.titulo
 * @param {string} [opcoes.resumo]  frase em linguagem simples, antes do detalhe
 * @param {Function} opcoes.desenhar  (svg, largura, altura) => void
 * @param {Array} opcoes.colunas  [{titulo, valor(linha)}] para tabela e CSV
 * @param {Array} opcoes.linhas
 * @param {string|string[]} opcoes.fontes  fonte_id
 * @param {string[]} [opcoes.avisos]  limitações a mostrar a par do gráfico
 * @param {number} [opcoes.proporcao]  altura/largura do SVG (default 0.62)
 * @param {Function} [opcoes.altura]  (largura) => altura; ganha à proporção.
 *   Um gráfico de barras deve dar a altura a partir do número de categorias,
 *   não da largura — senão três barras num ecrã largo ficam separadas por
 *   buracos e oito barras num ecrã estreito ficam esmagadas.
 */
export function figura({
  titulo,
  resumo,
  desenhar,
  colunas,
  linhas,
  fontes,
  avisos = [],
  proporcao = 0.62,
  altura: alturaDe = null,
}) {
  const id = `fig-${++contador}`;
  const raiz = el("figure", { class: "figura", "aria-labelledby": `${id}-t` });

  raiz.append(el("h3", { class: "figura__titulo", id: `${id}-t`, texto: titulo }));
  if (resumo) raiz.append(el("p", { class: "figura__resumo", texto: resumo }));

  for (const a of avisos) {
    raiz.append(el("p", { class: "figura__aviso", texto: a }));
  }

  const caixa = el("div", { class: "figura__tela" });
  raiz.append(caixa);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", titulo);
  // A tabela logo abaixo é a versão acessível; o SVG não precisa de ser lido.
  svg.setAttribute("focusable", "false");
  caixa.append(svg);

  // --- Tabela de dados -----------------------------------------------------
  const detalhes = el("details", { class: "figura__tabela" });
  detalhes.append(
    el("summary", { texto: `Ver os dados de "${titulo}" em tabela` }),
  );
  const tabela = el("table");
  const thead = el("thead");
  const trh = el("tr");
  for (const c of colunas) trh.append(el("th", { scope: "col", texto: c.titulo }));
  thead.append(trh);
  const tbody = el("tbody");
  for (const l of linhas) {
    const tr = el("tr");
    for (const c of colunas) {
      const v = c.valor(l);
      const td = el("td", { texto: v === null || v === undefined ? NAO_DISPONIVEL : String(v) });
      if (v === null || v === undefined) td.classList.add("sem-dado");
      if (c.numerica) td.classList.add("num");
      tr.append(td);
    }
    tbody.append(tr);
  }
  tabela.append(thead, tbody);
  // Tabelas largas rolam dentro da sua caixa; a página nunca rola na horizontal.
  detalhes.append(el("div", { class: "rolavel" }, [tabela]));
  raiz.append(detalhes);

  // --- CSV e fontes --------------------------------------------------------
  const rodape = el("div", { class: "figura__rodape" });
  const botao = el("button", {
    type: "button",
    class: "botao botao--discreto",
    texto: "Descarregar CSV",
  });
  botao.addEventListener("click", () => {
    const nome = `${titulo.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.csv`;
    descarregarCSV(nome, paraCSV(colunas, linhas));
  });
  rodape.append(botao);
  raiz.append(rodape);

  const fichas = el("div", { class: "figura__fonte" });
  fichas.append(el("span", { class: "figura__fonte-rot", texto: "Fonte" }));
  raiz.append(fichas);
  fichaDaFonte(fontes).then((l) => fichas.append(l));

  // --- Desenho responsivo --------------------------------------------------
  let ultimaLargura = 0;
  const redesenhar = () => {
    const largura = Math.max(240, Math.round(caixa.clientWidth));
    if (largura === ultimaLargura) return;
    ultimaLargura = largura;
    const altura = Math.round(
      alturaDe ? alturaDe(largura) : largura * proporcao,
    );
    svg.setAttribute("viewBox", `0 0 ${largura} ${altura}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.replaceChildren();
    desenhar(svg, largura, altura);
  };

  const observador = new ResizeObserver(redesenhar);
  // O observador só dispara depois de o nó estar no DOM; o chamador insere-o.
  queueMicrotask(() => {
    observador.observe(caixa);
    redesenhar();
  });

  return raiz;
}

export { el };
