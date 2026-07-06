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
    const card = el('div', 'model-card' + (m.id === 'FLAGSHIP' ? ' flagship' : ''));
    if (m.id === 'FLAGSHIP') card.appendChild(el('span', 'badge', 'Topo de linha'));
    card.appendChild(el('h3', null, m.nome));
    card.appendChild(el('div', 'price', `${brl(m.aquisicao)}<small>investimento de aquisição</small>`));
    const dl = el('dl');
    const rows = [
      ['Royalties/mês', brl(m.royalties)],
      ['Prazo de contrato', m.prazoTexto],
      ['Abrangência', m.abrangencia],
      ['% Honorários Tax', pct(m.pctTax)],
      ['% Honorários Corporate', pct(m.pctCorporate)],
      ['Mídia/mês', m.midiaMensal ? brl(m.midiaMensal) : '—'],
      ['Equipe dedicada', m.equipeDedicada ? '<span class="tag-yes">Sim</span>' : '<span class="tag-no">Não</span>'],
      ['Pode vender franquia', m.podeVenderFranquia ? '<span class="tag-yes">Sim</span>' : '<span class="tag-no">Não</span>'],
    ];
    rows.forEach(([k, v]) => {
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

  PRODUCTS.forEach(p => {
    const contractsYear = inputs[p.id] || 0;
    const monthlyContracts = contractsYear / 12;
    const feePerContract = p.tkm * p.aprovacao * (p.grupo === 'tax' ? model.pctTax : model.pctCorporate);
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
  const funcionariosMensal = model.equipeDedicada ? CUSTO_FUNCIONARIO_MENSAL : 0;

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
    treinamento[m] = m === 0 ? -model.treinamento : 0;
    contabilidade[m] = -CUSTO_CONTABILIDADE_MENSAL;

    monthlyExpense[m] = impostos[m] + royalties[m] + crm[m] + comercial[m] + funcionarios[m] + midia[m] + treinamento[m] + contabilidade[m] + financiamento[m];
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

  const capitalGiro = monthlyProfit.filter(v => v < 0).reduce((a, b) => a + b, 0);

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
    impostos, royalties, crm, comercial, funcionarios, midia, treinamento, contabilidade, financiamento,
    monthlyExpense, monthlyProfit, cashFlow,
    faturamentoAno1, despesasAno1, lucroAno1, lucroFinal, roi, lucratividade,
    capitalGiro, breakEvenMonth, paybackMonth,
    valorVenda, entradaFin, parcelasFin, installmentFin, jurosFin, custoTotalAquisicao,
    investimentoInicial: entradaFin + model.treinamento,
    anos: model.anos,
  };
}

// ---------- Render: Stats ----------
function statCardsData(model, r) {
  const financiamentoDesc = r.parcelasFin > 0
    ? `Entrada ${brl(r.entradaFin)} + ${r.parcelasFin}x ${brl(r.installmentFin)}${r.jurosFin > 0 ? ` (juros de ${(r.jurosFin * 100).toFixed(1)}% a.m.)` : ''} — custo total ${brl(r.custoTotalAquisicao)}`
    : `${brl(r.valorVenda)} pago à vista no fechamento`;
  return [
    ['Investimento inicial', brl(-r.investimentoInicial), 'neu', 'Taxa de aquisição + treinamento'],
    ['Aquisição da franquia', brl(-r.custoTotalAquisicao), 'neu', financiamentoDesc],
    ['Faturamento Ano 1', brl(r.faturamentoAno1), 'pos', 'Honorários recebidos (base caixa)'],
    ['Despesas Ano 1', brl(r.despesasAno1), 'neg', 'Royalties, CRM, impostos, comercial'],
    ['Lucro Ano 1', brl(r.lucroAno1), r.lucroAno1 >= 0 ? 'pos' : 'neg', 'Faturamento − despesas'],
    ['Capital de giro necessário', brl(r.capitalGiro), 'neg', 'Soma dos meses deficitários'],
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
    </svg>
  `;

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
function dreDataRow(label, arr, opts) {
  const sum = a => a.reduce((x, y) => x + y, 0);
  const cell = (v, cls) => `<td class="${cls || ''}">${brl(v)}</td>`;
  opts = opts || {};
  const cls = opts.rowClass || '';
  const cells = arr.map(v => cell(v, opts.colorize ? (v >= 0 ? 'pos' : 'neg') : '')).join('');
  const total = opts.showTotal !== false ? `<td class="total-col ${opts.colorize ? (sum(arr) >= 0 ? 'pos' : 'neg') : ''}">${brl(sum(arr))}</td>` : '<td class="total-col"></td>';
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
  html += dataRow('Tax', r.honorariosTax);
  html += dataRow('Corporate', r.honorariosCorp);
  html += dataRow('Total Honorários', r.honorariosTotal, { rowClass: 'total-row' });

  html += groupHead('Faturamento (caixa)');
  html += dataRow('Tax', r.faturamentoTax);
  html += dataRow('Corporate', r.faturamentoCorp);
  html += dataRow('Total Faturamento', r.monthlyRevenue, { rowClass: 'total-row' });

  html += groupHead('Despesas');
  html += dataRow('Impostos', r.impostos);
  html += dataRow('Royalties', r.royalties);
  html += dataRow('CRM', r.crm);
  html += dataRow('Despesas Comerciais', r.comercial);
  html += dataRow('Funcionários', r.funcionarios);
  html += dataRow('Mídia', r.midia);
  html += dataRow('Treinamento', r.treinamento);
  html += dataRow('Contabilidade', r.contabilidade);
  html += dataRow('Aquisição da franquia (entrada + parcelas)', r.financiamento);
  html += dataRow('Total Despesas', r.monthlyExpense, { rowClass: 'total-row' });

  html += dataRow('Lucro', r.monthlyProfit, { rowClass: 'hero-row', colorize: true });
  html += dataRow('Fluxo de Caixa acumulado', r.cashFlow, { rowClass: 'hero-row', colorize: true, showTotal: false });
  return html;
}

function renderDRE(r) {
  document.getElementById('dreTable').innerHTML = dreTableHtml(dreRowsHtml(r));
}

// Agrega os meses em totais por ano (Ano 1..Ano N) para caber o contrato inteiro (3 a 10 anos) na tabela
function yearlyTotals(arr, anos) {
  const out = [];
  for (let y = 0; y < anos; y++) out.push(arr.slice(y * 12, y * 12 + 12).reduce((a, b) => a + b, 0));
  return out;
}
function yearlyEndValues(arr, anos) {
  const out = [];
  for (let y = 0; y < anos; y++) out.push(arr[y * 12 + 11]);
  return out;
}

function fluxoRowsHtml(r) {
  const anos = r.anos;
  let html = '';
  html += dreDataRow('Faturamento', yearlyTotals(r.monthlyRevenue, anos), { rowClass: 'total-row' });
  html += dreDataRow('Despesas', yearlyTotals(r.monthlyExpense, anos), { rowClass: 'total-row' });
  html += dreDataRow('Lucro', yearlyTotals(r.monthlyProfit, anos), { rowClass: 'hero-row', colorize: true });
  html += dreDataRow('Fluxo de Caixa acumulado (final do ano)', yearlyEndValues(r.cashFlow, anos), { rowClass: 'hero-row', colorize: true, showTotal: false });
  return html;
}

function renderFluxoTable(r) {
  const headers = Array.from({ length: r.anos }, (_, i) => `Ano ${i + 1}`);
  document.getElementById('fluxoTable').innerHTML = dreTableHtml(fluxoRowsHtml(r), headers, 'Total Contrato');
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
      <tr><td>Taxa de treinamento</td><td>${brl(model.treinamento)}</td></tr>
      <tr><td>Royalties mensais</td><td>${brl(model.royalties)}</td></tr>
      <tr><td>Prazo de contrato</td><td>${model.prazoTexto}</td></tr>
      <tr><td>Abrangência</td><td>${model.abrangencia}</td></tr>
      <tr><td>% Honorários Tax / Corporate</td><td>${pct(model.pctTax)} / ${pct(model.pctCorporate)}</td></tr>
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
}

document.getElementById('resetBtn').addEventListener('click', () => {
  PRODUCTS.forEach(p => inputs[p.id] = 0);
  renderFieldGroups();
  resetFinancingInputs();
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

renderModelCards();
renderPremissas();
renderModelPills();
renderFieldGroups();
bindFinancingInputs();
initTabs();
update();
