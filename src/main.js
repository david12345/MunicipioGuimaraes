/* Arranque e navegação do dashboard.
 *
 * **Uma secção de cada vez, cada uma com o seu endereço.** Doze secções numa
 * página só obrigavam a rolar muito para encontrar o que se procura, e o menu
 * era um conjunto de atalhos para posições, não uma navegação: depois de
 * saltar, continuava tudo colado e perdia-se a noção de onde se estava.
 *
 * O endereço usa `#` (`…/#contratos`) porque o GitHub Pages serve ficheiros
 * estáticos e não sabe reescrever `/contratos` para o `index.html`. A
 * diferença para o utilizador é nenhuma: o endereço é partilhável, o botão
 * "voltar" funciona, e os atalhos que já existiam continuam a abrir a secção
 * certa.
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
import { marcarTermos } from "./nucleo/glossario.js";

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
  { id: "equipamentos", titulo: "Equipamentos municipais", curto: "Equipamentos", modulo: () => import("./seccoes/equipamentos.js") },
  { id: "comparar", titulo: "Comparar com outros municípios", curto: "Comparar", modulo: null, lacuna: "L13" },
  { id: "fontes", titulo: "Fontes e metodologia", curto: "Fontes", modulo: () => import("./seccoes/fontes.js") },
];

const RAZOES = {
  L26: "Os mapas do Plano Plurianual de Investimentos estão, em grande parte, digitalizados nos documentos previsionais — não são extraíveis sem reconhecimento ótico de caracteres, que sobre valores financeiros exige revisão humana antes de publicar.",
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
  // `tabindex="-1"`: focável por código, mas fora da ordem de tabulação. É
  // assim que o foco vai parar ao início do conteúdo ao mudar de secção.
  h2.tabIndex = -1;
  sec.append(h2);

  const corpo = document.createElement("div");
  corpo.className = "seccao__corpo";
  sec.append(corpo);

  const paginacao = document.createElement("nav");
  paginacao.className = "seccao__paginacao";
  paginacao.setAttribute("aria-label", "Secção anterior e seguinte");
  sec.append(paginacao);

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
    marcarTermos(corpo);
    return sec;
  }

  corpo.innerHTML = '<p class="a-carregar" role="status">A carregar…</p>';
  return sec;
}

const carregadas = new Set();

/** Carrega o módulo de uma secção, uma só vez. */
async function carregarSeccao(def) {
  if (!def.modulo || carregadas.has(def.id)) return;
  carregadas.add(def.id);
  const corpo = document.querySelector(`#${def.id} .seccao__corpo`);
  if (!corpo) return;
  try {
    const mod = await def.modulo();
    corpo.replaceChildren();
    await mod.render(corpo);
    // Os termos técnicos só existem depois de a secção escrever o texto.
    marcarTermos(corpo);
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
}

/** A secção pedida pelo endereço, ou a primeira. */
function seccaoDoEndereco(defs) {
  const id = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  return defs.find((d) => d.id === id) ?? defs[0];
}

function marcarMenu(id) {
  for (const a of document.querySelectorAll("#menu-seccoes a")) {
    const ativo = a.dataset.seccao === id;
    a.classList.toggle("navegacao__ativo", ativo);
    // `aria-current` é o que um leitor de ecrã anuncia como "página atual".
    if (ativo) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}

/** Mostra uma secção e esconde as outras. */
async function mostrar(defs, def, { focar = true } = {}) {
  for (const outra of defs) {
    const sec = document.getElementById(outra.id);
    if (sec) sec.hidden = outra.id !== def.id;
  }
  marcarMenu(def.id);
  document.title = `${def.titulo} — Município de Guimarães`;

  await carregarSeccao(def);
  construirPaginacao(defs, def);

  if (!focar) return;
  // Mudar de secção é mudar de página: quem navega por teclado ou leitor de
  // ecrã tem de ir parar ao início do conteúdo novo, não continuar no menu.
  const titulo = document.getElementById(`${def.id}-titulo`);
  titulo?.focus();
  window.scrollTo({ top: 0, behavior: "instant" });
}

/** Anterior e seguinte, para quem quer ler tudo por ordem. */
function construirPaginacao(defs, atual) {
  const anterior = defs[defs.indexOf(atual) - 1];
  const seguinte = defs[defs.indexOf(atual) + 1];
  const alvo = document.querySelector(`#${atual.id} .seccao__paginacao`);
  if (!alvo) return;
  alvo.replaceChildren();

  for (const [def, rotulo, classe] of [
    [anterior, "Anterior", "paginacao__anterior"],
    [seguinte, "Seguinte", "paginacao__seguinte"],
  ]) {
    if (!def) continue;
    const a = document.createElement("a");
    a.href = `#${def.id}`;
    a.className = `botao ${classe}`;
    a.innerHTML =
      `<span class="paginacao__rotulo">${rotulo}</span>` +
      `<span class="paginacao__titulo"></span>`;
    a.querySelector(".paginacao__titulo").textContent = def.titulo;
    alvo.append(a);
  }
}

function construirMenu(defs) {
  const ul = document.getElementById("menu-seccoes");
  for (const def of defs) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#${def.id}`;
    a.dataset.seccao = def.id;
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

/* Arranque.
 *
 * A secção pedida é renderizada ANTES de o contentor entrar no DOM. Se ele
 * for pintado vazio e só depois preenchido, tudo o que está por baixo salta —
 * foi assim que o Lighthouse mediu um CLS de 1,67. O cabeçalho já está no
 * HTML e pinta de imediato, por isso esperar pelos poucos kB da secção não
 * atrasa a primeira pintura de forma sensível.
 */
async function arrancar() {
  iniciarTema();
  construirMenu(SECCOES);

  const contentor = document.getElementById("seccoes");
  const fragmento = document.createDocumentFragment();
  const inicial = seccaoDoEndereco(SECCOES);

  for (const def of SECCOES) {
    const sec = criarSeccao(def);
    // Só a secção pedida fica visível; as outras existem mas escondidas, o
    // que mantém os endereços a funcionar sem as desenhar todas.
    sec.hidden = def.id !== inicial.id;
    fragmento.append(sec);
  }

  // Renderiza antes de inserir: evita o salto de layout.
  const corpo = fragmento.querySelector(`#${inicial.id} .seccao__corpo`);
  if (inicial.modulo && corpo) {
    carregadas.add(inicial.id);
    try {
      const mod = await inicial.modulo();
      corpo.replaceChildren();
      await mod.render(corpo);
      marcarTermos(corpo);
    } catch (erro) {
      console.error(`Secção ${inicial.id}:`, erro);
      carregadas.delete(inicial.id);
    }
  }

  contentor.append(fragmento);
  marcarMenu(inicial.id);
  document.title = `${inicial.titulo} — Município de Guimarães`;
  construirPaginacao(SECCOES, inicial);
  marcarGeracao();

  // O "voltar" do navegador e os cliques no menu passam os dois por aqui.
  window.addEventListener("hashchange", () => {
    mostrar(SECCOES, seccaoDoEndereco(SECCOES));
  });
}

arrancar();
