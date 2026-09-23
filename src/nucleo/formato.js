/* Formatação portuguesa e a regra do `null`.
 *
 * Os dados guardam números crus (regra do modelo de dados); toda a formatação
 * acontece aqui, na camada de apresentação, com `Intl.NumberFormat('pt-PT')`.
 *
 * `null` significa "dado não disponível" e é **sempre** renderizado como tal.
 * Nunca como 0, nunca como traço mudo, nunca omitido em silêncio — distinguir
 * "zero euros" de "não sabemos" é a diferença entre informar e enganar.
 */

export const NAO_DISPONIVEL = "Dado não disponível";

const euros = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  // Sem isto o Intl omite o separador em números de quatro dígitos: daria
  // "1330,96 €" em vez de "1 330,96 €".
  useGrouping: "always",
});

const eurosRedondos = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
  useGrouping: "always",
});

const inteiros = new Intl.NumberFormat("pt-PT", { useGrouping: "always" });

const percentagem = new Intl.NumberFormat("pt-PT", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

export function eDisponivel(valor) {
  return valor !== null && valor !== undefined && valor !== "";
}

export function dinheiro(valor, { redondo = false } = {}) {
  if (!eDisponivel(valor)) return NAO_DISPONIVEL;
  return (redondo ? eurosRedondos : euros).format(valor);
}

/** `220345685` → `220,3 M€`. Para cartões de destaque e eixos. */
export function dinheiroCurto(valor) {
  if (!eDisponivel(valor)) return NAO_DISPONIVEL;
  const abs = Math.abs(valor);
  if (abs >= 1e6) {
    return `${inteiros.format(Math.round((valor / 1e6) * 10) / 10)} M€`;
  }
  if (abs >= 1e3) {
    return `${inteiros.format(Math.round(valor / 1e3))} mil €`;
  }
  return eurosRedondos.format(valor);
}

export function numero(valor) {
  return eDisponivel(valor) ? inteiros.format(valor) : NAO_DISPONIVEL;
}

/** Recebe a percentagem já em pontos (80.01), não em fração. */
export function pontosPercentuais(valor) {
  return eDisponivel(valor) ? percentagem.format(valor / 100) : NAO_DISPONIVEL;
}

export function data(iso) {
  if (!eDisponivel(iso)) return NAO_DISPONIVEL;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "long" }).format(d);
}

/* Palavras que ficam em minúscula no meio de um nome próprio português. */
const LIGACOES = new Set(["de", "da", "do", "das", "dos", "e", "em", "no", "na"]);

/**
 * `DEPARTAMENTO DE INTERVENÇÃO SOCIAL` → `Departamento de Intervenção Social`.
 *
 * Os documentos orçamentais escrevem os nomes das unidades em maiúsculas.
 * Mostrá-los assim no ecrã é gritar com quem lê, e as maiúsculas seguidas são
 * mais lentas de ler — o olho perde a silhueta das palavras. A conversão é só
 * de apresentação: nos dados o nome fica como a fonte o escreveu.
 *
 * As siglas ficam intactas: uma palavra sem vogais, ou com dois caracteres ou
 * menos que não seja ligação, não é nome próprio.
 */
export function nomeUnidade(texto) {
  if (!eDisponivel(texto)) return NAO_DISPONIVEL;
  const palavras = String(texto).trim().toLowerCase().split(/\s+/);
  return palavras
    .map((p, i) => {
      const nu = p.replace(/[^a-zà-ÿ]/gi, "");
      if (i > 0 && LIGACOES.has(nu)) return p;
      if (nu && !/[aeiouà-ÿ]/i.test(nu)) return p.toUpperCase();
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(" ");
}

/**
 * `AQUISIÇÃO DE BENS E SERVIÇOS` → `Aquisição de bens e serviços`.
 *
 * As rubricas da classificação económica são nomes comuns, não próprios: vão
 * em maiúscula só na primeira letra. `nomeUnidade` trata do outro caso, o das
 * unidades orgânicas, que são nomes próprios.
 */
export function rotuloRubrica(texto) {
  if (!eDisponivel(texto)) return NAO_DISPONIVEL;
  const t = String(texto).trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** `ajuste_direto_regime_geral` → `Ajuste direto regime geral`. */
export function rotulo(chave) {
  if (!eDisponivel(chave)) return NAO_DISPONIVEL;
  const t = String(chave).replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
