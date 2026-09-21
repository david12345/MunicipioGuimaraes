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
import {
  barrasHorizontais,
  linhaTemporal,
  alturaBarras,
} from "../nucleo/graficos.js";
import { numero, dinheiro, dinheiroCurto, NAO_DISPONIVEL } from "../nucleo/formato.js";

/* Singular e plural, declarados. O português não pluraliza por acrescentar
 * "s": "empresa municipal" dá "empresas municipais", "associação" dá
 * "associações". Uma regra automática produzia "empresa municipals" e
 * "associaçãos" — e este texto é lido por pessoas. */
const NATUREZAS = {
  empresa_municipal: ["Empresa municipal", "empresas municipais"],
  empresa_intermunicipal: ["Empresa intermunicipal", "empresas intermunicipais"],
  cooperativa: ["Cooperativa", "cooperativas"],
  regie_cooperativa: ["Régie cooperativa", "régies cooperativas"],
  associacao: ["Associação", "associações"],
  associacao_municipios: ["Associação de municípios", "associações de municípios"],
  fundacao: ["Fundação", "fundações"],
  fundo: ["Fundo", "fundos"],
  pessoa_coletiva_publica: ["Pessoa coletiva pública", "pessoas coletivas públicas"],
};

function natureza(e) {
  return NATUREZAS[e.natureza]?.[0] ?? e.natureza_fonte ?? NAO_DISPONIVEL;
}

function naturezaPlural(chave, quantidade) {
  const par = NATUREZAS[chave];
  if (!par) return chave;
  return quantidade === 1 ? par[0].toLowerCase() : par[1];
}

export async function render(raiz) {
  const d = await carregar("empresas_municipais.json");
  const perimetro = d.entidades.filter((e) => e.no_perimetro_consolidacao);
  const fora = d.entidades.filter((e) => !e.no_perimetro_consolidacao);

  const contagem = new Map();
  for (const e of perimetro) {
    contagem.set(e.natureza, (contagem.get(e.natureza) ?? 0) + 1);
  }
  const resumoNaturezas = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([chave, q]) => `${q} ${naturezaPlural(chave, q)}`)
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
        "O financeiro de cada entidade — volume de negócios, resultado " +
          "líquido, transferências recebidas do município — não consta do " +
          "relatório de contas consolidadas: esse documento consolida, não " +
          "desagrega. Obtê-lo exigiria as contas de cada uma das onze " +
          "entidades, que são onze fontes diferentes. Abaixo estão os " +
          "agregados do grupo como um todo.",
      ],
    }),
  );

  // --- O grupo municipal como um todo --------------------------------------
  const serie = d.consolidado_por_ano ?? [];
  if (serie.length) {
    raiz.append(el("h3", { class: "sub-titulo", texto: "O grupo municipal em números" }));
    raiz.append(
      el("p", {
        class: "nota",
        texto:
          "Quando as contas das participadas se somam às do município, o " +
          "resultado é o “grupo municipal”. É uma imagem mais completa do que " +
          "as contas da Câmara sozinha: inclui o património e as dívidas das " +
          "entidades que ela controla.",
      }),
    );
    raiz.append(
      figura({
        titulo: "Ativo e passivo do grupo municipal",
        resumo:
          "O ativo é tudo o que o grupo possui; o passivo é tudo o que deve. " +
          "A diferença entre os dois é o património líquido.",
        proporcao: 0.6,
        desenhar: (svg, w, h) =>
          linhaTemporal(svg, w, h, {
            series: [
              { nome: "Ativo", pontos: serie.map((c) => ({ x: c.ano_referencia, y: c.ativo })) },
              { nome: "Passivo", pontos: serie.map((c) => ({ x: c.ano_referencia, y: c.passivo })) },
            ],
            formatar: dinheiroCurto,
            formatarX: String,
          }),
        colunas: [
          { titulo: "Ano", valor: (l) => l.ano_referencia },
          { titulo: "Ativo (€)", valor: (l) => l.ativo, numerica: true },
          { titulo: "Passivo (€)", valor: (l) => l.passivo, numerica: true },
          { titulo: "Património líquido (€)", valor: (l) => l.patrimonio_liquido, numerica: true },
          { titulo: "Resultado líquido (€)", valor: (l) => l.resultado_liquido, numerica: true },
        ],
        linhas: serie,
        fontes: serie.map((c) => c.fonte_id),
      }),
    );

    const resultados = serie.map((c) => ({
      rotulo: String(c.ano_referencia),
      valor: c.resultado_liquido,
    }));
    raiz.append(
      figura({
        titulo: "Resultado líquido do grupo, ano a ano",
        resumo:
          "O que sobrou depois de todos os gastos. Um resultado positivo não " +
          "é lucro a distribuir: fica no património do grupo.",
        altura: () => alturaBarras(resultados.length),
        desenhar: (svg, w, h) =>
          barrasHorizontais(svg, w, h, {
            dados: resultados,
            formatar: dinheiroCurto,
            corUnica: "var(--serie-3)",
          }),
        colunas: [
          { titulo: "Ano", valor: (l) => l.ano_referencia },
          { titulo: "Resultado líquido (€)", valor: (l) => l.resultado_liquido, numerica: true },
        ],
        linhas: serie,
        fontes: serie.map((c) => c.fonte_id),
      }),
    );
  }

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
