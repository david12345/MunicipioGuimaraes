/* Secção 9 — Empresas e entidades participadas.
 *
 * O nome da secção não é "empresas municipais" de propósito: das onze
 * entidades que entram no perímetro de consolidação, só duas são empresas
 * municipais. Há uma empresa intermunicipal, quatro cooperativas, uma régie
 * cooperativa, uma fundação e duas associações. Tratá-las como equivalentes
 * seria factualmente errado, e é por isso que a natureza aparece sempre.
 */

import { carregar } from "../nucleo/dados.js";
import { figura, el } from "../nucleo/figura.js";
import { barrasHorizontais, alturaBarras } from "../nucleo/graficos.js";
import { numero, dinheiro, NAO_DISPONIVEL } from "../nucleo/formato.js";

const NATUREZAS = {
  empresa_municipal: "Empresa municipal",
  empresa_intermunicipal: "Empresa intermunicipal",
  cooperativa: "Cooperativa",
  regie_cooperativa: "Régie cooperativa",
  associacao: "Associação",
  associacao_municipios: "Associação de municípios",
  fundacao: "Fundação",
  fundo: "Fundo",
  pessoa_coletiva_publica: "Pessoa coletiva pública",
};

function natureza(e) {
  return NATUREZAS[e.natureza] ?? e.natureza_fonte ?? NAO_DISPONIVEL;
}

export async function render(raiz) {
  const d = await carregar("empresas_municipais.json");
  const perimetro = d.entidades.filter((e) => e.no_perimetro_consolidacao);
  const fora = d.entidades.filter((e) => !e.no_perimetro_consolidacao);

  const contagem = new Map();
  for (const e of perimetro) {
    const n = natureza(e);
    contagem.set(n, (contagem.get(n) ?? 0) + 1);
  }
  const resumoNaturezas = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([n, q]) => `${q} ${q === 1 ? n.toLowerCase() : `${n.toLowerCase()}s`}`)
    .join(", ");

  raiz.append(
    el("p", {
      class: "resumo",
      html:
        `O Município participa em <strong>${numero(d.total_entidades)} entidades</strong>. ` +
        `<strong>${numero(d.total_no_perimetro)}</strong> entram no perímetro de ` +
        `consolidação de contas, ou seja, as suas contas somam-se às do ` +
        `município: ${resumoNaturezas}.`,
    }),
  );

  raiz.append(
    el("p", {
      class: "nota",
      texto:
        "Nem todas são empresas. A distinção importa: uma cooperativa, uma " +
        "fundação e uma empresa municipal têm regimes, obrigações e órgãos " +
        "diferentes. A natureza indicada é a que consta do documento de contas.",
    }),
  );

  // --- Participação do município -------------------------------------------
  const comPct = perimetro
    .filter((e) => e.participacao_municipio_pct !== null)
    .sort((a, b) => b.participacao_municipio_pct - a.participacao_municipio_pct);

  raiz.append(
    figura({
      titulo: "Quanto o Município detém de cada entidade",
      resumo:
        "Percentagem de participação do município nas entidades que entram " +
        "no perímetro de consolidação.",
      altura: () => alturaBarras(comPct.length),
      desenhar: (svg, w, h) =>
        barrasHorizontais(svg, w, h, {
          dados: comPct.map((e) => ({
            rotulo: e.nome,
            valor: e.participacao_municipio_pct,
          })),
          formatar: (v) => `${String(v).replace(".", ",")}%`,
          corUnica: "var(--serie-7)",
          maximo: 100,
        }),
      colunas: [
        { titulo: "Entidade", valor: (l) => l.nome },
        { titulo: "NIF", valor: (l) => l.nif },
        { titulo: "Natureza", valor: (l) => natureza(l) },
        {
          titulo: "Participação (%)",
          valor: (l) => l.participacao_municipio_pct,
          numerica: true,
        },
        {
          titulo: "Valor subscrito (€)",
          valor: (l) => l.valor_subscrito,
          numerica: true,
        },
        { titulo: "Método", valor: (l) => l.metodo_consolidacao },
      ],
      linhas: perimetro,
      fontes: perimetro[0]?.fonte_id ?? "S11",
      avisos: [
        "Os dados financeiros de cada entidade — volume de negócios, " +
          "resultado líquido, transferências recebidas do município — ainda " +
          "não foram extraídos. Estão nos relatórios de consolidação de " +
          "contas, que estão localizados mas por processar.",
      ],
    }),
  );

  // --- Fora do perímetro ---------------------------------------------------
  const detalhes = el("details", { class: "figura__tabela figura" });
  detalhes.append(
    el("summary", {
      texto: `As outras ${numero(fora.length)} entidades em que o Município participa`,
    }),
  );
  detalhes.append(
    el("p", {
      class: "nota",
      texto:
        "Participações pequenas ou quotas de associações. Não entram no " +
        "perímetro de consolidação e as suas contas não se somam às do município.",
    }),
  );
  const t = el("table");
  const thead = el("tr");
  for (const h of ["Entidade", "NIF", "Natureza", "Participação", "Valor subscrito"]) {
    thead.append(el("th", { scope: "col", texto: h }));
  }
  t.append(el("thead", {}, [thead]));
  const tbody = el("tbody");
  for (const e of fora) {
    const tr = el("tr");
    tr.append(el("td", { texto: e.nome }));
    tr.append(el("td", { texto: e.nif ?? NAO_DISPONIVEL }));
    tr.append(el("td", { texto: natureza(e) }));
    tr.append(
      el("td", {
        class: "num",
        texto:
          e.participacao_municipio_pct === null
            ? NAO_DISPONIVEL
            : `${String(e.participacao_municipio_pct).replace(".", ",")}%`,
      }),
    );
    tr.append(el("td", { class: "num", texto: dinheiro(e.valor_subscrito) }));
    tbody.append(tr);
  }
  t.append(tbody);
  detalhes.append(el("div", { class: "rolavel" }, [t]));
  raiz.append(detalhes);
}
