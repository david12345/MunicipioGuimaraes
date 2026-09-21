/* Secção 4 — Quem lá trabalha.
 *
 * Só agregados. O mapa de pessoal não é uma lista de trabalhadores: é a lista
 * dos postos de trabalho de que o município carece, por carreira e por unidade.
 * Não há nomes no documento e não há nomes aqui.
 */

import { carregar } from "../nucleo/dados.js";
import { figura, el } from "../nucleo/figura.js";
import { barrasHorizontais, alturaBarras } from "../nucleo/graficos.js";
import { numero, pontosPercentuais } from "../nucleo/formato.js";

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

  // --- Por unidade orgânica -----------------------------------------------
  const unidades = [...d.unidades].sort((a, b) => b.ocupados - a.ocupados);
  raiz.append(
    figura({
      titulo: "Postos ocupados por unidade orgânica",
      resumo:
        "O Departamento de Intervenção Social concentra mais de metade do " +
        "pessoal — é onde está a educação, com os assistentes operacionais " +
        "das escolas.",
      altura: () => alturaBarras(unidades.length),
      desenhar: (svg, w, h) =>
        barrasHorizontais(svg, w, h, {
          dados: unidades.map((u) => ({
            rotulo: u.unidade_organica,
            valor: u.ocupados,
          })),
          formatar: numero,
        }),
      colunas: [
        { titulo: "Unidade orgânica", valor: (l) => l.unidade_organica },
        { titulo: "Código", valor: (l) => l.unidade_organica_id },
        { titulo: "Ocupados", valor: (l) => l.ocupados, numerica: true },
        { titulo: "Previstos", valor: (l) => l.previstos, numerica: true },
        {
          titulo: "Vagos",
          valor: (l) => l.previstos - l.ocupados,
          numerica: true,
        },
      ],
      linhas: unidades,
      fontes: `S07-${d.ano_referencia}`,
    }),
  );

  // --- Por carreira --------------------------------------------------------
  const porCarreira = new Map();
  for (const p of d.postos) {
    const chave = p.carreira ?? "Não identificada";
    const atual = porCarreira.get(chave) ?? { carreira: chave, ocupados: 0, previstos: 0 };
    atual.ocupados += p.ocupados;
    atual.previstos += p.previstos;
    porCarreira.set(chave, atual);
  }
  const carreiras = [...porCarreira.values()]
    .sort((a, b) => b.ocupados - a.ocupados)
    .slice(0, 10);

  raiz.append(
    figura({
      titulo: "Postos ocupados por carreira",
      resumo:
        "Assistente operacional é, de longe, a carreira mais numerosa: são " +
        "as pessoas que fazem funcionar escolas, espaços públicos e serviços " +
        "urbanos. As dez maiores carreiras.",
      altura: () => alturaBarras(carreiras.length),
      desenhar: (svg, w, h) =>
        barrasHorizontais(svg, w, h, {
          dados: carreiras.map((c) => ({ rotulo: c.carreira, valor: c.ocupados })),
          formatar: numero,
          corUnica: "var(--serie-3)",
        }),
      colunas: [
        { titulo: "Carreira", valor: (l) => l.carreira },
        { titulo: "Ocupados", valor: (l) => l.ocupados, numerica: true },
        { titulo: "Previstos", valor: (l) => l.previstos, numerica: true },
      ],
      linhas: [...porCarreira.values()].sort((a, b) => b.ocupados - a.ocupados),
      fontes: `S07-${d.ano_referencia}`,
      avisos: [
        "São postos de trabalho, não pessoas. Um posto ocupado corresponde a " +
          "um trabalhador, mas o documento não identifica ninguém — e este " +
          "dashboard só publica agregados.",
      ],
    }),
  );
}
