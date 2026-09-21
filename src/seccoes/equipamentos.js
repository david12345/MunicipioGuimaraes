/* Secção 10 — Equipamentos municipais.
 *
 * Mapa e lista, lado a lado, com a mesma informação. O mapa não é a versão
 * "boa" com uma lista de recurso por baixo: num telemóvel a lista é muitas
 * vezes mais útil — dá morada e telefone sem obrigar a apontar o dedo. Os dois
 * mostram sempre o mesmo conjunto, e filtrar num filtra no outro.
 *
 * O Leaflet só é descarregado quando esta secção abre: são ~45 kB que não
 * fazem falta a quem só quer ver o orçamento.
 */

import { carregar } from "../nucleo/dados.js";
import { el } from "../nucleo/figura.js";
import { numero, NAO_DISPONIVEL } from "../nucleo/formato.js";

const CENTRO = [41.4425, -8.2918]; // centro histórico de Guimarães
const ZOOM = 13;

/* Marcador desenhado em SVG, não a imagem que o Leaflet traz.
 *
 * O ícone por omissão do Leaflet é referido por caminho relativo e não
 * sobrevive ao empacotamento — aparecia o texto alternativo em vez do pino.
 * Desenhá-lo evita o problema, evita dois pedidos de imagem, segue o tema, e
 * permite distinguir municipal de não municipal por **forma e preenchimento**,
 * não só por cor: um marcador cheio contra um vazado lê-se sem ver cor.
 */
function pino(L, municipal) {
  const cor = municipal ? "var(--serie-1)" : "var(--serie-2)";
  const preenchimento = municipal ? cor : "var(--superficie)";
  return L.divIcon({
    className: "pino",
    html:
      `<svg viewBox="0 0 24 32" width="24" height="32" aria-hidden="true">` +
      `<path d="M12 1C6.5 1 2 5.5 2 11c0 7.5 10 20 10 20s10-12.5 10-20C22 5.5 17.5 1 12 1z"` +
      ` fill="${preenchimento}" stroke="${cor}" stroke-width="2.5"/>` +
      `<circle cx="12" cy="11" r="3.5" fill="${municipal ? "#fff" : cor}"/>` +
      `</svg>`,
    iconSize: [24, 32],
    iconAnchor: [12, 31],
    popupAnchor: [0, -28],
  });
}

function cartaoEquipamento(e) {
  const c = el("article", {
    class: "equipamento",
    id: `eq-${e.id}`,
    tabindex: "-1",
  });
  c.append(el("h4", { class: "equipamento__nome", texto: e.nome }));

  const etiquetas = el("p", { class: "equipamento__etiquetas" });
  etiquetas.append(
    el("span", {
      class: e.municipal ? "selo selo--municipal" : "selo",
      texto: e.municipal ? "Municipal" : "Não municipal",
    }),
  );
  if (e.tema) {
    etiquetas.append(el("span", { class: "selo", texto: e.tema === "cultura" ? "Cultura" : "Juventude" }));
  }
  c.append(etiquetas);

  if (e.morada) c.append(el("p", { class: "equipamento__morada", texto: e.morada }));

  const contactos = el("p", { class: "equipamento__contactos" });
  if (e.telefone) {
    contactos.append(
      el("a", { href: `tel:${e.telefone.replace(/\s/g, "")}`, texto: e.telefone }),
    );
  }
  if (e.email) {
    if (contactos.childNodes.length) contactos.append(document.createTextNode(" · "));
    contactos.append(el("a", { href: `mailto:${e.email}`, texto: e.email }));
  }
  if (contactos.childNodes.length) c.append(contactos);

  if (e.no_concelho === false) {
    c.append(
      el("p", {
        class: "equipamento__sem-mapa",
        texto:
          "Fica fora do concelho de Guimarães — a Câmara lista-o como contacto útil.",
      }),
    );
  }

  if (!e.latitude) {
    c.append(
      el("p", {
        class: "equipamento__sem-mapa",
        texto: `Localização no mapa: ${NAO_DISPONIVEL} — a ficha da Câmara não publica coordenadas.`,
      }),
    );
  }
  return c;
}

export async function render(raiz) {
  const d = await carregar("equipamentos.json");

  raiz.append(
    el("p", {
      class: "resumo",
      html:
        `A Câmara publica fichas de <strong>${numero(d.total)} equipamentos</strong>, ` +
        `dos quais <strong>${numero(d.total_municipais)}</strong> são municipais. ` +
        `${numero(d.com_coordenadas)} têm coordenadas publicadas na fonte e ` +
        `aparecem no mapa; ${numero(d.no_concelho)} ficam dentro do concelho.`,
    }),
  );

  raiz.append(
    el("p", {
      class: "nota",
      texto:
        "As instalações desportivas não constam: são geridas pela Tempo Livre, " +
        "uma cooperativa, e o sítio do município não as lista. Os equipamentos " +
        "culturais “não municipais” são publicados pela Câmara mas não lhe " +
        "pertencem — a distinção vem da fonte e é mantida aqui.",
    }),
  );

  // --- Filtros -------------------------------------------------------------
  const filtros = el("div", { class: "seletor", role: "group", "aria-label": "Filtrar equipamentos" });
  const opcoes = [
    ["todos", "Todos", () => true],
    ["municipais", "Só municipais", (e) => e.municipal],
    ["cultura", "Cultura", (e) => e.tema === "cultura"],
    ["juventude", "Juventude", (e) => e.tema === "juventude"],
  ];
  let filtro = opcoes[0];

  const mapaCaixa = el("div", { class: "mapa", id: "mapa-equipamentos" });
  const lista = el("div", { class: "equipamentos" });
  const contagem = el("p", { class: "nota", role: "status" });

  let mapa = null;
  let marcadores = new Map();

  const aplicar = () => {
    const visiveis = d.equipamentos.filter(filtro[2]);
    lista.replaceChildren(...visiveis.map(cartaoEquipamento));
    contagem.textContent =
      `${visiveis.length} de ${d.total} equipamentos. ` +
      "A lista e o mapa mostram sempre o mesmo conjunto.";
    for (const [id, m] of marcadores) {
      const mostrar = visiveis.some((e) => e.id === id);
      if (mostrar) m.addTo(mapa);
      else m.remove();
    }
  };

  for (const op of opcoes) {
    const b = el("button", { type: "button", class: "botao", texto: op[1] });
    b.setAttribute("aria-pressed", String(op === filtro));
    if (op === filtro) b.classList.add("botao--ativo");
    b.addEventListener("click", () => {
      filtro = op;
      for (const outro of filtros.children) {
        const ativo = outro === b;
        outro.classList.toggle("botao--ativo", ativo);
        outro.setAttribute("aria-pressed", String(ativo));
      }
      aplicar();
    });
    filtros.append(b);
  }

  // Legenda do mapa: a identidade não pode depender só da cor. Aqui há forma
  // (cheio contra vazado), cor e texto — e a lista repete tudo por extenso.
  const legendaMapa = el("ul", { class: "legenda legenda--mapa" });
  for (const [texto, municipal] of [["Equipamento municipal", true], ["Não municipal", false]]) {
    const li = el("li");
    const marca = el("span", { class: "legenda__pino" });
    marca.innerHTML =
      `<svg viewBox="0 0 24 32" width="14" height="19" aria-hidden="true">` +
      `<path d="M12 1C6.5 1 2 5.5 2 11c0 7.5 10 20 10 20s10-12.5 10-20C22 5.5 17.5 1 12 1z"` +
      ` fill="${municipal ? "var(--serie-1)" : "var(--superficie)"}"` +
      ` stroke="${municipal ? "var(--serie-1)" : "var(--serie-2)"}" stroke-width="2.5"/></svg>`;
    li.append(marca, document.createTextNode(texto));
    legendaMapa.append(li);
  }

  raiz.append(filtros, mapaCaixa, legendaMapa, contagem, lista);

  // --- Mapa ----------------------------------------------------------------
  try {
    const [{ default: L }] = await Promise.all([
      import("leaflet"),
      import("leaflet/dist/leaflet.css"),
    ]);

    mapa = L.map(mapaCaixa, {
      center: CENTRO,
      zoom: ZOOM,
      // Sem isto, rolar a página sobre o mapa aproxima-o em vez de rolar —
      // num telemóvel é a diferença entre navegar e ficar preso.
      scrollWheelZoom: false,
      tap: true,
    });
    mapa.attributionControl.setPrefix("");
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '© colaboradores do <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa);

    for (const e of d.equipamentos) {
      if (e.latitude === null) continue;
      const m = L.marker([e.latitude, e.longitude], {
        title: e.nome,
        alt: e.nome,
        keyboard: true,
        icon: pino(L, e.municipal),
      });
      m.bindPopup(
        `<strong>${e.nome}</strong><br>${e.morada ?? ""}` +
          (e.municipal ? "" : "<br><em>Não municipal</em>") +
          (e.no_concelho === false ? "<br><em>Fora do concelho</em>" : ""),
      );
      marcadores.set(e.id, m);
      m.addTo(mapa);
    }

    // O enquadramento usa só os pontos DENTRO do concelho. A ficha do IPDJ de
    // Braga fica no mapa, mas incluí-la aqui afastava a vista 20 km e deixava
    // Guimarães num aglomerado ilegível.
    const pontos = d.equipamentos
      .filter((e) => e.latitude !== null && e.no_concelho !== false)
      .map((e) => [e.latitude, e.longitude]);
    if (pontos.length) mapa.fitBounds(pontos, { padding: [30, 30] });
  } catch (erro) {
    console.error("mapa:", erro);
    mapaCaixa.replaceChildren(
      el("p", {
        class: "erro",
        texto:
          "Não foi possível carregar o mapa. A lista abaixo tem a mesma " +
          "informação, com moradas e contactos.",
      }),
    );
  }

  aplicar();

  raiz.append(
    el("p", {
      class: "nota",
      texto:
        "As coordenadas são publicadas pela própria Câmara em cada ficha; não " +
        "foram estimadas nem obtidas por geocodificação. Uma das fichas aponta " +
        "para fora do concelho e está assinalada como tal.",
    }),
  );
}
