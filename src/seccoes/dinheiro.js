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
import {
  dinheiroCurto,
  pontosPercentuais,
  nomeUnidade,
  rotuloRubrica,
} from "../nucleo/formato.js";
import { marcarTermos } from "../nucleo/glossario.js";

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
      altura: (l) => alturaBarras(reparticao.length, l),
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


  // --- Quanto custa cada estrutura da Câmara -------------------------------
  //
  // A classificação orgânica responde a "quem gasta", que é a pergunta que o
  // organograma sozinho não responde. Desce-se pela hierarquia que o próprio
  // orçamento tem: unidade → subunidade, quando existe → natureza da despesa.
  const org = await carregar("orcamento_organico.json");
  const ultimoOrg = org.exercicios.at(-1);
  const porCodigo = new Map(ultimoOrg.unidades.map((u) => [u.codigo, u]));
  const filhosDe = (c) => ultimoOrg.unidades.filter((u) => u.codigo_pai === c);

  raiz.append(
    el("p", {
      class: "nota",
      texto:
        "Toque numa barra para ver o detalhe: de unidade para a natureza da " +
        "despesa — pessoal, bens e serviços, investimento. O caminho no topo " +
        "do gráfico volta atrás.",
    }),
  );

  let caminho = [];
  const caixaOrg = el("div");
  raiz.append(caixaOrg);

  /* O que mostrar no nível em que se está, e o que isso significa. */
  const nivelActual = () => {
    if (!caminho.length) {
      return {
        cabe: "unidade",
        unidades: ultimoOrg.unidades.filter((u) => u.nivel === 1),
        barras: ultimoOrg.unidades
          .filter((u) => u.nivel === 1)
          .map((u) => ({ rotulo: nomeUnidade(u.nome), valor: u.total, codigo: u.codigo })),
      };
    }
    const u = porCodigo.get(caminho.at(-1));
    const filhos = filhosDe(u.codigo);
    if (filhos.length) {
      return {
        cabe: "subunidade",
        unidades: filhos,
        barras: filhos.map((f) => ({
          rotulo: nomeUnidade(f.nome),
          valor: f.total,
          codigo: f.codigo,
        })),
      };
    }
    return {
      cabe: "natureza",
      unidades: u.por_natureza,
      barras: u.por_natureza.map((n) => ({
        rotulo: rotuloRubrica(n.nome),
        valor: n.valor,
        codigo: null,
      })),
    };
  };

  const desenharOrg = () => {
    const nivel = nivelActual();
    const unidade = caminho.length ? porCodigo.get(caminho.at(-1)) : null;
    const total = nivel.barras.reduce((s, b) => s + (b.valor ?? 0), 0);

    // Só desce quem tem para onde: uma unidade sem subunidades ainda desce à
    // natureza da despesa; uma natureza já é o fim da linha.
    const podeDescer = (b) => nivel.cabe !== "natureza" && b.codigo !== null;

    const ligada = unidade?.unidade_estrutura ?? null;
    const fig = figura({
      titulo: unidade
        ? `${nomeUnidade(unidade.nome)} — ${nivel.cabe === "natureza" ? "em que gasta" : "unidades"}`
        : `Quanto custa cada estrutura da Câmara em ${ultimoOrg.ano_referencia}`,
      resumo: unidade
        ? `${dinheiroCurto(unidade.total)} orçamentados, ` +
          `${pontosPercentuais((unidade.total / ultimoOrg.despesa_total) * 100)} ` +
          `da despesa do município` +
          (ligada
            ? `. No organograma é a ${ligada.sigla}.`
            : unidade.codigo.startsWith("01")
              ? ". Não é um serviço da Câmara: é uma rubrica de agrupamento."
              : ". O organograma não tem nenhuma unidade com este nome — " +
                "o orçamento e o despacho da estrutura orgânica não foram " +
                "escritos ao mesmo tempo.")
        : "A classificação orgânica do orçamento arruma a despesa por quem a " +
          "gasta. «Administração Municipal» não é um serviço: junta os órgãos " +
          "políticos, as pensões de antigos trabalhadores e o pagamento da dívida.",
      altura: (l) => alturaBarras(nivel.barras.length, l),
      desenhar: (svg, w, h) =>
        barrasHorizontais(svg, w, h, {
          dados: nivel.barras,
          formatar: dinheiroCurto,
          corUnica: nivel.cabe === "natureza" ? "var(--serie-5)" : "var(--serie-1)",
          temDetalhe: podeDescer,
          aoEscolher: (b) => {
            caminho = [...caminho, b.codigo];
            desenharOrg();
          },
        }),
      colunas:
        nivel.cabe === "natureza"
          ? [
              { titulo: "Natureza da despesa", valor: (l) => rotuloRubrica(l.nome) },
              { titulo: "Código económico", valor: (l) => l.codigo },
              { titulo: "Valor (€)", valor: (l) => l.valor, numerica: true },
            ]
          : [
              { titulo: "Unidade", valor: (l) => nomeUnidade(l.nome) },
              { titulo: "Código orgânico", valor: (l) => l.codigo },
              { titulo: "No organograma", valor: (l) => l.unidade_estrutura?.sigla ?? null },
              { titulo: "Orçamento (€)", valor: (l) => l.total, numerica: true },
              {
                titulo: "% da despesa",
                valor: (l) => Number(((l.total / ultimoOrg.despesa_total) * 100).toFixed(2)),
                numerica: true,
              },
            ],
      linhas: nivel.unidades,
      fontes: ultimoOrg.fonte_id,
      // Um só aviso acima do gráfico, e é o que impede uma leitura errada.
      // Os outros dois são notas de proveniência: valem a pena, mas não valem
      // empurrar o gráfico para fora do ecrã num telemóvel.
      avisos:
        caminho.length === 0
          ? [
              "É orçamento, não despesa realizada. A Câmara executa entre 79% " +
                "e 84% do que orçamenta, e o documento não reparte a execução " +
                "por unidade.",
            ]
          : [],
    });

    // --- Caminho de volta ---------------------------------------------------
    const trilho = el("nav", {
      class: "trilho",
      "aria-label": "Onde está na despesa por unidade",
    });
    const passos = [{ rotulo: "Todas as unidades", ate: 0 }].concat(
      caminho.map((c, i) => ({ rotulo: nomeUnidade(porCodigo.get(c).nome), ate: i + 1 })),
    );
    passos.forEach((passo, i) => {
      if (i === passos.length - 1) {
        trilho.append(
          el("span", { class: "trilho__atual", "aria-current": "true", texto: passo.rotulo }),
        );
        return;
      }
      const b = el("button", { type: "button", class: "trilho__passo", texto: passo.rotulo });
      b.addEventListener("click", () => {
        caminho = caminho.slice(0, passo.ate);
        desenharOrg();
      });
      trilho.append(b, el("span", { class: "trilho__seta", "aria-hidden": "true", texto: "›" }));
    });
    fig.querySelector(".figura__titulo").after(trilho);

    caixaOrg.replaceChildren(fig);

    if (caminho.length === 0) {
      const soltas = ultimoOrg.unidades.filter(
        (u) => u.nivel === 1 && !u.unidade_estrutura && !u.codigo.startsWith("01"),
      );
      caixaOrg.append(
        el("p", {
          class: "nota",
          texto:
            `As sete unidades somam ${dinheiroCurto(total)}, que é a despesa ` +
            `total prevista para ${ultimoOrg.ano_referencia} ao cêntimo — é ` +
            `isso que confirma que esta leitura do documento está certa.` +
            (soltas.length
              ? ` Sem correspondência no organograma: ` +
                soltas.map((u) => nomeUnidade(u.nome)).join(", ") +
                `; o nome que o orçamento usa não é o do despacho da estrutura ` +
                `orgânica, e a ligação fica por fazer em vez de ser adivinhada.`
              : ""),
        }),
      );
    }
    marcarTermos(caixaOrg);
  };
  desenharOrg();

  // --- Evolução por unidade ------------------------------------------------
  //
  // A série começa em 2023 e não em 2022 de propósito: a reorganização de 2023
  // mudou os departamentos todos e **reaproveitou os códigos**. O código 03 é
  // o Departamento de Obras Municipais em 2022 e a Direção Municipal de
  // Intervenção no Território a partir de 2023. Ligar os dois num gráfico
  // desenharia uma variação que nunca existiu.
  const comparaveis = org.exercicios.filter((e) => e.ano_referencia >= 2023);
  const codigosComuns = comparaveis
    .map((e) => new Set(e.unidades.filter((u) => u.nivel === 1).map((u) => u.codigo)))
    .reduce((a, b) => new Set([...a].filter((c) => b.has(c))));
  const seriesUnidade = [...codigosComuns]
    .map((c) => ({
      nome: nomeUnidade(porCodigo.get(c).nome),
      total: porCodigo.get(c).total,
      pontos: comparaveis.map((e) => ({
        x: e.ano_referencia,
        y: e.unidades.find((u) => u.codigo === c)?.total ?? null,
      })),
    }))
    .sort((a, b) => b.total - a.total);

  const figEvolucao = figura({
    titulo: `Como evoluiu o orçamento de cada unidade, ${comparaveis[0].ano_referencia}–${ultimoOrg.ano_referencia}`,
    resumo:
      "A Direção Municipal de Intervenção no Território concentra o " +
      "investimento em obra, e é por isso que é ela que faz o orçamento do " +
      "município subir.",
    proporcao: 0.62,
    desenhar: (svg, w, h) =>
      linhaTemporal(svg, w, h, {
        series: seriesUnidade,
        formatar: dinheiroCurto,
        formatarX: String,
      }),
    colunas: [
      { titulo: "Unidade", valor: (l) => l.nome },
      ...comparaveis.map((e) => ({
        titulo: `${e.ano_referencia} (€)`,
        valor: (l) => l.pontos.find((p) => p.x === e.ano_referencia)?.y ?? null,
        numerica: true,
      })),
    ],
    linhas: seriesUnidade,
    fontes: comparaveis.map((e) => e.fonte_id),
    avisos: [
      "A série começa em 2023 porque a reorganização desse ano trocou os " +
        "departamentos e reaproveitou os códigos: o código 03 designa o " +
        "Departamento de Obras Municipais em 2022 e a Direção Municipal de " +
        "Intervenção no Território a partir de 2023. Juntá-los mostraria uma " +
        "variação que não aconteceu.",
    ],
  });
  figEvolucao.querySelector(".figura__tela").after(
    legenda(seriesUnidade.map((s) => s.nome)),
  );
  raiz.append(figEvolucao);

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
      altura: (l) => alturaBarras(grau.length, l),
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
