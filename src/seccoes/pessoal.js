/* Secção 4 — Quem lá trabalha.
 *
 * Só agregados. O mapa de pessoal não é uma lista de trabalhadores: é a lista
 * dos postos de trabalho de que o município carece, por carreira e por
 * unidade. Não há nomes no documento e não há nomes aqui.
 *
 * O gráfico principal **desce e sobe** pela hierarquia que os dados já têm:
 *
 *   unidade orgânica → carreira → categoria
 *
 * Tocar numa barra desce um nível; o caminho no topo sobe. É a alternativa
 * móvel que o briefing pede para visualizações com hierarquia — em vez de um
 * diagrama que não cabe em 360 px, as mesmas barras horizontais, um nível de
 * cada vez. A tabela e o CSV acompanham o nível em que se está: descarregar
 * enquanto se olha para uma carreira dá essa carreira, não o mapa inteiro.
 */

import { carregar } from "../nucleo/dados.js";
import { figura, el } from "../nucleo/figura.js";
import { barrasHorizontais, alturaBarras } from "../nucleo/graficos.js";
import { numero, pontosPercentuais, NAO_DISPONIVEL } from "../nucleo/formato.js";

/* Os três níveis, por ordem. Cada um diz por que campo agrupa, como se chama
 * na interface, e o que fazer quando já não há nível abaixo. */
const NIVEIS = [
  {
    campo: "unidade_organica",
    singular: "unidade orgânica",
    plural: "Unidades orgânicas",
    cor: "var(--serie-1)",
  },
  {
    campo: "carreira",
    singular: "carreira",
    plural: "Carreiras",
    cor: "var(--serie-3)",
  },
  {
    campo: "categoria",
    singular: "categoria",
    plural: "Categorias",
    cor: "var(--serie-7)",
  },
];

/** Agrupa as linhas pelo campo do nível, somando ocupados e previstos. */
function agrupar(linhas, campo) {
  const m = new Map();
  for (const l of linhas) {
    const chave = l[campo] ?? NAO_DISPONIVEL;
    const a = m.get(chave) ?? { nome: chave, ocupados: 0, previstos: 0, linhas: [] };
    a.ocupados += l.ocupados;
    a.previstos += l.previstos;
    a.linhas.push(l);
    m.set(chave, a);
  }
  return [...m.values()].sort((a, b) => b.ocupados - a.ocupados);
}

export async function render(raiz) {
  const d = await carregar("mapa_pessoal.json");
  const taxa = (d.total_postos_ocupados / d.total_postos_previstos) * 100;

  raiz.append(
    el("p", {
      class: "resumo",
      html:
        `Em ${d.ano_referencia} a Câmara tem ` +
        `<strong>${numero(d.total_postos_ocupados)} postos de trabalho ocupados</strong> ` +
        `de ${numero(d.total_postos_previstos)} previstos — ` +
        `${pontosPercentuais(taxa)} do quadro preenchido. Os ` +
        `${numero(d.total_postos_vagos)} lugares por preencher estão aprovados ` +
        `e orçamentados, mas por ocupar.`,
    }),
  );

  raiz.append(
    el("p", {
      class: "nota",
      texto:
        "Toque numa barra para ver o que está por baixo: de unidade orgânica " +
        "para carreira, e de carreira para categoria. O caminho no topo do " +
        "gráfico volta atrás.",
    }),
  );

  // `caminho` é o que se escolheu em cada nível: [] é a raiz, ["DIS"] é dentro
  // dessa unidade, ["DIS", "Assistente Operacional"] é dentro dessa carreira.
  let caminho = [];
  const contentor = el("div");
  raiz.append(contentor);

  const desenhar = () => {
    const nivel = NIVEIS[caminho.length];

    // Filtra as linhas pelo que já se escolheu.
    let linhas = d.postos;
    caminho.forEach((valor, i) => {
      linhas = linhas.filter((l) => (l[NIVEIS[i].campo] ?? NAO_DISPONIVEL) === valor);
    });

    const grupos = agrupar(linhas, nivel.campo);
    // Só desce mais se houver nível abaixo E mais do que uma coisa lá dentro.
    const podeDescer = (g) =>
      caminho.length < NIVEIS.length - 1 &&
      agrupar(g.linhas, NIVEIS[caminho.length + 1].campo).length > 1;

    const ocupados = grupos.reduce((s, g) => s + g.ocupados, 0);
    const titulo =
      caminho.length === 0
        ? `${nivel.plural} — ${numero(ocupados)} postos ocupados`
        : `${caminho.at(-1)} — ${nivel.plural.toLowerCase()}`;

    const fig = figura({
      titulo,
      resumo:
        caminho.length === 0
          ? "O Departamento de Intervenção Social concentra mais de metade do " +
            "pessoal — é onde está a educação, com os assistentes operacionais " +
            "das escolas."
          : `${numero(ocupados)} postos ocupados em ${numero(grupos.length)} ` +
            `${grupos.length === 1 ? nivel.singular : nivel.plural.toLowerCase()}.`,
      altura: () => alturaBarras(grupos.length),
      desenhar: (svg, w, h) =>
        barrasHorizontais(svg, w, h, {
          dados: grupos.map((g) => ({ rotulo: g.nome, valor: g.ocupados })),
          formatar: numero,
          corUnica: nivel.cor,
          temDetalhe: (barra) => podeDescer(grupos.find((g) => g.nome === barra.rotulo)),
          aoEscolher: (barra) => {
            caminho = [...caminho, barra.rotulo];
            desenhar();
          },
        }),
      colunas: [
        { titulo: nivel.plural.replace(/s$/, ""), valor: (l) => l.nome },
        { titulo: "Ocupados", valor: (l) => l.ocupados, numerica: true },
        { titulo: "Previstos", valor: (l) => l.previstos, numerica: true },
        {
          titulo: "Vagos",
          valor: (l) => l.previstos - l.ocupados,
          numerica: true,
        },
      ],
      linhas: grupos,
      fontes: `S07-${d.ano_referencia}`,
      avisos:
        caminho.length === 0
          ? [
              "São postos de trabalho, não pessoas. Um posto ocupado " +
                "corresponde a um trabalhador, mas o documento não identifica " +
                "ninguém — e este dashboard só publica agregados.",
            ]
          : [],
    });

    // --- Caminho de volta ---------------------------------------------------
    const trilho = el("nav", {
      class: "trilho",
      "aria-label": "Onde está no mapa de pessoal",
    });
    const passos = [{ rotulo: "Todas as unidades", ate: 0 }].concat(
      caminho.map((v, i) => ({ rotulo: v, ate: i + 1 })),
    );
    passos.forEach((passo, i) => {
      const ultimo = i === passos.length - 1;
      if (ultimo) {
        trilho.append(
          el("span", { class: "trilho__atual", "aria-current": "true", texto: passo.rotulo }),
        );
        return;
      }
      const b = el("button", {
        type: "button",
        class: "trilho__passo",
        texto: passo.rotulo,
      });
      b.addEventListener("click", () => {
        caminho = caminho.slice(0, passo.ate);
        desenhar();
      });
      trilho.append(b, el("span", { class: "trilho__seta", "aria-hidden": "true", texto: "›" }));
    });

    fig.querySelector(".figura__titulo").after(trilho);
    contentor.replaceChildren(fig);

    // Depois de descer, o foco tem de acompanhar — senão quem navega por
    // teclado carrega numa barra e o foco fica num nó que já não existe.
    if (caminho.length) fig.querySelector(".trilho__atual")?.scrollIntoView({ block: "nearest" });
  };

  desenhar();
}
