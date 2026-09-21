/* Secção 1 — Visão geral.
 *
 * É a primeira vista e tem de abrir em linguagem simples, não em gráficos:
 * quanto a Câmara prevê gastar, quanto isso dá por habitante, quanto executou
 * do que prometeu. O detalhe vem nas secções seguintes.
 *
 * Deriva dos outros ficheiros em vez de ter um próprio, por isso carrega
 * poucos kB — é o que mantém a primeira vista rápida.
 */

import { carregarVarios } from "../nucleo/dados.js";
import { el } from "../nucleo/figura.js";
import {
  dinheiro,
  dinheiroCurto,
  numero,
  pontosPercentuais,
  NAO_DISPONIVEL,
} from "../nucleo/formato.js";

function cartao({ rotulo, valor, nota, disponivel = true }) {
  const c = el("div", { class: "cartao" });
  c.append(el("p", { class: "cartao__rotulo", texto: rotulo }));
  const v = el("p", {
    class: disponivel ? "cartao__valor" : "cartao__valor sem-dado",
    texto: disponivel ? valor : NAO_DISPONIVEL,
  });
  c.append(v);
  if (nota) c.append(el("p", { class: "cartao__nota", texto: nota }));
  return c;
}

export async function render(raiz) {
  const [orcamento, populacao, pessoal, estrutura] = await carregarVarios([
    "orcamento.json",
    "populacao.json",
    "mapa_pessoal.json",
    "estrutura_organica.json",
  ]);

  const ultimo = orcamento?.exercicios?.at(-1) ?? null;
  const execucao = orcamento?.execucao?.at(-1) ?? null;
  const hab = populacao?.populacao_por_ano?.at(-1) ?? null;

  // --- Resumo em linguagem simples ----------------------------------------
  const resumo = el("p", { class: "resumo" });
  if (ultimo && hab) {
    // O orçamento de 2026 não tem população desse ano; usa-se a última
    // conhecida e diz-se qual é, em vez de calar a diferença.
    const porHabitante = ultimo.despesa_total / hab.total;
    resumo.innerHTML =
      `Em <strong>${ultimo.ano_referencia}</strong>, a Câmara Municipal de ` +
      `Guimarães prevê gastar <strong>${dinheiroCurto(ultimo.despesa_total)}</strong>. ` +
      `Divididos pelos <strong>${numero(hab.total)} habitantes</strong> do ` +
      `concelho em ${hab.ano}, dá <strong>${dinheiro(porHabitante)}</strong> ` +
      `por pessoa.`;
  } else {
    resumo.textContent =
      "Ainda não há orçamento extraído para apresentar um resumo.";
  }
  raiz.append(resumo);

  if (execucao) {
    raiz.append(
      el("p", {
        class: "resumo",
        html:
          `Mas orçamentar não é gastar: em <strong>${execucao.ano_referencia}</strong>, ` +
          `o último ano com contas fechadas, a Câmara executou ` +
          `<strong>${pontosPercentuais(execucao.grau_execucao_despesa_pct)}</strong> ` +
          `da despesa que tinha orçamentado. É um padrão constante — nos cinco ` +
          `anos com contas publicadas, a execução ficou sempre entre 79% e 84%.`,
      }),
    );
  }

  // --- Cartões -------------------------------------------------------------
  const cartoes = el("div", { class: "cartoes" });

  cartoes.append(
    cartao({
      rotulo: ultimo ? `Despesa orçamentada (${ultimo.ano_referencia})` : "Despesa orçamentada",
      valor: dinheiroCurto(ultimo?.despesa_total),
      nota: "Previsto, não gasto",
      disponivel: Boolean(ultimo),
    }),
  );

  cartoes.append(
    cartao({
      rotulo: hab ? `Habitantes (${hab.ano})` : "Habitantes",
      valor: numero(hab?.total),
      nota: "INE, estimativas anuais",
      disponivel: Boolean(hab),
    }),
  );

  cartoes.append(
    cartao({
      rotulo: pessoal ? `Postos de trabalho ocupados (${pessoal.ano_referencia})` : "Postos ocupados",
      valor: numero(pessoal?.total_postos_ocupados),
      nota: pessoal
        ? `de ${numero(pessoal.total_postos_previstos)} previstos`
        : null,
      disponivel: Boolean(pessoal),
    }),
  );

  cartoes.append(
    cartao({
      rotulo: "Unidades orgânicas",
      valor: numero(estrutura?.total_unidades),
      nota: "Direções, departamentos, divisões e gabinetes",
      disponivel: Boolean(estrutura),
    }),
  );

  raiz.append(cartoes);

  raiz.append(
    el("p", {
      class: "nota",
      texto:
        "Três das doze secções ainda não têm dados: obras, investimentos e " +
        "comparação com outros municípios. Ficam em branco e dizem porquê, em " +
        "vez de mostrarem estimativas.",
    }),
  );
}
