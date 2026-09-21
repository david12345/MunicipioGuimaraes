/* Tema claro/escuro.
 *
 * Por omissão segue o sistema. Quando a pessoa escolhe, a escolha fica
 * gravada e passa a ganhar ao sistema — nos dois sentidos, que é a razão de
 * o CSS declarar o escuro sob `prefers-color-scheme` e sob `[data-theme]`.
 */

const CHAVE = "guimaraes-tema";

function guardado() {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    // Janela privada ou cookies bloqueados: segue-se o sistema, sem falhar.
    return null;
  }
}

function aplicar(tema) {
  const raiz = document.documentElement;
  if (tema) raiz.setAttribute("data-theme", tema);
  else raiz.removeAttribute("data-theme");

  const escuro =
    tema === "dark" ||
    (!tema && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const botao = document.getElementById("botao-tema");
  if (!botao) return;
  botao.setAttribute("aria-pressed", String(escuro));
  document.getElementById("icone-tema").textContent = escuro ? "☀" : "☾";
  document.getElementById("texto-tema").textContent = escuro
    ? "Mudar para tema claro"
    : "Mudar para tema escuro";
}

export function iniciarTema() {
  aplicar(guardado());

  document.getElementById("botao-tema")?.addEventListener("click", () => {
    const atual = document.documentElement.getAttribute("data-theme");
    const escuroAgora =
      atual === "dark" ||
      (!atual && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const novo = escuroAgora ? "light" : "dark";
    try {
      localStorage.setItem(CHAVE, novo);
    } catch {
      /* sem persistência, mas a sessão respeita a escolha */
    }
    aplicar(novo);
  });

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (!guardado()) aplicar(null);
    });
}
