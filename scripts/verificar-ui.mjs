/* Verifica os requisitos não negociáveis do briefing, por código.
 *
 * "Funciona bem no telemóvel" não é uma opinião: é sem scroll horizontal em
 * nenhuma largura, alvos de toque de 44 px, rótulos que não transbordam e
 * contraste suficiente. Tudo isso se mede.
 *
 *   make dashboard-verificar             # constrói, serve e verifica
 *   URL=https://… make dashboard-verificar   # verifica um site já publicado
 *
 * Arranca o servidor sozinho e encontra o Chromium sozinho: uma verificação
 * que exige três passos preparatórios é uma verificação que ninguém corre.
 */

import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import lighthouse from "lighthouse";
import { chromium } from "playwright-core";

const PORTA = 4173;
const URL_LOCAL = `http://localhost:${PORTA}/MunicipioGuimaraes/`;
const URL_BASE = process.env.URL ?? URL_LOCAL;
const LOCAL = URL_BASE === URL_LOCAL;

/** Procura o Chromium que o Playwright instalou, sem obrigar a variável. */
function encontrarChromium() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = join(homedir(), ".cache", "ms-playwright");
  if (!existsSync(base)) return undefined;
  for (const dir of readdirSync(base).filter((d) => d.startsWith("chromium"))) {
    for (const sub of ["chrome-linux64/chrome", "chrome-linux/chrome", "chrome-linux/headless_shell"]) {
      const c = join(base, dir, sub);
      if (existsSync(c)) return c;
    }
  }
  return undefined;
}

async function esperarPor(url, segundos = 60) {
  for (let i = 0; i < segundos; i += 1) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch {
      /* ainda não está de pé */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

let servidor = null;
if (LOCAL && !(await esperarPor(URL_BASE, 1))) {
  console.log("A arrancar o servidor local…");
  servidor = spawn("npx", ["vite", "preview", "--port", String(PORTA), "--strictPort"], {
    stdio: "ignore",
    detached: false,
  });
  if (!(await esperarPor(URL_BASE))) {
    console.error(
      `O servidor não respondeu em ${URL_BASE}. Corre \`npm run build\` primeiro.`,
    );
    servidor.kill();
    process.exit(1);
  }
}
const LARGURAS = [
  ["360 px (telemóvel pequeno)", 360],
  ["480 px (telemóvel)", 480],
  ["768 px (tablet)", 768],
  ["1280 px (portátil)", 1280],
];

const falhas = [];
const avisos = [];
const excecoes = new Set();

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
const executavel = encontrarChromium();
if (!executavel) {
  console.error(
    "Chromium não encontrado. Instala-o com:\n" +
      "  npx playwright install chromium",
  );
  servidor?.kill();
  process.exit(1);
}
const navegador = await chromium.launch({
  executablePath: executavel,
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
    await pagina.waitForTimeout(2000);

    // Desde que cada secção é uma página, não basta rolar: é preciso
    // **visitar cada uma**. Sem isto a verificação cobria só a primeira e
    // dizia que estava tudo bem.
    const seccoes = await pagina.$$eval("#menu-seccoes a", (ns) =>
      ns.map((n) => n.dataset.seccao),
    );
    verificar(seccoes.length >= 10, `${rotulo}: só ${seccoes.length} secções no menu`);

    let excesso = 0;
    const fugas = [];
    const pequenos = [];

    for (const id of seccoes) {
      await pagina.goto(`${URL_BASE}#${id}`, { waitUntil: "load" });
      // O mapa e os contratos demoram mais do que os restantes.
      await pagina.waitForTimeout(id === "equipamentos" || id === "contratos" ? 3500 : 1200);

      excesso = Math.max(
        excesso,
        await pagina.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      );

      for (const t of await pagina.evaluate(() => {
        const out = [];
        // Mede os DOIS lados. Quando o rótulo ficava sempre à esquerda da
        // barra bastava olhar para a margem esquerda; agora, em ecrã estreito,
        // ele sobe para cima da barra alinhado à esquerda e o transbordo
        // possível é à direita.
        //
        // A folga de 1,5 px é a saliência lateral do glifo: um "J" começa
        // cerca de 1 px à esquerda da sua origem, e isso não é transbordo —
        // o texto vê-se todo.
        const FOLGA = 1.5;
        for (const t of document.querySelectorAll("svg text.g-rotulo")) {
          const caixa = t.getBBox();
          const largura = t.ownerSVGElement.viewBox.baseVal.width;
          if (caixa.x < -FOLGA || caixa.x + caixa.width > largura + FOLGA) {
            out.push(t.firstChild?.textContent ?? t.textContent);
          }
        }
        return out;
      })) {
        fugas.push(`${id}: ${t}`);
      }

      pequenos.push(...(await pagina.evaluate(() => {
        const out = [];
        // `[role="button"]` apanha as barras acionáveis do drill-down, que
        // são <g> em SVG e não <button>.
        for (const n of document.querySelectorAll('button, a, summary, [role="button"]')) {
          const r = n.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (n.closest("p, li, td, .figura__fonte, .cadeia, .leaflet-control-attribution")) continue;
          if (n.classList.contains("leaflet-marker-icon")) {
            out.push("__marcador__");
            continue;
          }
          if (r.height < 44 - 0.5) {
            out.push(`${n.tagName}: ${Math.round(r.height)}px — ${n.textContent.trim().slice(0, 40)}`);
          }
        }
        return out;
      })));
    }

    const ctx2 = `${rotulo} / ${tema}`;

    // 1. Scroll horizontal: zero, em qualquer secção.
    verificar(excesso <= 0, `${ctx2}: scroll horizontal de ${excesso}px`);

    // 2. Rótulos dos gráficos dentro do SVG.
    verificar(
      fugas.length === 0,
      `${ctx2}: ${fugas.length} rótulo(s) a transbordar — ex.: ${fugas[0] ?? ""}`,
    );

    // 3. Alvos de toque com pelo menos 44×44 px.
    //
    // A regra aplica-se a controlos autónomos: botões, itens de menu,
    // desdobráveis. NÃO se aplica a ligações dentro de uma frase — a WCAG
    // 2.5.8 isenta-as, e esticar um link a 44 px de altura no meio de um
    // parágrafo partiria o texto.
    //
    // **Os marcadores do mapa são uma exceção assumida**, não um descuido.
    // Têm 24×32 px. Ao zoom inicial, os dois equipamentos mais próximos ficam
    // a ~26 px um do outro: alvos de 44 px sobrepunham-se e tornavam a
    // seleção MENOS fiável, não mais. A lista abaixo do mapa tem a mesma
    // informação, com alvos de tamanho próprio, e não é uma alternativa de
    // recurso — é mostrada ao mesmo nível. A exceção é contada e impressa em
    // cada execução, para não desaparecer de vista.
    const marcadores = pequenos.filter((x) => x === "__marcador__").length;
    const outros = pequenos.filter((x) => x !== "__marcador__");
    verificar(
      outros.length === 0,
      `${ctx2}: ${outros.length} controlo(s) abaixo de 44px — ex.: ${outros[0] ?? ""}`,
    );
    if (marcadores) {
      excecoes.add(`${marcadores} marcadores do mapa a 24×32 px (exceção assumida)`);
    }

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
      `${ctx2.padEnd(34)} ${seccoes.length} secções · overflow ${excesso}px · ` +
        `contraste ${cPrincipal.toFixed(1)}:1 / ${cSecundaria.toFixed(1)}:1 · ` +
        `rótulos fora ${fugas.length}`,
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
servidor?.kill();

console.log("");
for (const e of excecoes) console.log(`exceção assumida: ${e}`);
for (const a of avisos) console.log(`aviso: ${a}`);
if (falhas.length) {
  console.log(`\n${falhas.length} verificação(ões) falhada(s):`);
  for (const f of falhas) console.log(`  ${f}`);
  process.exit(1);
}
console.log(`Todos os requisitos não negociáveis verificados em ${URL_BASE}`);
