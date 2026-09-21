/* Secção 12 — Fontes e metodologia.
 *
 * É a secção que sustenta todas as outras. Cada número do dashboard aponta
 * para uma entrada desta lista; sem ela, o resto é só afirmação.
 */

import { carregar } from "../nucleo/dados.js";
import { el } from "../nucleo/figura.js";
import { numero, data as formatarData, NAO_DISPONIVEL } from "../nucleo/formato.js";

const VERIFICACAO = {
  PRIM: ["Lida na fonte", "O conteúdo foi lido no documento original."],
  DESC: [
    "Descarregada",
    "O ficheiro foi obtido e tem soma de controlo, mas o conteúdo ainda não foi lido.",
  ],
  "URL-S": ["Endereço por confirmar", "O endereço responde, mas o conteúdo não foi verificado."],
  "EXIST-S": ["Existência por confirmar", "Sabe-se que o documento existe; falta o endereço exato."],
  CONHEC: ["Por confirmar", "Identificada por conhecimento do domínio; a confirmar integralmente."],
};

export async function render(raiz) {
  const d = await carregar("fontes.json");
  const fontes = Object.values(d.dados);
  const lidas = fontes.filter((f) => f.verificacao === "PRIM").length;

  raiz.append(
    el("p", {
      class: "resumo",
      html:
        `Cada número deste dashboard vem de um documento público identificado. ` +
        `São <strong>${numero(fontes.length)} fontes</strong>, das quais ` +
        `<strong>${numero(lidas)}</strong> tiveram o conteúdo lido no original. ` +
        `De todas se guarda uma soma de controlo — é assim que se deteta que ` +
        `um documento foi substituído mantendo o mesmo endereço, prática ` +
        `comum nos sítios das autarquias.`,
    }),
  );

  raiz.append(
    el("p", {
      class: "nota",
      texto:
        "Quando uma fonte não diz um número, o dashboard mostra “Dado não " +
        "disponível”. Nunca zero, nunca uma estimativa silenciosa. Distinguir " +
        "“zero euros” de “não sabemos” é a diferença entre informar e enganar.",
    }),
  );

  // --- Como se lê o estado de verificação ---------------------------------
  const legenda = el("dl", { class: "legenda-verificacao" });
  for (const [chave, [titulo, desc]] of Object.entries(VERIFICACAO)) {
    legenda.append(el("dt", { texto: titulo }));
    legenda.append(el("dd", { texto: desc }));
  }
  const dl = el("details", { class: "figura__tabela" });
  dl.append(el("summary", { texto: "Como se lê o estado de cada fonte" }));
  dl.append(legenda);
  raiz.append(dl);

  // --- Tabela das fontes ---------------------------------------------------
  const tabela = el("table", { class: "tabela-fontes" });
  const thead = el("tr");
  for (const h of ["Fonte", "Entidade", "Ano", "Estado", "Recolhida em"]) {
    thead.append(el("th", { scope: "col", texto: h }));
  }
  tabela.append(el("thead", {}, [thead]));

  const tbody = el("tbody");
  for (const f of fontes.sort((a, b) => a.id.localeCompare(b.id, "pt"))) {
    const tr = el("tr");

    const tdNome = el("td");
    if (f.url) {
      tdNome.append(
        el("a", { href: f.url, rel: "noopener", target: "_blank", texto: f.nome }),
      );
    } else {
      tdNome.textContent = f.nome;
    }
    if (f.limitacoes) {
      const d2 = el("details", { class: "limitacao" });
      d2.append(el("summary", { texto: "Limitações" }));
      d2.append(el("p", { texto: f.limitacoes }));
      tdNome.append(d2);
    }
    tr.append(tdNome);

    tr.append(el("td", { texto: f.entidade ?? NAO_DISPONIVEL }));
    tr.append(el("td", { class: "num", texto: f.ano_referencia ?? "—" }));

    const estado = VERIFICACAO[f.verificacao]?.[0] ?? f.verificacao;
    tr.append(
      el("td", {}, [
        el("span", {
          class: `selo selo--${(f.verificacao ?? "").toLowerCase().replace(/[^a-z]/g, "")}`,
          texto: estado,
        }),
      ]),
    );

    tr.append(
      el("td", {
        texto: f.data_download ? formatarData(f.data_download) : NAO_DISPONIVEL,
      }),
    );
    tbody.append(tr);
  }
  tabela.append(tbody);
  raiz.append(el("div", { class: "rolavel" }, [tabela]));

  raiz.append(
    el("p", {
      class: "nota",
      texto:
        "O registo completo de lacunas, discrepâncias e validações está em " +
        "docs/qualidade_dados.md no repositório. Todas as extrações são " +
        "verificadas por validações bloqueantes: um número que não bata " +
        "certo com o total do próprio documento não é publicado.",
    }),
  );
}
