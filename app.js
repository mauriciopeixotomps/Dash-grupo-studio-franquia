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
  const groupHead = label => `<tr class="group-head"><td class="name" colspan="5">${label}</td></tr>`;
  const row = p => `
    <tr>
      <td class="name">${p.nome}</td>
      <td><div class="tkm-wrap"><div class="tkm-bar" style="width:${(p.tkm / maxTkm) * 100}%"></div><span class="tkm-val">${brl(p.tkm)}</span></div></td>
      <td>${pct(p.aprovacao)}</td>
      <td>${p.tempo}º mês</td>
      <td>${p.parcelas}x</td>
    </tr>`;

  let html = `
    <table class="premissas-table">
      <thead>
        <tr>
          <th class="name">Produto</th>
          <th>Ticket médio (TKM)</th>
          <th>Taxa de aprovação</th>
          <th>1ª parcela</th>
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
  const months = 12;
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

    monthlyExpense[m] = impostos[m] + royalties[m] + crm[m] + comercial[m] + funcionarios[m] + midia[m] + treinamento[m] + contabilidade[m];
    monthlyProfit[m] = monthlyRevenue[m] + monthlyExpense[m];
    cashFlow[m] = (m === 0 ? -model.aquisicao : cashFlow[m - 1]) + monthlyProfit[m];
  }

  const faturamentoAno1 = monthlyRevenue.reduce((a, b) => a + b, 0);
  const despesasAno1 = monthlyExpense.reduce((a, b) => a + b, 0);
  const lucroAno1 = faturamentoAno1 + despesasAno1;

  const faturamentoTotal = faturamentoAno1 * model.anos;
  const despesasTotal = (model.anos * despesasAno1) - model.aquisicao - model.treinamento;
  const lucroFinal = faturamentoTotal + despesasTotal;
  const roi = model.aquisicao > 0 ? lucroFinal / model.aquisicao : 0;
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
    impostos, royalties, crm, comercial, funcionarios, midia, treinamento, contabilidade,
    monthlyExpense, monthlyProfit, cashFlow,
    faturamentoAno1, despesasAno1, lucroAno1, lucroFinal, roi, lucratividade,
    capitalGiro, breakEvenMonth, paybackMonth,
    investimentoInicial: model.aquisicao + model.treinamento,
  };
}

// ---------- Render: Stats ----------
function statCardsData(model, r) {
  return [
    ['Investimento inicial', brl(-r.investimentoInicial), 'neu', 'Taxa de aquisição + treinamento'],
    ['Faturamento Ano 1', brl(r.faturamentoAno1), 'pos', 'Honorários recebidos (base caixa)'],
    ['Despesas Ano 1', brl(r.despesasAno1), 'neg', 'Royalties, CRM, impostos, comercial'],
    ['Lucro Ano 1', brl(r.lucroAno1), r.lucroAno1 >= 0 ? 'pos' : 'neg', 'Faturamento − despesas'],
    ['Capital de giro necessário', brl(r.capitalGiro), 'neg', 'Soma dos meses deficitários'],
    ['Breakeven', r.breakEvenMonth ? `Mês ${r.breakEvenMonth}` : 'Não atingido no Ano 1', r.breakEvenMonth ? 'pos' : 'neg', 'Lucro mensal fica positivo'],
    ['Payback', r.paybackMonth ? `Mês ${r.paybackMonth}` : 'Sem payback no Ano 1', r.paybackMonth ? 'pos' : 'neg', 'Caixa acumulado recupera o investimento'],
    ['ROI', `${r.roi.toFixed(1)}x`, r.roi >= 0 ? 'pos' : 'neg', `Sobre o contrato de ${model.anos} anos`],
    ['Lucratividade', pct(r.lucratividade), r.lucratividade >= 0 ? 'pos' : 'neg', 'Lucro / Faturamento — Ano 1'],
    ['Lucro final do contrato', brl(r.lucroFinal), r.lucroFinal >= 0 ? 'pos' : 'neg', `Projeção para ${model.anos} anos`],
  ];
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

function renderChart(r, hostId) {
  const host = document.getElementById(hostId || 'chartHost');
  const gradId = 'grad-' + (hostId || 'chartHost');
  const W = 900, H = 300, padL = 70, padR = 20, padT = 20, padB = 34;
  const values = r.cashFlow;
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = (max - min) || 1;
  const x = i => padL + (i / (values.length - 1)) * (W - padL - padR);
  const y = v => padT + (1 - (v - min) / range) * (H - padT - padB);

  const zeroY = y(0);
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  let breakEvenMarker = '';
  if (r.breakEvenMonth) {
    const idx = r.breakEvenMonth - 1;
    breakEvenMarker = `<circle cx="${x(idx)}" cy="${y(values[idx])}" r="5" fill="#927245" stroke="#FDFDFD" stroke-width="2"/>`;
  }

  let gridLines = '';
  let labels = '';
  for (let i = 0; i < values.length; i++) {
    labels += `<text x="${x(i)}" y="${H - 12}" font-size="11" fill="#7A7876" text-anchor="middle">${MESES[i]}</text>`;
  }
  const yTicks = 4;
  for (let t = 0; t <= yTicks; t++) {
    const val = min + (range * t / yTicks);
    const yy = y(val);
    gridLines += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#E1DDD5" stroke-width="1"/>`;
    gridLines += `<text x="${padL - 10}" y="${yy + 4}" font-size="10" fill="#7A7876" text-anchor="end">${brl(val)}</text>`;
  }

  const areaPath = `M${x(0)},${zeroY} ` + values.map((v, i) => `L${x(i)},${y(v)}`).join(' ') + ` L${x(values.length - 1)},${zeroY} Z`;

  host.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">
      ${gridLines}
      <line x1="${padL}" y1="${zeroY}" x2="${W - padR}" y2="${zeroY}" stroke="#7A7876" stroke-width="1" stroke-dasharray="4 3"/>
      <path d="${areaPath}" fill="url(#${gradId})" opacity="0.20"/>
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#927245"/>
          <stop offset="100%" stop-color="#927245" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polyline points="${points}" fill="none" stroke="#927245" stroke-width="2.5"/>
      ${breakEvenMarker}
      ${labels}
    </svg>
  `;
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
function dreGroupHead(label) {
  return `<tr class="group-head"><td class="label" colspan="14">${label}</td></tr>`;
}
function dreTableHtml(rowsHtml) {
  const headerCols = MESES.map(m => `<th>${m}</th>`).join('');
  return `
    <table class="dre-table">
      <thead><tr><th class="label">R$</th>${headerCols}<th class="total-col">Total Ano 1</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

function dreRowsHtml(r) {
  const dataRow = dreDataRow;
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
  html += dataRow('Total Despesas', r.monthlyExpense, { rowClass: 'total-row' });

  html += dataRow('Lucro', r.monthlyProfit, { rowClass: 'hero-row', colorize: true });
  html += dataRow('Fluxo de Caixa acumulado', r.cashFlow, { rowClass: 'hero-row', colorize: true, showTotal: false });
  return html;
}

function renderDRE(r) {
  document.getElementById('dreTable').innerHTML = dreTableHtml(dreRowsHtml(r));
}

function fluxoRowsHtml(r) {
  let html = '';
  html += dreDataRow('Faturamento', r.monthlyRevenue, { rowClass: 'total-row' });
  html += dreDataRow('Despesas', r.monthlyExpense, { rowClass: 'total-row' });
  html += dreDataRow('Lucro', r.monthlyProfit, { rowClass: 'hero-row', colorize: true });
  html += dreDataRow('Fluxo de Caixa acumulado', r.cashFlow, { rowClass: 'hero-row', colorize: true, showTotal: false });
  return html;
}

function renderFluxoTable(r) {
  document.getElementById('fluxoTable').innerHTML = dreTableHtml(fluxoRowsHtml(r));
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
  renderStats(model, r);
  renderChart(r, 'chartHost');
  renderChart(r, 'chartHostFluxo');
  renderDRE(r);
  renderFluxoTable(r);
}

document.getElementById('resetBtn').addEventListener('click', () => {
  PRODUCTS.forEach(p => inputs[p.id] = 0);
  renderFieldGroups();
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
initTabs();
update();
