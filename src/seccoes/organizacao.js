/* Secção 3 — Como está organizada.
 *
 * Um organograma em caixas e linhas não sobrevive a um ecrã de 360 px: ou
 * encolhe até ser ilegível, ou obriga a rolar na horizontal. A alternativa
 * exigida pelo briefing é um desdobrável com drill-down, e é o que está aqui —
 * a mesma árvore, aberta nível a nível, que funciona igual no telemóvel e no
 * portátil e é navegável por teclado sem nada de especial.
 */

import { carregar } from "../nucleo/dados.js";
import { el } from "../nucleo/figura.js";
import { numero } from "../nucleo/formato.js";

const TIPOS = {
  municipio: "Município",
  direcao_municipal: "Direção municipal",
  departamento: "Departamento",
  divisao: "Divisão",
  gabinete: "Gabinete",
  servico: "Serviço",
  unidade: "Unidade",
};

function contar(no) {
  return 1 + (no.filhos ?? []).reduce((s, f) => s + contar(f), 0);
}

function ramo(no, nivel) {
  const temFilhos = (no.filhos ?? []).length > 0;
  const item = el("li", { class: `ramo ramo--n${Math.min(nivel, 3)}` });

  const etiqueta = el("span", { class: "ramo__etiqueta" }, [
    el("span", { class: "ramo__nome", texto: no.nome }),
    no.sigla
      ? el("span", { class: "ramo__sigla", texto: no.sigla })
      : el("span", {
          class: "ramo__sigla ramo__sigla--nenhuma",
          texto: "sem sigla",
          title: "O texto normativo não atribui sigla a esta unidade.",
        }),
    el("span", { class: "ramo__tipo", texto: TIPOS[no.tipo] ?? no.tipo }),
  ]);

  if (!temFilhos) {
    item.append(el("div", { class: "ramo__folha" }, [etiqueta]));
    return item;
  }

  const d = el("details", { class: "ramo__caixa" });
  // Os dois primeiros níveis abrem de origem; abaixo disso fecha, senão o
  // telemóvel recebe 48 unidades de uma vez.
  if (nivel < 2) d.setAttribute("open", "");
  const s = el("summary", { class: "ramo__resumo" });
  s.append(etiqueta);
  s.append(
    el("span", {
      class: "ramo__contagem",
      texto: `${no.filhos.length} ${no.filhos.length === 1 ? "unidade" : "unidades"}`,
    }),
  );
  d.append(s);

  const ul = el("ul", { class: "ramo__filhos" });
  for (const f of no.filhos) ul.append(ramo(f, nivel + 1));
  d.append(ul);
  item.append(d);
  return item;
}

export async function render(raiz) {
  const d = await carregar("estrutura_organica.json");
  const arvore = d.arvore;

  raiz.append(
    el("p", {
      class: "resumo",
      html:
        `Os serviços do município organizam-se em ` +
        `<strong>${numero(d.total_unidades)} unidades orgânicas</strong>, de ` +
        `direções municipais a gabinetes. Toque numa para ver o que tem por baixo.`,
    }),
  );

  raiz.append(
    el("p", {
      class: "nota",
      texto:
        "A hierarquia vem do texto publicado em Diário da República, não do " +
        "diagrama que a Câmara divulga — é o texto que tem valor legal. " +
        "Foram precisos três documentos: a estrutura de 2022 e as duas " +
        "alterações de 2024.",
    }),
  );

  const lista = el("ul", { class: "arvore" });
  lista.append(ramo(arvore, 0));
  raiz.append(lista);

  // --- Cadeia normativa ----------------------------------------------------
  const cadeia = el("details", { class: "figura__tabela cadeia" });
  cadeia.append(el("summary", { texto: "Que documentos definem esta estrutura" }));
  const ol = el("ol");
  for (const linha of d._meta.cadeia_normativa ?? []) {
    ol.append(el("li", { texto: linha.replace(/^S\d+[^:]*:\s*/, "") }));
  }
  cadeia.append(ol);

  if (d._meta.alteracoes_aplicadas?.length) {
    cadeia.append(el("p", { class: "nota", texto: "Alterações aplicadas:" }));
    const ul = el("ul");
    for (const a of d._meta.alteracoes_aplicadas) {
      ul.append(el("li", { texto: a.replace(/^S\d+:\s*/, "") }));
    }
    cadeia.append(ul);
  }
  raiz.append(cadeia);

  for (const aviso of d._meta.avisos ?? []) {
    raiz.append(el("p", { class: "figura__aviso", texto: aviso }));
  }
}
