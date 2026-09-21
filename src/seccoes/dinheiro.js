/* Secção 5 — De onde vem o dinheiro.
 *
 * Dois gráficos e uma distinção que o dashboard tem de deixar clara: uma coisa
 * é o orçamento aprovado, outra é o que foi mesmo executado. O documento
 * previsional dá o primeiro, os Relatórios e Contas dão o segundo, e nunca se
 * misturam na mesma série.
 */

import { carregar } from "../nucleo/dados.js";
import { figura, el } from "../nucleo/figura.js";
import { barrasHorizontais, linhaTemporal, legenda, alturaBarras } from "../nucleo/graficos.js";
import { dinheiroCurto, pontosPercentuais } from "../nucleo/formato.js";

export async function render(raiz) {
  const d = await carregar("orcamento.json");
  const exercicios = d.exercicios ?? [];
  const execucao = d.execucao ?? [];
  const ultimo = exercicios.at(-1);

  raiz.append(
    el("p", {
      class: "resumo",
      html:
        `O orçamento é a previsão do que a Câmara espera arrecadar e gastar num ` +
        `ano. Por lei tem de estar equilibrado: a receita prevista é exatamente ` +
        `igual à despesa prevista. Em ${ultimo.ano_referencia} são ` +
        `<strong>${dinheiroCurto(ultimo.despesa_total)}</strong> dos dois lados.`,
    }),
  );

  // --- Como se reparte a despesa prevista ---------------------------------
  const reparticao = [
    { rotulo: "Despesa corrente", valor: ultimo.despesa_corrente },
    { rotulo: "Despesa de capital", valor: ultimo.despesa_capital },
  ];
  raiz.append(
    figura({
      titulo: `Como se reparte a despesa prevista para ${ultimo.ano_referencia}`,
      resumo:
        "Despesa corrente é o funcionamento do dia a dia — salários, " +
        "eletricidade, serviços. Despesa de capital é investimento: obras, " +
        "equipamento, aquisição de património.",
      altura: () => alturaBarras(reparticao.length),
      desenhar: (svg, w, h) =>
        barrasHorizontais(svg, w, h, {
          dados: reparticao,
          formatar: dinheiroCurto,
        }),
      colunas: [
        { titulo: "Rubrica", valor: (l) => l.rotulo },
        { titulo: "Valor (€)", valor: (l) => l.valor, numerica: true },
      ],
      linhas: reparticao,
      fontes: ultimo.fonte_id,
    }),
  );

  // --- Evolução: orçamentado -----------------------------------------------
  const serieOrcamento = {
    nome: "Despesa orçamentada",
    pontos: exercicios.map((e) => ({ x: e.ano_referencia, y: e.despesa_total })),
  };
  raiz.append(
    figura({
      titulo: "Despesa orçamentada, ano a ano",
      resumo:
        "O orçamento do município duplicou entre 2022 e 2025. Os valores são " +
        "os aprovados, não os executados.",
      proporcao: 0.58,
      desenhar: (svg, w, h) =>
        linhaTemporal(svg, w, h, {
          series: [serieOrcamento],
          formatar: dinheiroCurto,
          formatarX: String,
        }),
      colunas: [
        { titulo: "Ano", valor: (l) => l.ano_referencia },
        { titulo: "Receita total (€)", valor: (l) => l.receita_total, numerica: true },
        { titulo: "Despesa total (€)", valor: (l) => l.despesa_total, numerica: true },
        { titulo: "Despesa corrente (€)", valor: (l) => l.despesa_corrente, numerica: true },
        { titulo: "Despesa de capital (€)", valor: (l) => l.despesa_capital, numerica: true },
        {
          titulo: "Despesa por habitante (€)",
          valor: (l) => l.despesa_total_por_habitante,
          numerica: true,
        },
      ],
      linhas: exercicios,
      fontes: exercicios.map((e) => e.fonte_id),
      avisos: (d._meta.avisos ?? []).filter((a) => a.includes("2021") || a.includes("população")),
    }),
  );

  // --- Execução ------------------------------------------------------------
  if (execucao.length) {
    const grau = execucao.map((e) => ({
      rotulo: String(e.ano_referencia),
      valor: e.grau_execucao_despesa_pct,
    }));
    const fig = figura({
      titulo: "Quanto da despesa orçamentada foi mesmo executada",
      resumo:
        "A Câmara gasta menos do que orçamenta, todos os anos. O que sobra " +
        "não é poupança: é obra e serviço que estavam previstos e não se " +
        "concretizaram no ano.",
      altura: () => alturaBarras(grau.length),
      desenhar: (svg, w, h) =>
        barrasHorizontais(svg, w, h, {
          dados: grau,
          formatar: (v) => pontosPercentuais(v),
          corUnica: "var(--serie-3)",
          maximo: 100,
        }),
      colunas: [
        { titulo: "Ano", valor: (l) => l.ano_referencia },
        {
          titulo: "Execução da despesa (%)",
          valor: (l) => l.grau_execucao_despesa_pct,
          numerica: true,
        },
        {
          titulo: "Execução da receita (%)",
          valor: (l) => l.grau_execucao_receita_pct,
          numerica: true,
        },
        {
          titulo: "Despesa corrente paga (€)",
          valor: (l) => l.despesas_correntes_pagas,
          numerica: true,
        },
        {
          titulo: "Receita corrente cobrada (€)",
          valor: (l) => l.receitas_correntes_cobradas_brutas,
          numerica: true,
        },
        { titulo: "Saldo global (€)", valor: (l) => l.saldo_global, numerica: true },
      ],
      linhas: execucao,
      fontes: execucao.map((e) => e.fonte_id),
      avisos: [
        "O total gasto no ano não é publicado com rótulo nos Relatórios e " +
          "Contas — existe nos mapas de execução, mas em linhas identificadas " +
          "só pela posição na página. Por isso mostra-se o grau de execução e " +
          "a despesa corrente paga, e não um total que teria de ser adivinhado.",
      ],
    });
    raiz.append(fig);

    // --- Receita corrente cobrada vs despesa corrente paga ------------------
    const series = [
      {
        nome: "Receita corrente cobrada",
        pontos: execucao.map((e) => ({
          x: e.ano_referencia,
          y: e.receitas_correntes_cobradas_brutas ?? null,
        })),
      },
      {
        nome: "Despesa corrente paga",
        pontos: execucao.map((e) => ({
          x: e.ano_referencia,
          y: e.despesas_correntes_pagas ?? null,
        })),
      },
    ];
    const figDuas = figura({
      titulo: "Receita corrente cobrada e despesa corrente paga",
      resumo:
        "A lei obriga a que a receita corrente cobrada cubra a despesa " +
        "corrente. A distância entre as duas linhas é a folga com que o " +
        "município cumpre essa regra.",
      proporcao: 0.6,
      desenhar: (svg, w, h) =>
        linhaTemporal(svg, w, h, {
          series,
          formatar: dinheiroCurto,
          formatarX: String,
        }),
      colunas: [
        { titulo: "Ano", valor: (l) => l.ano_referencia },
        {
          titulo: "Receita corrente cobrada (€)",
          valor: (l) => l.receitas_correntes_cobradas_brutas,
          numerica: true,
        },
        {
          titulo: "Despesa corrente paga (€)",
          valor: (l) => l.despesas_correntes_pagas,
          numerica: true,
        },
      ],
      linhas: execucao,
      fontes: execucao.map((e) => e.fonte_id),
    });
    figDuas.querySelector(".figura__tela").after(
      legenda(series.map((s) => s.nome)),
    );
    raiz.append(figDuas);
  }

  raiz.append(
    el("p", {
      class: "nota",
      texto:
        "Orçamentado vem dos documentos previsionais aprovados; executado vem " +
        "dos Relatórios e Contas. São documentos diferentes e nunca se misturam " +
        "na mesma série.",
    }),
  );
}
