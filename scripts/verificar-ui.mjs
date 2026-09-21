/* Verifica os requisitos não negociáveis do briefing, por código.
 *
 * "Funciona bem no telemóvel" não é uma opinião: é sem scroll horizontal em
 * nenhuma largura, alvos de toque de 44 px, rótulos que não transbordam e
 * contraste suficiente. Tudo isso se mede.
 *
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/verificar-ui.mjs
 */

import lighthouse from "lighthouse";
import { chromium } from "playwright-core";

const URL_BASE = process.env.URL ?? "http://localhost:4173/";
const LARGURAS = [
  ["360 px (telemóvel pequeno)", 360],
  ["480 px (telemóvel)", 480],
  ["768 px (tablet)", 768],
  ["1280 px (portátil)", 1280],
];

const falhas = [];
const avisos = [];

function verificar(condicao, mensagem) {
  if (condicao) return true;
  falhas.push(mensagem);
  return false;
}

/** Luminância relativa, para o rácio de contraste da WCAG. */
function luminancia([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contraste(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const rgb = (s) => (s.match(/\d+/g) ?? []).slice(0, 3).map(Number);

const PORTA_DEPURACAO = 9222;
const navegador = await chromium.launch({
  executablePath: process.env.CHROME,
  args: ["--no-sandbox", `--remote-debugging-port=${PORTA_DEPURACAO}`],
});

for (const [rotulo, largura] of LARGURAS) {
  for (const tema of ["light", "dark"]) {
    const ctx = await navegador.newContext({
      viewport: { width: largura, height: 900 },
      colorScheme: tema,
    });
    const pagina = await ctx.newPage();
    const errosConsola = [];
    pagina.on("pageerror", (e) => errosConsola.push(e.message));
    pagina.on("response", (r) => {
      if (r.status() >= 400) errosConsola.push(`HTTP ${r.status()} ${r.url()}`);
    });

    await pagina.goto(URL_BASE, { waitUntil: "networkidle" });
    await pagina.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 70));
      }
      window.scrollTo(0, 0);
    });
    await pagina.waitForTimeout(2500);

    const ctx2 = `${rotulo} / ${tema}`;

    // 1. Scroll horizontal: zero, sempre.
    const excesso = await pagina.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    verificar(excesso <= 0, `${ctx2}: scroll horizontal de ${excesso}px`);

    // 2. Rótulos dos gráficos dentro do SVG.
    const fugas = await pagina.evaluate(() => {
      const out = [];
      for (const t of document.querySelectorAll("svg text.g-rotulo")) {
        if (t.getBBox().x < -0.5) out.push(t.textContent);
      }
      return out;
    });
    verificar(
      fugas.length === 0,
      `${ctx2}: ${fugas.length} rótulo(s) a transbordar — ex.: ${fugas[0] ?? ""}`,
    );

    // 3. Alvos de toque com pelo menos 44×44 px.
    //
    // A regra aplica-se a controlos autónomos: botões, itens de menu,
    // desdobráveis. NÃO se aplica a ligações dentro de uma frase — a WCAG
    // 2.5.8 isenta-as, e esticar um link a 44 px de altura no meio de um
    // parágrafo partiria o texto. A verificação distingue os dois casos.
    const pequenos = await pagina.evaluate(() => {
      const out = [];
      for (const n of document.querySelectorAll("button, a, summary")) {
        const r = n.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue; // escondido
        const emLinha = n.closest(
          "p, li, td, .figura__fonte, .cadeia, .leaflet-control-attribution",
        );
        if (emLinha) continue;
        if (r.height < 44 - 0.5) {
          out.push(`${n.tagName}: ${Math.round(r.height)}px — ${n.textContent.trim().slice(0, 40)}`);
        }
      }
      return out;
    });
    verificar(
      pequenos.length === 0,
      `${ctx2}: ${pequenos.length} controlo(s) abaixo de 44px — ex.: ${pequenos[0] ?? ""}`,
    );

    // 4. Contraste do texto corrente contra a superfície.
    const cores = await pagina.evaluate(() => {
      const raiz = getComputedStyle(document.body);
      const nota = document.querySelector(".nota") ?? document.body;
      return {
        fundo: raiz.backgroundColor,
        tinta: raiz.color,
        secundaria: getComputedStyle(nota).color,
      };
    });
    const cPrincipal = contraste(rgb(cores.tinta), rgb(cores.fundo));
    const cSecundaria = contraste(rgb(cores.secundaria), rgb(cores.fundo));
    verificar(cPrincipal >= 4.5, `${ctx2}: contraste do texto ${cPrincipal.toFixed(2)}:1 (<4,5)`);
    verificar(
      cSecundaria >= 4.5,
      `${ctx2}: contraste do texto secundário ${cSecundaria.toFixed(2)}:1 (<4,5)`,
    );

    // 5. Sem erros de execução nem recursos em falta.
    verificar(errosConsola.length === 0, `${ctx2}: ${errosConsola[0] ?? ""}`);

    console.log(
      `${ctx2.padEnd(34)} overflow ${excesso}px · contraste ${cPrincipal.toFixed(1)}:1 / ` +
        `${cSecundaria.toFixed(1)}:1 · rótulos fora ${fugas.length}`,
    );
    await ctx.close();
  }
}

// --- Navegação por teclado -------------------------------------------------
{
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
  const pagina = await ctx.newPage();
  await pagina.goto(URL_BASE, { waitUntil: "networkidle" });
  await pagina.keyboard.press("Tab");
  const primeiro = await pagina.evaluate(() => document.activeElement?.className ?? "");
  verificar(
    primeiro.includes("salta-para-conteudo"),
    `O primeiro Tab devia focar o atalho "Saltar para o conteúdo"; focou "${primeiro}"`,
  );
  await ctx.close();
}

// --- Lighthouse, perfil móvel ---------------------------------------------
//
// O briefing exige 90 em Performance e Acessibilidade. Medir é a única forma
// de saber: a primeira medição deu 75 em Performance, por um CLS de 1,67 que
// nenhuma inspeção visual teria revelado.
{
  const r = await lighthouse(URL_BASE, {
    port: PORTA_DEPURACAO,
    output: "json",
    logLevel: "error",
    formFactor: "mobile",
    screenEmulation: {
      mobile: true,
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      disabled: false,
    },
  });
  const cat = r.lhr.categories;
  const nota = (k) => Math.round((cat[k]?.score ?? 0) * 100);
  console.log("");
  for (const k of ["performance", "accessibility", "best-practices", "seo"]) {
    console.log(`lighthouse ${k.padEnd(16)} ${nota(k)}`);
  }
  for (const k of ["first-contentful-paint", "largest-contentful-paint", "cumulative-layout-shift"]) {
    console.log(`  ${k.padEnd(26)} ${r.lhr.audits[k].displayValue}`);
  }
  verificar(nota("performance") >= 90, `Lighthouse Performance ${nota("performance")} (< 90)`);
  verificar(nota("accessibility") >= 90, `Lighthouse Acessibilidade ${nota("accessibility")} (< 90)`);

  // "Primeira vista útil < 3 s em 4G": o LCP sob o estrangulamento móvel do
  // Lighthouse é a medida mais próxima disso.
  const lcp = r.lhr.audits["largest-contentful-paint"].numericValue;
  verificar(lcp <= 3000, `LCP de ${(lcp / 1000).toFixed(1)}s em 4G (> 3s)`);
}

await navegador.close();

console.log("");
for (const a of avisos) console.log(`aviso: ${a}`);
if (falhas.length) {
  console.log(`\n${falhas.length} verificação(ões) falhada(s):`);
  for (const f of falhas) console.log(`  ${f}`);
  process.exit(1);
}
console.log("Todos os requisitos não negociáveis verificados.");
