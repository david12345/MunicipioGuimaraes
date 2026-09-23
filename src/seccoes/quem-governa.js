/* Secção 2 — Quem governa.
 *
 * O hemiciclo, que seria a forma habitual, não está aqui: exigiria a
 * distribuição da Assembleia Municipal por força política, que a Câmara não
 * publica. O que há são os resultados da Câmara — e esses lêem-se melhor em
 * barras horizontais, que funcionam igual em 360 px e em 1280 px.
 */

import { carregarVarios } from "../nucleo/dados.js";
import { figura, el } from "../nucleo/figura.js";
import { barrasHorizontais, corDaSerie, alturaBarras } from "../nucleo/graficos.js";
import { numero, pontosPercentuais } from "../nucleo/formato.js";

function cartaoMembro(m) {
  const c = el("article", { class: "membro" });
  c.append(el("h4", { class: "membro__nome", texto: m.nome }));

  const cargo =
    m.cargo === "presidente"
      ? "Presidente"
      : m.cargo === "vice_presidente"
        ? "Vice-presidente"
        : "Vereador";
  const linha = [cargo, m.partido].filter(Boolean).join(" · ");
  c.append(el("p", { class: "membro__cargo", texto: linha }));

  if (m.coligacao) {
    c.append(el("p", { class: "membro__coligacao", texto: `Coligação "${m.coligacao}"` }));
  }

  if (m.em_permanencia === false) {
    c.append(
      el("p", {
        class: "membro__nota",
        texto: "Sem competências delegadas (não exerce em permanência)",
      }),
    );
  }

  if (m.pelouros?.length) {
    const d = el("details", { class: "membro__pelouros" });
    d.append(el("summary", { texto: `${m.pelouros.length} pelouros` }));
    const ul = el("ul");
    for (const p of m.pelouros) ul.append(el("li", { texto: p }));
    d.append(ul);
    c.append(d);
  }

  if (m.email) {
    c.append(
      el("p", { class: "membro__contacto" }, [
        el("a", { href: `mailto:${m.email}`, texto: m.email }),
      ]),
    );
  }
  return c;
}

export async function render(raiz) {
  const [executivo, orgaos] = await carregarVarios([
    "executivo.json",
    "orgaos_eleitos.json",
  ]);

  const cm = orgaos?.camara_municipal;
  const mandato = executivo?.mandato;

  raiz.append(
    el("p", {
      class: "resumo",
      html:
        `A Câmara Municipal é o órgão executivo do município: são ` +
        `<strong>${numero(cm?.total_mandatos)} membros</strong>, eleitos ` +
        `diretamente a <strong>12 de outubro de 2025</strong> para o mandato ` +
        `de ${mandato?.inicio}–${mandato?.fim}. Tomaram posse a 25 de outubro.`,
    }),
  );

  // --- Resultados eleitorais ----------------------------------------------
  if (cm?.resultados?.length) {
    const dados = cm.resultados.map((r, i) => ({
      rotulo: r.coligacao ? `${r.coligacao} (${r.forca_politica})` : r.forca_politica,
      valor: r.mandatos,
      cor: corDaSerie(i),
    }));

    raiz.append(
      figura({
        titulo: "Mandatos na Câmara Municipal",
        resumo:
          "A coligação mais votada tem maioria absoluta: seis dos onze " +
          "lugares. As percentagens ao lado são a votação de cada força.",
        altura: (l) => alturaBarras(dados.length, l),
        desenhar: (svg, w, h) =>
          barrasHorizontais(svg, w, h, {
            dados,
            formatar: (v) => `${v} mandatos`,
          }),
        colunas: [
          { titulo: "Força política", valor: (l) => l.forca_politica },
          { titulo: "Coligação", valor: (l) => l.coligacao },
          { titulo: "Votação (%)", valor: (l) => l.percentagem, numerica: true },
          { titulo: "Mandatos", valor: (l) => l.mandatos, numerica: true },
          { titulo: "Votos", valor: (l) => l.votos, numerica: true },
        ],
        linhas: cm.resultados,
        fontes: cm.fonte_id,
        avisos: [
          "A Câmara só publica as forças que obtiveram mandato. As " +
            "percentagens somam " +
            pontosPercentuais(
              cm.resultados.reduce((s, r) => s + (r.percentagem ?? 0), 0),
            ) +
            " — os restantes votos não estão repartidos na fonte e não são " +
            "repartidos aqui. Votos absolutos e abstenção não são publicados.",
        ],
      }),
    );
  }

  // --- Assembleia Municipal ------------------------------------------------
  const am = orgaos?.assembleia_municipal;
  if (am) {
    const bloco = el("div", { class: "sem-dados" });
    bloco.append(
      el("p", { class: "sem-dados__rotulo", texto: "Composição por partido: Dado não disponível" }),
    );
    bloco.append(
      el("p", {
        html:
          `A Assembleia Municipal é o órgão deliberativo e tem ` +
          `<strong>${numero(am.total_mandatos)} membros</strong>: ` +
          `${numero(am.mandatos_eleitos)} eleitos diretamente e ` +
          `${numero(am.mandatos_inerencia)} presidentes de junta de freguesia, ` +
          `por inerência do cargo.`,
      }),
    );
    bloco.append(
      el("p", {
        class: "sem-dados__nota",
        texto:
          "A Câmara publica a dimensão do órgão, mas não a distribuição por " +
          "força política nem os nomes. Essa informação existe no Mapa Oficial " +
          "das eleições, publicado em Diário da República — mas esse documento " +
          "é digitalizado e teria de passar por reconhecimento ótico, que sobre " +
          "uma fonte com valor legal exige revisão humana. Por isso não há aqui " +
          "hemiciclo.",
      }),
    );
    raiz.append(el("h3", { class: "sub-titulo", texto: "Assembleia Municipal" }));
    raiz.append(bloco);
  }

  // --- Executivo -----------------------------------------------------------
  if (executivo?.membros?.length) {
    raiz.append(el("h3", { class: "sub-titulo", texto: "O executivo, um a um" }));
    raiz.append(
      el("p", {
        class: "nota",
        texto:
          "Os pelouros são as áreas por que cada membro responde. Vereadores " +
          "sem competências delegadas não têm pelouro e não exercem a tempo inteiro.",
      }),
    );
    const grelha = el("div", { class: "membros" });
    for (const m of executivo.membros) grelha.append(cartaoMembro(m));
    raiz.append(grelha);

    const semPelouro = executivo.membros.filter(
      (m) => m.em_permanencia === false,
    ).length;
    raiz.append(
      el("p", {
        class: "nota",
        texto:
          `${executivo.membros.length - semPelouro} membros exercem em ` +
          `permanência e com pelouros; ${semPelouro} são vereadores sem ` +
          "competências delegadas. Fonte: páginas do executivo e da Câmara " +
          "Municipal, no sítio do Município.",
      }),
    );
  }
}
