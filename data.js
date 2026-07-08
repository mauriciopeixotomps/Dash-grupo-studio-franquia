// Dados extraídos de "Planejamento Financeiro - Franqueado" (Google Sheets)
// Abas: Modelos de Franquia, Premissas, DRE Financeiro, Fluxo de Caixa

const MODELS = [
  {
    id: 'TAX',
    nome: 'TAX',
    aquisicao: 35000,
    royalties: 1500,
    crm: 531.56,
    treinamento: 3250,
    anos: 3,
    prazoTexto: '3 anos',
    abrangencia: 'Estadual',
    pctTax: 0.35,
    pctCorporate: 0.10,
    podeVenderFranquia: false,
    estrutura: 'Autônomo, podendo criar equipe interna',
    consultasPJ: 50,
    midiaMensal: 0,
    equipeDedicada: false,
  },
  {
    id: 'PLATINUM',
    nome: 'PLATINUM',
    aquisicao: 50000,
    royalties: 1500,
    crm: 531.56,
    treinamento: 3250,
    anos: 5,
    prazoTexto: '5 anos',
    abrangencia: 'Regional',
    pctTax: 0.35,
    pctCorporate: 0.35,
    podeVenderFranquia: false,
    estrutura: 'Autônomo, podendo criar equipe interna',
    consultasPJ: 50,
    midiaMensal: 0,
    equipeDedicada: false,
  },
  {
    id: 'CORPORATE',
    nome: 'CORPORATE',
    aquisicao: 90000,
    royalties: 1500,
    crm: 531.56,
    treinamento: 3250,
    anos: 10,
    prazoTexto: '10 anos',
    abrangencia: 'Nacional',
    pctTax: 0.35,
    pctCorporate: 0.35,
    podeVenderFranquia: false,
    estrutura: 'Autônomo, podendo criar equipe interna',
    consultasPJ: 50,
    midiaMensal: 0,
    equipeDedicada: false,
  },
  {
    id: 'GS_PARTNER',
    nome: 'GS Partner',
    aquisicao: 120000,
    royalties: 1500,
    crm: 531.56,
    treinamento: 3250,
    anos: 10,
    prazoTexto: '10 anos',
    abrangencia: 'Nacional',
    // % de honorários é progressivo (35%-60%) conforme a FAIXA_GANHOS abaixo, aplicado sobre a
    // faixa de faturamento médio anual (últimos 5 anos) do cliente — pctTax/pctCorporate aqui
    // servem só de valor de referência/fallback, simulate() usa faixaProgressiva:true para ignorá-los.
    pctTax: 0.50,
    pctCorporate: 0.50,
    faixaProgressiva: true,
    podeVenderFranquia: false,
    estrutura: 'Modelo com rede — pode criar rede de Partners',
    consultasPJ: 200,
    midiaMensal: 3000,
    equipeDedicada: true,
    nota: 'Honorários de 35% a 60%, conforme a faixa de faturamento médio (últimos 5 anos) do cliente. Investimento obrigatório em mídia de R$3.000/mês.',
  },
  {
    id: 'GS_BLACK',
    nome: 'GS Black',
    aquisicao: 200000,
    royalties: 1500,
    crm: 531.56,
    treinamento: 3250,
    anos: 10,
    prazoTexto: '10 anos',
    abrangencia: 'Nacional',
    pctTax: 0.50,
    pctCorporate: 0.50,
    faixaProgressiva: true,
    podeVenderFranquia: false,
    estrutura: 'Modelo autônomo — não cria rede de Partners, atua diretamente na prospecção e fechamento',
    consultasPJ: 200,
    midiaMensal: 0,
    equipeDedicada: false,
    nota: 'Honorários de 35% a 60%, conforme a faixa de faturamento médio (últimos 5 anos) do cliente. Remuneração variável conforme performance individual da unidade.',
  },
];

// totalCreditos = base de créditos/faturamento do cliente (aba Premissas, seção Operação)
// pctHonorarios = % Honorários sobre o total de créditos -> totalCreditos x pctHonorarios = tkm
// tkm = ticket médio de honorário por contrato
// aprovacao = taxa de êxito aplicada sobre o tkm (aba Operação, seção "Honorários por Produto")
// tempo = meses até a 1ª parcela | parcelas = número de parcelas
const PRODUCTS = [
  { id: 'credadm', nome: 'Créditos Administrativos', grupo: 'tax', totalCreditos: 353057.20, pctHonorarios: 0.18, tkm: 63550.30, aprovacao: 0.85, tempo: 4, parcelas: 6 },
  { id: 'pontos', nome: 'Pontos Qualificados', grupo: 'tax', totalCreditos: 1993875.31, pctHonorarios: 0.18, tkm: 358897.56, aprovacao: 0.35, tempo: 4, parcelas: 24 },
  { id: 'prev', nome: 'Previdenciário Qualif.', grupo: 'tax', totalCreditos: 1027773.76, pctHonorarios: 0.18, tkm: 184999.28, aprovacao: 0.35, tempo: 2, parcelas: 6 },
  { id: 'reforma', nome: 'Reforma Tributária', grupo: 'tax', totalCreditos: 120000, pctHonorarios: 1.0, tkm: 120000, aprovacao: 1.0, tempo: 1, parcelas: 6 },

  { id: 'holding', nome: 'Holding', grupo: 'corporate', totalCreditos: 70000, pctHonorarios: 1.0, tkm: 70000, aprovacao: 1.0, tempo: 1, parcelas: 10 },
  { id: 'itbi', nome: 'ITBI', grupo: 'corporate', totalCreditos: 150000, pctHonorarios: 0.30, tkm: 45000, aprovacao: 1.0, tempo: 9, parcelas: 10 },
  { id: 'energy', nome: 'Energy', grupo: 'corporate', totalCreditos: 108000, pctHonorarios: 1.0, tkm: 108000, aprovacao: 1.0, tempo: 6, parcelas: 36 },
  { id: 'valuation', nome: 'Valuation', grupo: 'corporate', totalCreditos: 50000, pctHonorarios: 1.0, tkm: 50000, aprovacao: 1.0, tempo: 1, parcelas: 4 },
  { id: 'contabilidade', nome: 'Contabilidade', grupo: 'corporate', totalCreditos: 24000, pctHonorarios: 1.0, tkm: 24000, aprovacao: 1.0, tempo: 1, parcelas: 12 },
  { id: 'transinicial', nome: 'Transação Inicial', grupo: 'corporate', totalCreditos: 35000, pctHonorarios: 1.0, tkm: 35000, aprovacao: 1.0, tempo: 1, parcelas: 5 },
  { id: 'transexito', nome: 'Transação Êxito', grupo: 'corporate', totalCreditos: 1633333.33, pctHonorarios: 0.18, tkm: 294000, aprovacao: 1.0, tempo: 10, parcelas: 24 },
  { id: 'captacao', nome: 'Captação de Recursos', grupo: 'corporate', totalCreditos: 1500000, pctHonorarios: 0.03, tkm: 45000, aprovacao: 1.0, tempo: 3, parcelas: 1 },
  { id: 'juridico', nome: 'Jurídico', grupo: 'corporate', totalCreditos: 500000, pctHonorarios: 0.20, tkm: 100000, aprovacao: 1.0, tempo: 10, parcelas: 12 },
];

// custo fixo mensal de contabilidade da própria unidade (não confundir com o produto "Contabilidade")
const CUSTO_CONTABILIDADE_MENSAL = 350;
const CUSTO_FUNCIONARIO_MENSAL = 7000;
const IMPOSTOS_PCT = 0.065;
const CUSTO_POR_REUNIAO = 40;
const REUNIOES_POR_CONTRATO = 20;

// Taxa de treinamento (aba "Política Comercial 2026") é cobrada por participante: o valor em
// model.treinamento já cobre o(s) participante(s) inclusos; cada participante ADICIONAL soma este valor.
const CUSTO_PARTICIPANTE_ADICIONAL = 1500;

// Tabela de ganhos progressiva (GS Partner / GS Black): % de honorários conforme o faturamento
// médio anual do cliente nos últimos 5 anos — "Política Comercial 2026".
const FAIXA_GANHOS = [
  { ate: 50_000_000, pct: 0.35 },
  { ate: 100_000_000, pct: 0.40 },
  { ate: 200_000_000, pct: 0.45 },
  { ate: 500_000_000, pct: 0.50 },
  { ate: 1_000_000_000, pct: 0.55 },
  { ate: Infinity, pct: 0.60 },
];
