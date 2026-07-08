// ---------- Helpers ----------
function brl(v, opts) {
  opts = opts || {};
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(Math.round(v));
  const formatted = abs.toLocaleString('pt-BR');
  return `${sign}R$ ${formatted}`;
}
function pct(v) {
  return `${Math.round(v * 100)}%`;
}
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

// ---------- Render: Model Cards ----------
function renderModelCards() {
  const grid = document.getElementById('modelsGrid');
  grid.innerHTML = '';
  MODELS.forEach(m => {
    const card = el('div', 'model-card' + (m.id === 'GS_BLACK' ? ' flagship' : ''));
    if (m.id === 'GS_BLACK') card.appendChild(el('span', 'badge', 'Topo de linha'));
    card.appendChild(el('h3', null, m.nome));
    card.appendChild(el('div', 'price', `${brl(m.aquisicao)}<small>investimento de aquisição</small>`));
    const dl = el('dl');
    const rows = [
      ['Royalties/mês', brl(m.royalties)],
      ['Prazo de contrato', m.prazoTexto],
      ['Abrangência', m.abrangencia],
      m.faixaProgressiva
        ? ['% Honorários', '35% a 60% (faixa progressiva)']
        : null,
      m.faixaProgressiva ? null : ['% Honorários Tax', pct(m.pctTax)],
      m.faixaProgressiva ? null : ['% Honorários Corporate', pct(m.pctCorporate)],
      ['Mídia/mês', m.midiaMensal ? brl(m.midiaMensal) : '—'],
      ['Equipe dedicada', m.equipeDedicada ? '<span class="tag-yes">Sim</span>' : '<span class="tag-no">Não</span>'],
      ['Pode vender franquia', m.podeVenderFranquia ? '<span class="tag-yes">Sim</span>' : '<span class="tag-no">Não</span>'],
    ];
    rows.filter(Boolean).forEach(([k, v]) => {
      const row = el('div', 'row');
      row.appendChild(el('span', null, k));
      row.appendChild(el('span', null, v));
      dl.appendChild(row);
    });
    card.appendChild(dl);
    card.appendChild(el('div', 'estrutura', m.estrutura + (m.nota ? ' · ' + m.nota : '')));
    grid.appendChild(card);
  });
}

// ---------- Render: Premissas & Produtos Table ----------
function renderPremissas() {
  const host = document.getElementById('premissasTable');
  const maxTkm = Math.max(...PRODUCTS.map(p => p.tkm));
  const groupHead = label => `<tr class="group-head"><td class="name" colspan="6">${label}</td></tr>`;
  const row = p => `
    <tr>
      <td class="name">${p.nome}</td>
      <td>${brl(p.totalCreditos)}</td>
      <td>${pct(p.pctHonorarios)}</td>
      <td><div class="tkm-wrap"><div class="tkm-bar" style="width:${(p.tkm / maxTkm) * 100}%"></div><span class="tkm-val">${brl(p.tkm)}</span></div></td>
      <td>${p.tempo}º mês</td>
      <td>${p.parcelas}x</td>
    </tr>`;

  let html = `
    <table class="premissas-table">
      <thead>
        <tr>
          <th class="name">Produto</th>
          <th>Total de Créditos</th>
          <th>% Honorários</th>
          <th>TKM Produtos</th>
          <th>Tempo até 1ª parcela</th>
          <th>Parcelas</th>
        </tr>
      </thead>
      <tbody>
        ${groupHead('Linha Tax')}
        ${PRODUCTS.filter(p => p.grupo === 'tax').map(row).join('')}
        ${groupHead('Linha Corporate')}
        ${PRODUCTS.filter(p => p.grupo === 'corporate').map(row).join('')}
      </tbody>
    </table>`;
  host.innerHTML = html;
}

// ---------- Simulator State ----------
let selectedModelId = 'TAX';
const inputs = {};
PRODUCTS.forEach(p => inputs[p.id] = 0);

// Faturamento médio anual (últimos 5 anos) do cliente-alvo, usado pela tabela de ganhos progressiva
// do GS Partner/GS Black (FAIXA_GANHOS) — irrelevante para os demais modelos (% fixo).
let faturamentoClienteMedio = 0;
function pctPorFaixa(faturamentoAnual) {
  const faixa = FAIXA_GANHOS.find(f => faturamentoAnual <= f.ate);
  return faixa ? faixa.pct : FAIXA_GANHOS[FAIXA_GANHOS.length - 1].pct;
}
function bindFaixaInput() {
  document.getElementById('faixaFaturamentoCliente').addEventListener('input', e => {
    faturamentoClienteMedio = Math.max(0, Number(e.target.value) || 0);
    update();
  });
}
function resetFaixaInput() {
  faturamentoClienteMedio = 0;
  document.getElementById('faixaFaturamentoCliente').value = '';
}

// Participantes adicionais no treinamento (além do(s) já incluso(s) em model.treinamento),
// a R$1.500 cada, per "Política Comercial 2026".
let participantesAdicionais = 0;
function bindParticipantesInput() {
  document.getElementById('participantesAdicionais').addEventListener('input', e => {
    participantesAdicionais = Math.max(0, Math.round(Number(e.target.value) || 0));
    update();
  });
}
function resetParticipantesInput() {
  participantesAdicionais = 0;
  document.getElementById('participantesAdicionais').value = '0';
}

// valorVenda: preço negociado da franquia (0 = usa o valor de aquisição do modelo selecionado)
// entrada/parcelas/juros: condições de pagamento dessa aquisição (0 parcelas = pagamento à vista)
const financing = { valorVenda: 0, entrada: 0, parcelas: 0, juros: 0 };
function bindFinancingInputs() {
  const ids = { valorVenda: 'finValorVenda', entrada: 'finEntrada', parcelas: 'finParcelas', juros: 'finJuros' };
  Object.entries(ids).forEach(([key, id]) => {
    document.getElementById(id).addEventListener('input', e => {
      financing[key] = Math.max(0, Number(e.target.value) || 0);
      update();
    });
  });
}
function resetFinancingInputs() {
  financing.valorVenda = 0; financing.entrada = 0; financing.parcelas = 0; financing.juros = 0;
  document.getElementById('finValorVenda').value = '';
  document.getElementById('finEntrada').value = '0';
  document.getElementById('finParcelas').value = '0';
  document.getElementById('finJuros').value = '0';
}

// Assessment (aba Simulador da planilha original): respostas qualitativas que alimentam uma
// sugestão de contratos/ano (fórmula G9) e, no caso de "vendedor focado", um custo real de
// equipe (DRE Financeiro!B17 = IF(C21="SIM",7000,0)) — verificado direto na planilha-fonte.
const assessment = { horas: 0, parceria: false, vendedor: false, carteira: false };
function bindAssessmentInputs() {
  document.getElementById('assHoras').addEventListener('input', e => {
    assessment.horas = Math.max(0, Number(e.target.value) || 0);
    update();
  });
  const boolIds = { parceria: 'assParceria', vendedor: 'assVendedor', carteira: 'assCarteira' };
  Object.entries(boolIds).forEach(([key, id]) => {
    document.getElementById(id).addEventListener('change', e => {
      assessment[key] = e.target.value === 'sim';
      update();
    });
  });
}
function resetAssessmentInputs() {
  assessment.horas = 0; assessment.parceria = false; assessment.vendedor = false; assessment.carteira = false;
  document.getElementById('assHoras').value = '0';
  document.getElementById('assParceria').value = 'nao';
  document.getElementById('assVendedor').value = 'nao';
  document.getElementById('assCarteira').value = 'nao';
}

// Despesas adicionais: custos mensais recorrentes definidos livremente pelo usuário
// (ex.: funcionário, parceria, combustível), somados ao fluxo de caixa a partir do mês informado.
let customExpenses = [];
let customExpenseSeq = 0;
function addCustomExpense() {
  customExpenses.push({ id: ++customExpenseSeq, nome: '', valor: 0, mesInicio: 1 });
  renderCustomExpenses();
  update();
}
function removeCustomExpense(id) {
  customExpenses = customExpenses.filter(e => e.id !== id);
  renderCustomExpenses();
  update();
}
function renderCustomExpenses() {
  const host = document.getElementById('customExpensesList');
  host.innerHTML = '';
  customExpenses.forEach(exp => {
    const row = el('div', 'expense-row');
    row.dataset.id = exp.id;

    const nome = document.createElement('input');
    nome.type = 'text'; nome.className = 'expense-nome'; nome.placeholder = 'Nome da despesa'; nome.value = exp.nome;
    nome.addEventListener('input', () => { exp.nome = nome.value; update(); });

    const valor = document.createElement('input');
    valor.type = 'number'; valor.className = 'expense-valor'; valor.min = '0'; valor.placeholder = 'R$/mês'; valor.value = exp.valor || '';
    valor.addEventListener('input', () => { exp.valor = Math.max(0, Number(valor.value) || 0); update(); });

    const mes = document.createElement('input');
    mes.type = 'number'; mes.className = 'expense-mes'; mes.min = '1'; mes.title = 'Mês de início'; mes.value = exp.mesInicio;
    mes.addEventListener('input', () => { exp.mesInicio = Math.max(1, Math.round(Number(mes.value) || 1)); update(); });

    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'expense-remove'; remove.textContent = '×'; remove.title = 'Remover';
    remove.addEventListener('click', () => removeCustomExpense(exp.id));

    row.appendChild(nome); row.appendChild(valor); row.appendChild(mes); row.appendChild(remove);
    host.appendChild(row);
  });
}
function resetCustomExpenses() {
  customExpenses = [];
  renderCustomExpenses();
}

function renderModelPills() {
  const host = document.getElementById('modelPills');
  host.innerHTML = '';
  MODELS.forEach(m => {
    const btn = el('button', 'model-pill' + (m.id === selectedModelId ? ' active' : ''), m.nome);
    btn.onclick = () => { selectedModelId = m.id; renderModelPills(); update(); };
    host.appendChild(btn);
  });
}

function renderFieldGroups() {
  const host = document.getElementById('fieldGroups');
  host.innerHTML = '';
  ['tax', 'corporate'].forEach(grupo => {
    host.appendChild(el('h5', null, `Contratos/ano · ${grupo === 'tax' ? 'Tax' : 'Corporate'}`));
    PRODUCTS.filter(p => p.grupo === grupo).forEach(p => {
      const row = el('div', 'field-row');
      row.appendChild(el('label', null, p.nome));
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.value = inputs[p.id];
      input.addEventListener('input', () => {
        inputs[p.id] = Math.max(0, Number(input.value) || 0);
        update();
      });
      row.appendChild(input);
      host.appendChild(row);
    });
  });
}

// ---------- Calculation Engine ----------
// Replica fielmente a planilha "Planejamento Financeiro - Franqueado":
// Honorários (aba Operação, regime de competência) x Faturamento (aba Fluxo de Caixa, regime de caixa por parcela)
// alimentam a DRE Financeiro, cuja última linha é o Fluxo de Caixa acumulado.
function simulate(model) {
  const months = model.anos * 12;
  const zeros = () => new Array(months).fill(0);

  const honorariosTax = zeros(), honorariosCorp = zeros();
  const faturamentoTax = zeros(), faturamentoCorp = zeros();

  // GS Partner / GS Black: % de honorários é progressivo, conforme a faixa de faturamento médio
  // (últimos 5 anos) do cliente informada pelo usuário — substitui o pctTax/pctCorporate fixo do modelo.
  const pctFaixaAtual = model.faixaProgressiva ? pctPorFaixa(faturamentoClienteMedio) : null;
  const pctTaxEfetivo = model.faixaProgressiva ? pctFaixaAtual : model.pctTax;
  const pctCorporateEfetivo = model.faixaProgressiva ? pctFaixaAtual : model.pctCorporate;

  PRODUCTS.forEach(p => {
    const contractsYear = inputs[p.id] || 0;
    const monthlyContracts = contractsYear / 12;
    const feePerContract = p.tkm * p.aprovacao * (p.grupo === 'tax' ? pctTaxEfetivo : pctCorporateEfetivo);
    const revenueClosedPerMonth = monthlyContracts * feePerContract;
    const honorariosArr = p.grupo === 'tax' ? honorariosTax : honorariosCorp;
    const faturamentoArr = p.grupo === 'tax' ? faturamentoTax : faturamentoCorp;

    for (let m = 0; m < months; m++) honorariosArr[m] += revenueClosedPerMonth;

    const perInstallment = p.parcelas > 0 ? revenueClosedPerMonth / p.parcelas : 0;
    for (let closeMonth = 0; closeMonth < months; closeMonth++) {
      const start = closeMonth + p.tempo;
      for (let k = 0; k < p.parcelas; k++) {
        const payMonth = start + k;
        if (payMonth < months) faturamentoArr[payMonth] += perInstallment;
      }
    }
  });

  const honorariosTotal = honorariosTax.map((v, i) => v + honorariosCorp[i]);
  const monthlyRevenue = faturamentoTax.map((v, i) => v + faturamentoCorp[i]);

  const totalContratosAno = Object.values(inputs).reduce((a, b) => a + b, 0);
  const despesasComerciaisMensal = (totalContratosAno * REUNIOES_POR_CONTRATO * CUSTO_POR_REUNIAO) / 12;
  // "Vendedor focado" (assessment) é o driver real do custo de equipe na planilha-fonte
  // (DRE Financeiro!B17 = IF(Simulador!C21="SIM",7000,0)), não o modelo escolhido.
  const funcionariosMensal = assessment.vendedor ? CUSTO_FUNCIONARIO_MENSAL : 0;

  // Sugestão de contratos/ano com base no assessment (Simulador!G9 da planilha-fonte) — puramente
  // informativa, não altera os contratos projetados preenchidos manualmente abaixo.
  const scoreAssessment = (assessment.horas >= 8 ? 1 : 0.5)
    + (assessment.parceria ? 0.5 : 0)
    + (assessment.vendedor ? 1 : 0)
    + (assessment.carteira ? 0.5 : 0)
    + (model.id === 'GS_PARTNER' ? 2 : 0);
  const contratosSugeridos = scoreAssessment * 12;
  const reunioesNecessarias = contratosSugeridos * REUNIOES_POR_CONTRATO;

  // Financiamento da aquisição da franquia (valor da venda, entrada, parcelas e juros mensal
  // informados pelo usuário na aba Simulador) — se não preenchido, cai no padrão: valor de
  // aquisição do modelo pago à vista no fechamento (mês 0), igual ao comportamento anterior.
  const valorVenda = financing.valorVenda > 0 ? financing.valorVenda : model.aquisicao;
  const parcelasFin = Math.min(months - 1, Math.max(0, Math.round(financing.parcelas || 0)));
  const jurosFin = Math.max(0, financing.juros || 0) / 100;
  const financiamento = zeros();
  let entradaFin, installmentFin;
  if (parcelasFin > 0) {
    entradaFin = Math.min(Math.max(0, financing.entrada || 0), valorVenda);
    const pv = valorVenda - entradaFin;
    installmentFin = jurosFin > 0 ? pv * jurosFin / (1 - Math.pow(1 + jurosFin, -parcelasFin)) : pv / parcelasFin;
    financiamento[0] += -entradaFin;
    for (let k = 0; k < parcelasFin; k++) financiamento[k + 1] += -installmentFin;
  } else {
    entradaFin = valorVenda;
    installmentFin = 0;
    financiamento[0] += -valorVenda;
  }
  const custoTotalAquisicao = entradaFin + installmentFin * parcelasFin;

  // Despesas adicionais definidas livremente pelo usuário (funcionário, parceria, combustível etc.),
  // custo mensal recorrente a partir do mês de início informado (1 = primeiro mês do contrato).
  const outrasDespesas = zeros();
  customExpenses.forEach(exp => {
    const valor = Math.max(0, exp.valor || 0);
    if (valor <= 0) return;
    const startIdx = Math.min(months - 1, Math.max(0, Math.round(exp.mesInicio || 1) - 1));
    for (let m = startIdx; m < months; m++) outrasDespesas[m] += -valor;
  });

  // Taxa de treinamento é cobrada por participante: model.treinamento cobre o(s) participante(s)
  // incluso(s), cada participante adicional soma CUSTO_PARTICIPANTE_ADICIONAL.
  const treinamentoTotal = model.treinamento + participantesAdicionais * CUSTO_PARTICIPANTE_ADICIONAL;

  const impostos = zeros(), royalties = zeros(), crm = zeros(), comercial = zeros();
  const funcionarios = zeros(), midia = zeros(), treinamento = zeros(), contabilidade = zeros();
  const monthlyExpense = zeros(), monthlyProfit = zeros(), cashFlow = zeros();

  for (let m = 0; m < months; m++) {
    impostos[m] = -(monthlyRevenue[m] * IMPOSTOS_PCT);
    royalties[m] = -model.royalties;
    crm[m] = -model.crm;
    comercial[m] = -despesasComerciaisMensal;
    funcionarios[m] = -funcionariosMensal;
    midia[m] = -model.midiaMensal;
    treinamento[m] = m === 0 ? -treinamentoTotal : 0;
    contabilidade[m] = -CUSTO_CONTABILIDADE_MENSAL;

    monthlyExpense[m] = impostos[m] + royalties[m] + crm[m] + comercial[m] + funcionarios[m] + midia[m] + treinamento[m] + contabilidade[m] + financiamento[m] + outrasDespesas[m];
    monthlyProfit[m] = monthlyRevenue[m] + monthlyExpense[m];
    cashFlow[m] = (m === 0 ? 0 : cashFlow[m - 1]) + monthlyProfit[m];
  }

  const sum = a => a.reduce((x, y) => x + y, 0);
  const faturamentoAno1 = sum(monthlyRevenue.slice(0, 12));
  const despesasAno1 = sum(monthlyExpense.slice(0, 12));
  const lucroAno1 = faturamentoAno1 + despesasAno1;

  const faturamentoTotal = sum(monthlyRevenue);
  const despesasTotal = sum(monthlyExpense);
  const lucroFinal = faturamentoTotal + despesasTotal;
  const roi = custoTotalAquisicao > 0 ? lucroFinal / custoTotalAquisicao : 0;
  const lucratividade = faturamentoAno1 > 0 ? lucroAno1 / faturamentoAno1 : 0;

  // Capital de giro: reserva para cobrir só os custos recorrentes devidos ao Grupo Studio
  // (royalties + CRM + contabilidade — os mesmos "custos fixos" do card acima) durante os meses
  // em que a unidade opera no vermelho. Não inclui aquisição/financiamento (já aparece em cards
  // próprios) nem custos variáveis (comercial, funcionários, mídia, despesas adicionais).
  const custosFixosMensal = model.royalties + model.crm + CUSTO_CONTABILIDADE_MENSAL;
  const mesesDeficitarios = monthlyProfit.filter(v => v < 0).length;
  const capitalGiro = -custosFixosMensal * mesesDeficitarios;

  // Breakeven: 1º mês em que o LUCRO mensal (operacional) fica positivo
  let breakEvenMonth = null;
  for (let m = 0; m < months; m++) {
    if (monthlyProfit[m] > 0) { breakEvenMonth = m + 1; break; }
  }
  // Payback: 1º mês em que o FLUXO DE CAIXA acumulado (já descontado o investimento) fica positivo
  let paybackMonth = null;
  for (let m = 0; m < months; m++) {
    if (cashFlow[m] > 0) { paybackMonth = m + 1; break; }
  }

  return {
    honorariosTax, honorariosCorp, honorariosTotal,
    faturamentoTax, faturamentoCorp, monthlyRevenue,
    impostos, royalties, crm, comercial, funcionarios, midia, treinamento, contabilidade, financiamento, outrasDespesas,
    monthlyExpense, monthlyProfit, cashFlow,
    faturamentoAno1, despesasAno1, lucroAno1, lucroFinal, roi, lucratividade,
    capitalGiro, breakEvenMonth, paybackMonth,
    valorVenda, entradaFin, parcelasFin, installmentFin, jurosFin, custoTotalAquisicao,
    investimentoInicial: entradaFin + treinamentoTotal,
    treinamentoTotal,
    contratosSugeridos, reunioesNecessarias,
    pctFaixaAtual, pctTaxEfetivo, pctCorporateEfetivo,
    anos: model.anos,
  };
}

// ---------- Render: Stats ----------
function statCardsData(model, r) {
  const financiamentoDesc = r.parcelasFin > 0
    ? `Entrada ${brl(r.entradaFin)} + ${r.parcelasFin}x ${brl(r.installmentFin)}${r.jurosFin > 0 ? ` (juros de ${(r.jurosFin * 100).toFixed(1)}% a.m.)` : ''} — custo total ${brl(r.custoTotalAquisicao)}`
    : `${brl(r.valorVenda)} pago à vista no fechamento`;
  // Card resumido: só os custos fixos e previsíveis da operação (royalties/taxa de franquia + CRM +
  // contabilidade). Impostos, comercial, funcionários, mídia, financiamento e despesas adicionais
  // variam por cenário e aparecem detalhados na aba DRE Financeiro — sem isso o card ficava alto
  // e difícil de interpretar. O "Lucro Ano 1" continua líquido de TODOS os custos reais.
  const sum12 = arr => arr.slice(0, 12).reduce((a, b) => a + b, 0);
  const custosFixosAno1 = sum12(r.royalties) + sum12(r.crm) + sum12(r.contabilidade);
  return [
    ['Investimento inicial', brl(-r.investimentoInicial), 'neu', 'Taxa de aquisição + treinamento'],
    ['Aquisição da franquia', brl(-r.custoTotalAquisicao), 'neu', financiamentoDesc],
    ['Faturamento Ano 1', brl(r.faturamentoAno1), 'pos', 'Honorários recebidos (base caixa)'],
    ['Faturamento médio mensal', brl(r.faturamentoAno1 / 12), 'pos', 'Faturamento Ano 1 ÷ 12'],
    ['Custos fixos Ano 1', brl(custosFixosAno1), 'neg', 'Royalties (taxa de franquia), CRM e contabilidade — demais custos no DRE'],
    ['Lucro Ano 1', brl(r.lucroAno1), r.lucroAno1 >= 0 ? 'pos' : 'neg', 'Faturamento − todos os custos reais'],
    ['Capital de giro necessário', brl(r.capitalGiro), 'neg', 'Royalties + CRM + contabilidade nos meses no vermelho'],
    ['Breakeven', r.breakEvenMonth ? `Mês ${r.breakEvenMonth}` : `Não atingido em ${model.anos} anos`, r.breakEvenMonth ? 'pos' : 'neg', 'Lucro mensal fica positivo'],
    ['Payback', r.paybackMonth ? `Mês ${r.paybackMonth}` : `Sem payback em ${model.anos} anos`, r.paybackMonth ? 'pos' : 'neg', 'Caixa acumulado recupera o investimento'],
    ['ROI', `${r.roi.toFixed(1)}x`, r.roi >= 0 ? 'pos' : 'neg', `Sobre o contrato de ${model.anos} anos`],
    ['Lucratividade', pct(r.lucratividade), r.lucratividade >= 0 ? 'pos' : 'neg', 'Lucro / Faturamento — Ano 1'],
    ['Lucro final do contrato', brl(r.lucroFinal), r.lucroFinal >= 0 ? 'pos' : 'neg', `Projeção para ${model.anos} anos`],
  ];
}

function renderHeroStats(model, r) {
  document.getElementById('heroInvestimento').textContent = brl(-r.investimentoInicial);
  document.getElementById('heroFaturamento').textContent = brl(r.faturamentoAno1);
  document.getElementById('heroBreakeven').textContent = r.breakEvenMonth ? `Mês ${r.breakEvenMonth}` : 'Não atingido';
  document.getElementById('heroPayback').textContent = r.paybackMonth ? `Mês ${r.paybackMonth}` : 'Não atingido';
}

function renderStats(model, r) {
  const grid = document.getElementById('statGrid');
  grid.innerHTML = '';
  const cards = statCardsData(model, r);
  cards.forEach(([label, value, cls, sub]) => {
    const c = el('div', 'stat-card');
    c.appendChild(el('div', 'label', label));
    c.appendChild(el('div', `value ${cls}`, value));
    c.appendChild(el('div', 'sub', sub));
    grid.appendChild(c);
  });
}

// ---------- Render: Chart ----------
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Eixo X: nomes dos meses quando cabe em 1 ano; agrega em "Ano N" para contratos de 3 a 10 anos
function monthAxisSvg(n, xFn, H) {
  if (n <= 12) {
    return MESES.slice(0, n).map((m, i) => `<text x="${xFn(i)}" y="${H - 12}" font-size="11" fill="#7A7876" text-anchor="middle">${m}</text>`).join('');
  }
  const anos = Math.round(n / 12);
  let out = '';
  for (let y = 0; y < anos; y++) {
    const mid = y * 12 + 5.5;
    out += `<text x="${xFn(mid)}" y="${H - 12}" font-size="11" font-weight="700" fill="#7A7876" text-anchor="middle">Ano ${y + 1}</text>`;
  }
  return out;
}
function yearDividersSvg(n, xFn, padT, padB, H) {
  if (n <= 12) return '';
  const anos = Math.round(n / 12);
  let out = '';
  for (let y = 1; y < anos; y++) {
    const xx = xFn(y * 12);
    out += `<line x1="${xx}" y1="${padT}" x2="${xx}" y2="${H - padB}" stroke="#E1DDD5" stroke-width="1" stroke-dasharray="2 3"/>`;
  }
  return out;
}
function periodoLabel(n) {
  return n <= 12 ? '— Ano 1' : `— Ano 1 a Ano ${Math.round(n / 12)}`;
}

// ---------- Render: Fluxo de Caixa chart (Receita/Despesa/Lucro em eixo próprio + Caixa acumulado em eixo próprio) ----------
// Eixo duplo: os fluxos mensais (receita/despesa/lucro) e o caixa acumulado têm ordens de grandeza muito diferentes
// (o acumulado composto ao longo do contrato pode ser 10-20x maior que o fluxo de um único mês) — usar a mesma escala
// linear para os dois faz a despesa/receita mensal "sumir" perto de zero. Cada série usa sua própria escala vertical,
// alinhadas ao mesmo retângulo de plotagem, com o eixo esquerdo (cinza) para os fluxos e o direito (bronze) p/ o acumulado.
const COR_RECEITA = '#175FAE', COR_DESPESA = '#C1531E', COR_LUCRO = '#111111', COR_ACUMULADO = '#6E4A1F';

function renderFlowChart(r, opts) {
  const { hostId, legendId, titleId, titlePrefix } = opts;
  const host = document.getElementById(hostId);
  if (!host) return;
  const gradId = 'grad-' + hostId;
  const W = 900, H = 320, padL = 80, padR = 80, padT = 20, padB = 34;

  const flows = { receita: r.monthlyRevenue, despesa: r.monthlyExpense, lucro: r.monthlyProfit };
  const acumulado = r.cashFlow;
  const n = acumulado.length;

  const flowVals = [].concat(flows.receita, flows.despesa, flows.lucro);
  const minFlow = Math.min(0, ...flowVals), maxFlow = Math.max(0, ...flowVals);
  const rangeFlow = (maxFlow - minFlow) || 1;
  const minAcum = Math.min(0, ...acumulado), maxAcum = Math.max(0, ...acumulado);
  const rangeAcum = (maxAcum - minAcum) || 1;

  const x = i => padL + (i / (n - 1)) * (W - padL - padR);
  const yFlow = v => padT + (1 - (v - minFlow) / rangeFlow) * (H - padT - padB);
  const yAcum = v => padT + (1 - (v - minAcum) / rangeAcum) * (H - padT - padB);
  const zeroYAcum = yAcum(0);

  const line = (arr, yFn) => arr.map((v, i) => `${x(i)},${yFn(v)}`).join(' ');
  const areaPath = (arr, yFn) => `M${x(0)},${zeroYAcum} ` + arr.map((v, i) => `L${x(i)},${yFn(v)}`).join(' ') + ` L${x(n - 1)},${zeroYAcum} Z`;

  let gridLines = yearDividersSvg(n, x, padT, padB, H);
  const labels = monthAxisSvg(n, x, H);
  const yTicks = 4;
  for (let t = 0; t <= yTicks; t++) {
    const yy = padT + (t / yTicks) * (H - padT - padB);
    const valFlow = maxFlow - (rangeFlow * t / yTicks);
    const valAcum = maxAcum - (rangeAcum * t / yTicks);
    gridLines += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#E1DDD5" stroke-width="1"/>`;
    gridLines += `<text x="${padL - 10}" y="${yy + 4}" font-size="10" fill="#7A7876" text-anchor="end">${brl(valFlow)}</text>`;
    gridLines += `<text x="${W - padR + 10}" y="${yy + 4}" font-size="10" fill="${COR_ACUMULADO}" text-anchor="start">${brl(valAcum)}</text>`;
  }

  let breakEvenMarker = '', breakEvenLabel = '';
  if (r.breakEvenMonth) {
    const idx = r.breakEvenMonth - 1;
    const cx = x(idx), cy = yFlow(r.monthlyProfit[idx]);
    breakEvenMarker = `<circle cx="${cx}" cy="${cy}" r="5" fill="${COR_RECEITA}" stroke="#FDFDFD" stroke-width="2"/>`;
    breakEvenLabel = `<text x="${cx}" y="${cy - 10}" font-size="10" font-weight="700" fill="${COR_RECEITA}" text-anchor="middle">Breakeven</text>`;
  }
  let paybackMarker = '', paybackLabel = '';
  if (r.paybackMonth) {
    const idx = r.paybackMonth - 1;
    const cx = x(idx), cy = yAcum(acumulado[idx]);
    paybackMarker = `<circle cx="${cx}" cy="${cy}" r="5" fill="${COR_ACUMULADO}" stroke="#FDFDFD" stroke-width="2"/>`;
    paybackLabel = `<text x="${cx}" y="${cy + 18}" font-size="10" font-weight="700" fill="${COR_ACUMULADO}" text-anchor="middle">Payback</text>`;
  }

  host.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">
      ${gridLines}
      <line x1="${padL}" y1="${zeroYAcum}" x2="${W - padR}" y2="${zeroYAcum}" stroke="#7A7876" stroke-width="1" stroke-dasharray="4 3"/>
      <path d="${areaPath(acumulado, yAcum)}" fill="url(#${gradId})" opacity="0.16"/>
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${COR_ACUMULADO}"/>
          <stop offset="100%" stop-color="${COR_ACUMULADO}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polyline points="${line(flows.receita, yFlow)}" fill="none" stroke="${COR_RECEITA}" stroke-width="2.5"/>
      <polyline points="${line(flows.despesa, yFlow)}" fill="none" stroke="${COR_DESPESA}" stroke-width="2.5"/>
      <polyline points="${line(flows.lucro, yFlow)}" fill="none" stroke="${COR_LUCRO}" stroke-width="2" stroke-dasharray="5 4"/>
      <polyline points="${line(acumulado, yAcum)}" fill="none" stroke="${COR_ACUMULADO}" stroke-width="3.5"/>
      ${breakEvenMarker}${paybackMarker}
      ${breakEvenLabel}${paybackLabel}
      ${labels}
      <g class="cursor-group" style="display:none;">
        <line class="cursor-line" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="#7A7876" stroke-width="1" stroke-dasharray="3 3"/>
        <circle class="cursor-dot-receita" r="4" fill="${COR_RECEITA}" stroke="#FDFDFD" stroke-width="1.5"/>
        <circle class="cursor-dot-despesa" r="4" fill="${COR_DESPESA}" stroke="#FDFDFD" stroke-width="1.5"/>
        <circle class="cursor-dot-lucro" r="4" fill="${COR_LUCRO}" stroke="#FDFDFD" stroke-width="1.5"/>
        <circle class="cursor-dot-acumulado" r="5" fill="${COR_ACUMULADO}" stroke="#FDFDFD" stroke-width="1.5"/>
      </g>
      <rect class="chart-hover-rect" x="0" y="0" width="${W}" height="${H}" fill="transparent" style="cursor:crosshair;"/>
    </svg>
    <div class="chart-tooltip" id="tooltip-${hostId}"></div>
  `;

  const svgEl = host.querySelector('svg');
  const hoverRect = svgEl.querySelector('.chart-hover-rect');
  const cursorGroup = svgEl.querySelector('.cursor-group');
  const cursorLine = svgEl.querySelector('.cursor-line');
  const dotReceita = svgEl.querySelector('.cursor-dot-receita');
  const dotDespesa = svgEl.querySelector('.cursor-dot-despesa');
  const dotLucro = svgEl.querySelector('.cursor-dot-lucro');
  const dotAcumulado = svgEl.querySelector('.cursor-dot-acumulado');
  const tooltip = document.getElementById('tooltip-' + hostId);

  const monthLabel = idx => n <= 12 ? MESES[idx] : `Ano ${Math.floor(idx / 12) + 1} · ${MESES[idx % 12]}`;

  const handleMove = clientX => {
    const rect = svgEl.getBoundingClientRect();
    const scale = rect.width / W;
    const relX = (clientX - rect.left) / scale;
    let idx = Math.round((relX - padL) / (W - padL - padR) * (n - 1));
    idx = Math.max(0, Math.min(n - 1, idx));
    const px = x(idx);
    cursorLine.setAttribute('x1', px); cursorLine.setAttribute('x2', px);
    dotReceita.setAttribute('cx', px); dotReceita.setAttribute('cy', yFlow(flows.receita[idx]));
    dotDespesa.setAttribute('cx', px); dotDespesa.setAttribute('cy', yFlow(flows.despesa[idx]));
    dotLucro.setAttribute('cx', px); dotLucro.setAttribute('cy', yFlow(flows.lucro[idx]));
    dotAcumulado.setAttribute('cx', px); dotAcumulado.setAttribute('cy', yAcum(acumulado[idx]));
    cursorGroup.style.display = '';
    tooltip.innerHTML = `<b>${monthLabel(idx)}</b>Receita: ${brl(flows.receita[idx])}<br>Despesa: ${brl(flows.despesa[idx])}<br>Lucro: ${brl(flows.lucro[idx])}<br>Caixa acumulado: ${brl(acumulado[idx])}`;
    let leftPx = px * scale;
    leftPx = Math.max(55, Math.min(rect.width - 55, leftPx));
    tooltip.style.left = leftPx + 'px';
    tooltip.style.top = (padT * scale) + 'px';
    tooltip.classList.add('visible');
  };
  hoverRect.addEventListener('mousemove', e => handleMove(e.clientX));
  hoverRect.addEventListener('mouseleave', () => {
    cursorGroup.style.display = 'none';
    tooltip.classList.remove('visible');
  });

  const titleEl = document.getElementById(titleId);
  if (titleEl) titleEl.textContent = `${titlePrefix} ${periodoLabel(n)}`;

  const legendHost = document.getElementById(legendId);
  if (legendHost) {
    legendHost.innerHTML = `
      <span class="item"><span class="sw" style="border-color:${COR_RECEITA}"></span>Receita (mês)</span>
      <span class="item"><span class="sw" style="border-color:${COR_DESPESA}"></span>Despesa (mês)</span>
      <span class="item"><span class="sw dashed" style="border-color:${COR_LUCRO}"></span>Lucro (mês)</span>
      <span class="item"><span class="sw" style="border-color:${COR_ACUMULADO};border-top-width:4px;"></span>Caixa acumulado</span>
      <span class="item"><span class="sw dot" style="background:${COR_RECEITA}"></span>Breakeven<b>${r.breakEvenMonth ? `Mês ${r.breakEvenMonth}` : 'não atingido'}</b></span>
      <span class="item"><span class="sw dot" style="background:${COR_ACUMULADO}"></span>Payback<b>${r.paybackMonth ? `Mês ${r.paybackMonth}` : 'não atingido'}</b></span>
    `;
  }
}

// ---------- Render: DRE / Fluxo de Caixa Tables ----------
function signCls(v) { return v > 0 ? 'pos' : v < 0 ? 'neg' : ''; }
function dreDataRow(label, arr, opts) {
  const sum = a => a.reduce((x, y) => x + y, 0);
  opts = opts || {};
  const cell = (v, i) => {
    const cls = opts.colorize ? signCls(v) : '';
    const border = (opts.yearBoundaries && i % 12 === 0 && i > 0) ? ' style="border-left:2px solid var(--border);"' : '';
    return `<td class="${cls}"${border}>${brl(v)}</td>`;
  };
  const cls = opts.rowClass || 'data-row';
  const cells = arr.map((v, i) => cell(v, i)).join('');
  const total = opts.showTotal !== false ? `<td class="total-col ${opts.colorize ? signCls(sum(arr)) : ''}">${brl(sum(arr))}</td>` : '<td class="total-col"></td>';
  return `<tr class="${cls}"><td class="label">${label}</td>${cells}${total}</tr>`;
}
function dreGroupHead(label, colspan) {
  return `<tr class="group-head"><td class="label" colspan="${colspan || 14}">${label}</td></tr>`;
}
function dreTableHtml(rowsHtml, headers, totalLabel) {
  headers = headers || MESES;
  totalLabel = totalLabel || 'Total Ano 1';
  const headerCols = headers.map(m => `<th>${m}</th>`).join('');
  return `
    <table class="dre-table">
      <thead><tr><th class="label">R$</th>${headerCols}<th class="total-col">${totalLabel}</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

function dreRowsHtml(r) {
  const y1 = arr => arr.slice(0, 12);
  const dataRow = (label, arr, opts) => dreDataRow(label, y1(arr), opts);
  const groupHead = dreGroupHead;

  let html = '';
  html += groupHead('Honorários (competência)');
  html += dataRow('Tax', r.honorariosTax, { colorize: true });
  html += dataRow('Corporate', r.honorariosCorp, { colorize: true });
  html += dataRow('Total Honorários', r.honorariosTotal, { rowClass: 'total-row', colorize: true });

  html += groupHead('Faturamento (caixa)');
  html += dataRow('Tax', r.faturamentoTax, { colorize: true });
  html += dataRow('Corporate', r.faturamentoCorp, { colorize: true });
  html += dataRow('Total Faturamento', r.monthlyRevenue, { rowClass: 'total-row', colorize: true });

  html += groupHead('Despesas');
  html += dataRow('Impostos', r.impostos, { colorize: true });
  html += dataRow('Royalties', r.royalties, { colorize: true });
  html += dataRow('CRM', r.crm, { colorize: true });
  html += dataRow('Despesas Comerciais', r.comercial, { colorize: true });
  html += dataRow('Funcionários', r.funcionarios, { colorize: true });
  html += dataRow('Mídia', r.midia, { colorize: true });
  html += dataRow('Treinamento', r.treinamento, { colorize: true });
  html += dataRow('Contabilidade', r.contabilidade, { colorize: true });
  html += dataRow('Aquisição da franquia (entrada + parcelas)', r.financiamento, { colorize: true });
  html += dataRow('Despesas adicionais', r.outrasDespesas, { colorize: true });
  html += dataRow('Total Despesas', r.monthlyExpense, { rowClass: 'total-row', colorize: true });

  html += dataRow('Lucro', r.monthlyProfit, { rowClass: 'hero-row', colorize: true });
  html += dataRow('Fluxo de Caixa acumulado', r.cashFlow, { rowClass: 'hero-row', colorize: true, showTotal: false });
  return html;
}

function renderDRE(r) {
  document.getElementById('dreTable').innerHTML = dreTableHtml(dreRowsHtml(r));
}

function fluxoHeaderHtml(anos) {
  let yearRow = '<th class="label"></th>';
  for (let y = 0; y < anos; y++) {
    yearRow += `<th colspan="12" class="year-head"${y > 0 ? ' style="border-left:2px solid var(--border);"' : ''}>Ano ${y + 1}</th>`;
  }
  yearRow += '<th class="total-col"></th>';
  let monthRow = '<th class="label">R$</th>';
  for (let y = 0; y < anos; y++) {
    MESES.forEach((m, mi) => {
      monthRow += `<th${(y > 0 && mi === 0) ? ' style="border-left:2px solid var(--border);"' : ''}>${m}</th>`;
    });
  }
  monthRow += '<th class="total-col">Total Contrato</th>';
  return `<tr>${yearRow}</tr><tr>${monthRow}</tr>`;
}

function fluxoRowsHtml(r) {
  let html = '';
  html += dreDataRow('Faturamento', r.monthlyRevenue, { rowClass: 'total-row', colorize: true, yearBoundaries: true });
  html += dreDataRow('Despesas', r.monthlyExpense, { rowClass: 'total-row', colorize: true, yearBoundaries: true });
  html += dreDataRow('Lucro', r.monthlyProfit, { rowClass: 'hero-row', colorize: true, yearBoundaries: true });
  html += dreDataRow('Fluxo de Caixa acumulado', r.cashFlow, { rowClass: 'hero-row', colorize: true, showTotal: false, yearBoundaries: true });
  return html;
}

function renderFluxoTable(r) {
  document.getElementById('fluxoTable').innerHTML = `
    <table class="dre-table">
      <thead>${fluxoHeaderHtml(r.anos)}</thead>
      <tbody>${fluxoRowsHtml(r)}</tbody>
    </table>
  `;
}

// ---------- Print Report (export) ----------
function buildPrintReport(model, r) {
  const host = document.getElementById('printReport');
  const nome = document.getElementById('franqueadoNome').value.trim();
  const dataGeracao = new Date().toLocaleDateString('pt-BR');
  const logoSrc = document.querySelector('.hero img.logo').src;

  const contratosRows = PRODUCTS.filter(p => inputs[p.id] > 0)
    .map(p => `<tr><td>${p.nome}</td><td>${inputs[p.id]} contratos/ano</td></tr>`)
    .join('') || '<tr><td colspan="2">Nenhum contrato informado — simulação base.</td></tr>';

  const statsRows = statCardsData(model, r)
    .map(([label, value, cls]) => `<div class="p-stat"><div class="label">${label}</div><div class="value">${value}</div></div>`)
    .join('');

  const chartSvg = document.getElementById('chartHost').innerHTML;

  host.innerHTML = `
    <div class="p-header">
      <img src="${logoSrc}" alt="Grupo Studio">
      <div class="p-meta">
        Projeção Financeira de Franquia<br>
        Modelo: <strong>${model.nome}</strong><br>
        Data: ${dataGeracao}
      </div>
    </div>
    <h1>${nome ? nome : 'Anexo de Projeção Financeira'}</h1>
    <p style="color:#555;font-size:0.85rem;margin:0 0 6px;">Documento de apoio à assinatura do contrato de franquia Grupo Studio — modelo <strong>${model.nome}</strong>.</p>

    <h2>Condições do modelo</h2>
    <table>
      <tr><td>Investimento de aquisição</td><td>${brl(model.aquisicao)}</td></tr>
      <tr><td>Taxa de treinamento</td><td>${brl(r.treinamentoTotal)}</td></tr>
      <tr><td>Royalties mensais</td><td>${brl(model.royalties)}</td></tr>
      <tr><td>Prazo de contrato</td><td>${model.prazoTexto}</td></tr>
      <tr><td>Abrangência</td><td>${model.abrangencia}</td></tr>
      <tr><td>% Honorários Tax / Corporate</td><td>${model.faixaProgressiva ? `${pct(r.pctFaixaAtual)} (faixa progressiva)` : `${pct(model.pctTax)} / ${pct(model.pctCorporate)}`}</td></tr>
    </table>

    <h2>Contratos/ano informados na simulação</h2>
    <table>${contratosRows}</table>

    <h2>Resultado projetado — Ano 1 e vigência do contrato</h2>
    <div class="p-stat-grid">${statsRows}</div>

    <h2>Fluxo de caixa acumulado — Ano 1</h2>
    ${chartSvg}

    <h2>DRE Financeiro — Ano 1</h2>
    <div class="p-dre">${document.getElementById('dreTable').innerHTML}</div>

    <p class="p-disclaimer">
      Simulação ilustrativa baseada nas premissas do planejamento financeiro do franqueado Grupo Studio (ticket médio de honorários,
      taxas de aprovação, prazos de parcelamento e percentuais de repasse por modalidade). Os resultados não constituem garantia de
      retorno ou lucratividade — o desempenho real depende de variáveis de mercado e da gestão da unidade. Este documento deve ser
      lido em conjunto com o contrato de franquia e a Circular de Oferta de Franquia (COF).
    </p>

    <div class="p-sign">
      <div class="line">Assinatura do Franqueado<small>${nome || 'Nome completo'}</small></div>
      <div class="line">Assinatura Grupo Studio<small>Data: ${dataGeracao}</small></div>
    </div>
  `;
}

// ---------- Update Loop ----------
let lastModel = null;
let lastResult = null;

function update() {
  const model = MODELS.find(m => m.id === selectedModelId);
  const r = simulate(model);
  lastModel = model;
  lastResult = r;
  renderHeroStats(model, r);
  renderStats(model, r);
  renderFlowChart(r, { hostId: 'chartHost', legendId: 'chartLegendHost', titleId: 'chartTitle', titlePrefix: 'Fluxo de caixa acumulado' });
  renderFlowChart(r, { hostId: 'chartHostFluxo', legendId: 'chartLegendFluxo', titleId: 'chartTitleFluxo', titlePrefix: 'Receita, despesa, lucro e caixa acumulado' });
  renderDRE(r);
  renderFluxoTable(r);
  const finPlaceholder = document.getElementById('finValorVenda');
  if (finPlaceholder) finPlaceholder.placeholder = brl(model.aquisicao);
  const finParcelaValor = document.getElementById('finParcelaValor');
  if (finParcelaValor) {
    finParcelaValor.textContent = r.parcelasFin > 0
      ? `Valor da parcela: ${brl(r.installmentFin)} (${r.parcelasFin}x)`
      : `Sem parcelamento — ${brl(r.valorVenda)} à vista`;
  }
  const assSugestao = document.getElementById('assSugestao');
  if (assSugestao) {
    assSugestao.textContent = `Projeção: ${Math.round(r.contratosSugeridos)} contratos/ano (${Math.round(r.reunioesNecessarias)} reuniões necessárias)`;
  }
  const faixaResultado = document.getElementById('faixaResultado');
  if (faixaResultado) {
    faixaResultado.textContent = model.faixaProgressiva
      ? `% de honorários aplicado: ${pct(r.pctFaixaAtual)} (faixa progressiva)`
      : `${model.nome} usa % fixo — faixa progressiva só se aplica a GS Partner/GS Black`;
  }
}

document.getElementById('resetBtn').addEventListener('click', () => {
  PRODUCTS.forEach(p => inputs[p.id] = 0);
  renderFieldGroups();
  resetFinancingInputs();
  resetAssessmentInputs();
  resetCustomExpenses();
  resetFaixaInput();
  resetParticipantesInput();
  update();
});

document.getElementById('exportBtn').addEventListener('click', () => {
  buildPrintReport(lastModel, lastResult);
  window.print();
});

// ---------- Tabs ----------
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

document.getElementById('addExpenseBtn').addEventListener('click', addCustomExpense);

renderModelCards();
renderPremissas();
renderModelPills();
renderFieldGroups();
bindFinancingInputs();
bindAssessmentInputs();
bindFaixaInput();
bindParticipantesInput();
renderCustomExpenses();
initTabs();
update();
