/* Glossário dos termos técnicos.
 *
 * Um dashboard municipal está cheio de palavras que só fazem sentido a quem
 * trabalha em contabilidade pública: "despesa corrente", "cabimento", "GOP",
 * "perímetro de consolidação". Escrevê-las sem explicar é escrever para quem
 * já sabe — exatamente o contrário do que este dashboard serve.
 *
 * Os termos são marcados automaticamente no texto corrido e abrem uma
 * definição num `<dialog>` nativo: acessível por teclado, fecha com Escape, e
 * no telemóvel ocupa o ecrã em vez de ser um balão que foge ao dedo.
 */

export const TERMOS = {
  "despesa corrente": {
    titulo: "Despesa corrente",
    texto:
      "O que a Câmara gasta no funcionamento do dia a dia: salários, " +
      "eletricidade, combustíveis, serviços contratados, apoios a " +
      "associações. Repete-se todos os anos e não deixa nada de duradouro.",
  },
  "despesa de capital": {
    titulo: "Despesa de capital",
    texto:
      "Investimento: obras, edifícios, viaturas, equipamento, compra de " +
      "terrenos. Ao contrário da despesa corrente, deixa um bem que dura " +
      "para lá do ano em que foi pago.",
  },
  "receita corrente": {
    titulo: "Receita corrente",
    texto:
      "O que entra regularmente: impostos municipais, taxas, rendas e as " +
      "transferências que o Estado faz todos os anos para o município.",
  },
  "receita de capital": {
    titulo: "Receita de capital",
    texto:
      "Entradas pontuais e ligadas a investimento: venda de património, " +
      "fundos europeus para obras, empréstimos de médio e longo prazo.",
  },
  "grau de execução": {
    titulo: "Grau de execução orçamental",
    texto:
      "Quanto do orçamento foi mesmo concretizado. Um grau de 80% na despesa " +
      "significa que, de cada 100 € orçamentados, 80 € foram efetivamente " +
      "gastos — o resto ficou por executar nesse ano.",
  },
  "perímetro de consolidação": {
    titulo: "Perímetro de consolidação",
    texto:
      "O conjunto de entidades cujas contas se somam às do município para dar " +
      "a imagem financeira do grupo. Uma entidade em que o município tem " +
      "participação pequena fica de fora.",
  },
  "ajuste direto": {
    titulo: "Ajuste direto",
    texto:
      "Procedimento em que a entidade pública convida diretamente uma ou mais " +
      "empresas, sem concurso aberto. É mais rápido, mas só é admissível " +
      "abaixo de certos valores e em situações previstas na lei.",
  },
  "concurso público": {
    titulo: "Concurso público",
    texto:
      "Procedimento aberto: qualquer empresa que cumpra os requisitos pode " +
      "apresentar proposta. É o mais transparente e o exigido para os " +
      "contratos de maior valor.",
  },
  adjudicante: {
    titulo: "Entidade adjudicante",
    texto:
      "Quem compra — neste caso o Município ou uma das suas entidades " +
      "participadas. Cada uma tem número de identificação fiscal próprio, e é " +
      "por aí que os contratos são separados.",
  },
  adjudicatário: {
    titulo: "Adjudicatário",
    texto: "Quem vende: a empresa ou pessoa a quem o contrato foi entregue.",
  },
  "mapa de pessoal": {
    titulo: "Mapa de pessoal",
    texto:
      "Documento que a Câmara aprova todos os anos com os postos de trabalho " +
      "de que precisa, por carreira e por serviço. Conta lugares, não " +
      "pessoas: um posto pode estar previsto e por preencher.",
  },
  pelouro: {
    titulo: "Pelouro",
    texto:
      "A área por que cada membro do executivo responde — cultura, obras, " +
      "ação social. Quem não tem pelouro não tem competências delegadas e " +
      "não exerce funções a tempo inteiro.",
  },
  "unidade orgânica": {
    titulo: "Unidade orgânica",
    texto:
      "Cada peça da estrutura dos serviços: direção municipal, departamento, " +
      "divisão, gabinete. A hierarquia entre elas é fixada em despacho " +
      "publicado no Diário da República.",
  },
  "plano plurianual de investimentos": {
    titulo: "Plano Plurianual de Investimentos (PPI)",
    texto:
      "A lista de obras e investimentos que o município planeia para os " +
      "próximos anos, com o valor previsto para cada ano. Faz parte dos " +
      "documentos previsionais aprovados com o orçamento.",
  },
  "grandes opções do plano": {
    titulo: "Grandes Opções do Plano (GOP)",
    texto:
      "O documento que fixa o que o município se propõe fazer no ano e nos " +
      "seguintes, e quanto tenciona gastar em cada objetivo. É aprovado " +
      "juntamente com o orçamento, em dezembro.",
  },
  cabimento: {
    titulo: "Cabimento",
    texto:
      "A reserva de verba no orçamento antes de assumir uma despesa. Sem " +
      "cabimento não se pode contratar: é o travão que impede gastar dinheiro " +
      "que não está orçamentado.",
  },
  "saldo global": {
    titulo: "Saldo global",
    texto:
      "A diferença entre a receita efetiva e a despesa efetiva do ano. " +
      "Positivo significa que entrou mais do que saiu; negativo, o contrário.",
  },
};

// Ordem decrescente de comprimento: "despesa de capital" tem de ser testada
// antes de "despesa corrente" não acertar em "despesa" por acaso.
const CHAVES = Object.keys(TERMOS).sort((a, b) => b.length - a.length);

function semAcentos(s) {
  return s.normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase();
}

let dialogo = null;

function obterDialogo() {
  if (dialogo) return dialogo;
  dialogo = document.createElement("dialog");
  dialogo.className = "glossario";
  dialogo.innerHTML = `
    <h2 class="glossario__titulo"></h2>
    <p class="glossario__texto"></p>
    <form method="dialog">
      <button class="botao" autofocus>Fechar</button>
    </form>`;
  document.body.append(dialogo);
  // Clicar fora fecha: no telemóvel é o gesto esperado.
  dialogo.addEventListener("click", (e) => {
    if (e.target === dialogo) dialogo.close();
  });
  return dialogo;
}

export function abrirTermo(chave) {
  const t = TERMOS[chave];
  if (!t) return;
  const d = obterDialogo();
  d.querySelector(".glossario__titulo").textContent = t.titulo;
  d.querySelector(".glossario__texto").textContent = t.texto;
  d.showModal();
}

/** Marca os termos conhecidos dentro de um elemento de texto corrido. */
export function marcarTermos(raiz) {
  const alvos = raiz.querySelectorAll(
    ".resumo, .figura__resumo, .nota, .sem-dados p",
  );
  for (const alvo of alvos) {
    // Um termo só é marcado uma vez por parágrafo: sublinhar todas as
    // ocorrências transforma o texto num campo de minas.
    const jaMarcados = new Set();
    for (const chave of CHAVES) {
      const nos = [];
      const caminhante = document.createTreeWalker(alvo, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = caminhante.nextNode())) {
        if (!n.parentElement.closest("button, a")) nos.push(n);
      }
      for (const no of nos) {
        if (jaMarcados.has(chave)) break;
        const idx = semAcentos(no.textContent).indexOf(semAcentos(chave));
        if (idx < 0) continue;
        const original = no.textContent.slice(idx, idx + chave.length);
        const depois = no.splitText(idx);
        depois.textContent = depois.textContent.slice(chave.length);
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "termo";
        botao.textContent = original;
        botao.title = `O que é "${TERMOS[chave].titulo}"?`;
        botao.addEventListener("click", () => abrirTermo(chave));
        no.parentNode.insertBefore(botao, depois);
        jaMarcados.add(chave);
      }
    }
  }
}
