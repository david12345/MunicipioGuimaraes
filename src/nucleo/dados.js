/* Carregamento dos dados, um ficheiro por secção.
 *
 * Nada é carregado à cabeça: cada secção pede o que precisa quando abre. É o
 * que mantém a primeira vista útil abaixo dos 3 s em 4G — os contratos sozinhos
 * são ~4,8 MB e nunca podem entrar no arranque.
 */

const cache = new Map();

/** Resolve contra a base do Vite, para o site funcionar em subdiretório. */
function url(nome) {
  return `${import.meta.env.BASE_URL}dados/${nome}`;
}

export async function carregar(nome) {
  if (cache.has(nome)) return cache.get(nome);
  const promessa = fetch(url(nome)).then((r) => {
    if (!r.ok) {
      throw new Error(`Não foi possível carregar ${nome} (HTTP ${r.status})`);
    }
    return r.json();
  });
  cache.set(nome, promessa);
  return promessa;
}

/** Carrega vários em paralelo; um que falhe não derruba os outros. */
export async function carregarVarios(nomes) {
  const res = await Promise.allSettled(nomes.map(carregar));
  return res.map((r) => (r.status === "fulfilled" ? r.value : null));
}

let registoFontes = null;

/** `fontes.json` — a raiz da rastreabilidade. Carregado uma vez e partilhado. */
export async function fontes() {
  registoFontes ??= carregar("fontes.json").then((d) => d.dados);
  return registoFontes;
}

/** Metadados de uma fonte, para a ficha que acompanha cada gráfico. */
export async function fonte(id) {
  const todas = await fontes();
  return todas[id] ?? null;
}
