/* Arranque do dashboard.
 *
 * As secções são módulos carregados a pedido (`import()` dinâmico). O Vite
 * transforma cada um num chunk, por isso abrir "Quem governa" não descarrega
 * os 4,8 MB dos contratos. É o que sustenta o objetivo dos 3 s em 4G.
 */

import "./estilo/base.css";
import "./estilo/layout.css";
import "./estilo/figura.css";
import { iniciarTema } from "./nucleo/tema.js";
import { carregar } from "./nucleo/dados.js";
import { data as formatarData } from "./nucleo/formato.js";

/* Ordem e identidade das 12 secções do briefing. `modulo: null` significa que
 * ainda não há dados — a secção existe e diz porquê, em vez de desaparecer. */
const SECCOES = [
  { id: "visao-geral", titulo: "Visão geral", curto: "Visão geral", modulo: () => import("./seccoes/visao-geral.js") },
  { id: "quem-governa", titulo: "Quem governa", curto: "Quem governa", modulo: () => import("./seccoes/quem-governa.js") },
  { id: "organizacao", titulo: "Como está organizada", curto: "Organização", modulo: () => import("./seccoes/organizacao.js") },
  { id: "pessoal", titulo: "Quem lá trabalha", curto: "Pessoal", modulo: () => import("./seccoes/pessoal.js") },
  { id: "dinheiro", titulo: "De onde vem o dinheiro", curto: "Dinheiro", modulo: () => import("./seccoes/dinheiro.js") },
  { id: "obras", titulo: "Obras e empreitadas", curto: "Obras", modulo: null, lacuna: "L26" },
  { id: "investimentos", titulo: "Investimentos (PPI)", curto: "Investimentos", modulo: null, lacuna: "L26" },
  { id: "contratos", titulo: "Contratos públicos", curto: "Contratos", modulo: () => import("./seccoes/contratos.js") },
  { id: "participadas", titulo: "Empresas e entidades participadas", curto: "Participadas", modulo: () => import("./seccoes/participadas.js") },
  { id: "equipamentos", titulo: "Equipamentos municipais", curto: "Equipamentos", modulo: null, lacuna: "S20" },
  { id: "comparar", titulo: "Comparar com outros municípios", curto: "Comparar", modulo: null, lacuna: "L13" },
  { id: "fontes", titulo: "Fontes e metodologia", curto: "Fontes", modulo: () => import("./seccoes/fontes.js") },
];

const RAZOES = {
  L26: "Os mapas do Plano Plurianual de Investimentos estão, em grande parte, digitalizados nos documentos previsionais — não são extraíveis sem reconhecimento ótico de caracteres, que sobre valores financeiros exige revisão humana antes de publicar.",
  S20: "Os equipamentos municipais estão dispersos por páginas temáticas do site da Câmara e ainda não foram inventariados. Falta também geocodificar as moradas.",
  L13: "A comparação entre municípios só é honesta com séries já normalizadas pela DGAL. O endereço exato desses quadros ainda não foi localizado — extrações próprias de PDF de municípios diferentes não são comparáveis.",
};

function criarSeccao(def) {
  const sec = document.createElement("section");
  sec.className = "seccao";
  sec.id = def.id;
  sec.setAttribute("aria-labelledby", `${def.id}-titulo`);

  const h2 = document.createElement("h2");
  h2.className = "seccao__titulo";
  h2.id = `${def.id}-titulo`;
  h2.textContent = def.titulo;
  sec.append(h2);

  const corpo = document.createElement("div");
  corpo.className = "seccao__corpo";
  sec.append(corpo);

  if (!def.modulo) {
    corpo.innerHTML = `
      <div class="sem-dados">
        <p class="sem-dados__rotulo">Dado não disponível</p>
        <p>${RAZOES[def.lacuna] ?? "Esta secção ainda não tem dados verificados."}</p>
        <p class="sem-dados__nota">
          Esta secção fica em branco de propósito. Preenchê-la com estimativas
          seria pior do que deixá-la vazia.
        </p>
      </div>`;
    return sec;
  }

  corpo.innerHTML = '<p class="a-carregar" role="status">A carregar…</p>';
  return sec;
}

/** Só carrega o módulo quando a secção se aproxima do ecrã. */
function observarSeccoes(defs) {
  const carregadas = new Set();

  const carregarSeccao = async (def, sec) => {
    if (carregadas.has(def.id)) return;
    carregadas.add(def.id);
    const corpo = sec.querySelector(".seccao__corpo");
    try {
      const mod = await def.modulo();
      corpo.replaceChildren();
      await mod.render(corpo);
    } catch (erro) {
      console.error(`Secção ${def.id}:`, erro);
      corpo.replaceChildren();
      const p = document.createElement("p");
      p.className = "erro";
      p.textContent =
        "Não foi possível carregar esta secção. Os dados podem não ter sido " +
        "publicados — ver a secção Fontes e metodologia.";
      corpo.append(p);
    }
  };

  const observador = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        const def = defs.find((d) => d.id === e.target.id);
        if (def?.modulo) carregarSeccao(def, e.target);
        observador.unobserve(e.target);
      }
    },
    { rootMargin: "300px 0px" },
  );

  for (const def of defs) {
    const sec = document.getElementById(def.id);
    if (sec && def.modulo) observador.observe(sec);
  }
}

function construirMenu(defs) {
  const ul = document.getElementById("menu-seccoes");
  for (const def of defs) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#${def.id}`;
    a.textContent = def.curto;
    if (!def.modulo) a.classList.add("navegacao__sem-dados");
    li.append(a);
    ul.append(li);
  }
}

async function marcarGeracao() {
  try {
    const f = await carregar("fontes.json");
    const el = document.getElementById("rodape-meta");
    const n = f._meta.fontes_descarregadas;
    el.textContent =
      `${n} fontes recolhidas e verificadas por soma de controlo. ` +
      `Registo gerado em ${formatarData(f._meta.gerado_em.slice(0, 10))}.`;
  } catch {
    /* o rodapé é acessório: se falhar, a página continua a servir. */
  }
}

iniciarTema();
construirMenu(SECCOES);

const contentor = document.getElementById("seccoes");
for (const def of SECCOES) contentor.append(criarSeccao(def));

observarSeccoes(SECCOES);
marcarGeracao();
