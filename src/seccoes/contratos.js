/* Secção 8 — Contratos públicos.
 *
 * Os ficheiros de contratos são ~800 kB por ano. Carregar os oito de uma vez
 * seriam 4,8 MB — por isso só se carrega o ano escolhido, e o seletor de ano
 * substitui o conteúdo em vez de o acumular.
 */

import { carregar } from "../nucleo/dados.js";
import { figura, el } from "../nucleo/figura.js";
import { barrasHorizontais, alturaBarras } from "../nucleo/graficos.js";
import { dinheiro, dinheiroCurto, numero, rotulo } from "../nucleo/formato.js";

const ANOS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

function agregar(contratos, chave) {
  const m = new Map();
  for (const c of contratos) {
    const k = chave(c);
    if (k === null) continue;
    const a = m.get(k) ?? { nome: k, total: 0, n: 0 };
    a.total += c.valor ?? 0;
    a.n += 1;
    m.set(k, a);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

async function desenharAno(alvo, ano) {
  alvo.replaceChildren(
    el("p", { class: "a-carregar", role: "status", texto: "A carregar contratos…" }),
  );

  const d = await carregar(`contratos_${ano}.json`);
  alvo.replaceChildren();

  const doMunicipio = d.contratos.filter((c) => c.adjudicante_municipio);
  const dasParticipadas = d.contratos.length - doMunicipio.length;

  alvo.append(
    el("p", {
      class: "resumo",
      html:
        `Em ${ano}, o Município e as suas participadas celebraram ` +
        `<strong>${numero(d.total_contratos)} contratos</strong>, no valor de ` +
        `<strong>${dinheiroCurto(d.valor_total)}</strong>. ` +
        `${numero(doMunicipio.length)} são da Câmara e ` +
        `${numero(dasParticipadas)} das entidades participadas.`,
    }),
  );

  // --- Maiores adjudicatários ---------------------------------------------
  const adjudicatarios = agregar(
    d.contratos,
    (c) => c.adjudicatarios?.[0]?.nome ?? null,
  ).slice(0, 12);

  alvo.append(
    figura({
      titulo: `Quem mais recebeu em ${ano}`,
      resumo:
        "Soma dos contratos por entidade adjudicatária. Quando um contrato " +
        "tem vários adjudicatários, conta para o primeiro.",
      altura: () => alturaBarras(adjudicatarios.length),
      desenhar: (svg, w, h) =>
        barrasHorizontais(svg, w, h, {
          dados: adjudicatarios.map((a) => ({ rotulo: a.nome, valor: a.total })),
          formatar: dinheiroCurto,
          corUnica: "var(--serie-2)",
        }),
      colunas: [
        { titulo: "Adjudicatário", valor: (l) => l.nome },
        { titulo: "Contratos", valor: (l) => l.n, numerica: true },
        { titulo: "Valor total (€)", valor: (l) => Math.round(l.total * 100) / 100, numerica: true },
      ],
      linhas: agregar(d.contratos, (c) => c.adjudicatarios?.[0]?.nome ?? null),
      fontes: `S23-${ano}`,
    }),
  );

  // --- Por tipo de procedimento -------------------------------------------
  const procedimentos = agregar(d.contratos, (c) => rotulo(c.tipo_procedimento));
  alvo.append(
    figura({
      titulo: `Como foram adjudicados, em ${ano}`,
      resumo:
        "O ajuste direto é o procedimento mais simples e não obriga a " +
        "concurso. O concurso público é o mais aberto. A proporção entre os " +
        "dois diz muito sobre como o município contrata.",
      altura: () => alturaBarras(procedimentos.length),
      desenhar: (svg, w, h) =>
        barrasHorizontais(svg, w, h, {
          dados: procedimentos.map((p) => ({ rotulo: p.nome, valor: p.total })),
          formatar: dinheiroCurto,
        }),
      colunas: [
        { titulo: "Procedimento", valor: (l) => l.nome },
        { titulo: "Contratos", valor: (l) => l.n, numerica: true },
        { titulo: "Valor total (€)", valor: (l) => Math.round(l.total * 100) / 100, numerica: true },
      ],
      linhas: procedimentos,
      fontes: `S23-${ano}`,
    }),
  );

  // --- Maiores contratos ---------------------------------------------------
  const maiores = [...d.contratos]
    .filter((c) => c.valor !== null)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 20);

  const tabela = el("details", { class: "figura__tabela figura" });
  tabela.append(el("summary", { texto: `Os 20 maiores contratos de ${ano}` }));
  const t = el("table");
  const thead = el("tr");
  for (const h of ["Objeto", "Adjudicatário", "Valor", "Data", "Adjudicante"]) {
    thead.append(el("th", { scope: "col", texto: h }));
  }
  t.append(el("thead", {}, [thead]));
  const tbody = el("tbody");
  for (const c of maiores) {
    const tr = el("tr");
    const objeto = el("td");
    if (c.url_base) {
      objeto.append(
        el("a", {
          href: c.url_base,
          rel: "noopener",
          target: "_blank",
          texto: c.objeto ?? "(sem objeto)",
        }),
      );
    } else {
      objeto.textContent = c.objeto ?? "";
    }
    tr.append(objeto);
    tr.append(el("td", { texto: c.adjudicatarios?.[0]?.nome ?? "" }));
    tr.append(el("td", { class: "num", texto: dinheiro(c.valor) }));
    tr.append(el("td", { texto: c.data_celebracao ?? "" }));
    tr.append(el("td", { texto: c.adjudicante }));
    tbody.append(tr);
  }
  t.append(tbody);
  tabela.append(el("div", { class: "rolavel" }, [t]));
  alvo.append(tabela);

  for (const aviso of d._meta.avisos ?? []) {
    alvo.append(el("p", { class: "figura__aviso", texto: aviso }));
  }
}

export async function render(raiz) {
  raiz.append(
    el("p", {
      class: "resumo",
      texto:
        "Todos os contratos públicos celebrados pelo Município e pelas suas " +
        "entidades participadas, como constam do Portal BASE. O filtro é " +
        "feito pelo número de identificação fiscal de cada entidade, não pelo " +
        "nome — procurar por “Guimarães” apanharia o hospital, as escolas e o " +
        "Tribunal da Relação.",
    }),
  );

  const barra = el("div", { class: "seletor", role: "group", "aria-label": "Escolher ano" });
  const conteudo = el("div");

  let atual = 2025;
  const botoes = new Map();
  for (const ano of ANOS) {
    const b = el("button", { type: "button", class: "botao", texto: String(ano) });
    b.addEventListener("click", () => {
      if (atual === ano) return;
      atual = ano;
      for (const [a, btn] of botoes) {
        btn.classList.toggle("botao--ativo", a === ano);
        btn.setAttribute("aria-pressed", String(a === ano));
      }
      desenharAno(conteudo, ano);
    });
    b.setAttribute("aria-pressed", String(ano === atual));
    if (ano === atual) b.classList.add("botao--ativo");
    botoes.set(ano, b);
    barra.append(b);
  }

  raiz.append(barra, conteudo);
  await desenharAno(conteudo, atual);
}
