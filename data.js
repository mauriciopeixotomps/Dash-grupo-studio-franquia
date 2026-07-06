// Dados extraídos de "Planejamento Financeiro - Franqueado" (Google Sheets)
// Abas: Modelos de Franquia, Premissas, DRE Financeiro, Fluxo de Caixa

const MODELS = [
  {
    id: 'TAX',
    nome: 'TAX',
    aquisicao: 35000,
    royalties: 1500,
    crm: 532.11,
    treinamento: 2350,
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
    crm: 532.11,
    treinamento: 2350,
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
    crm: 532.11,
    treinamento: 2350,
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
    crm: 532.11,
    treinamento: 2350,
    anos: 10,
    prazoTexto: '10 anos',
    abrangencia: 'Nacional',
    pctTax: 0.50,
    pctCorporate: 0.50,
    podeVenderFranquia: false,
    estrutura: 'Cria sua rede de partners',
    consultasPJ: 200,
    midiaMensal: 5000,
    equipeDedicada: true,
    nota: 'Honorários entre 35% e 50%, conforme faixa de faturamento do cliente.',
  },
  {
    id: 'FLAGSHIP',
    nome: 'Flagship',
    aquisicao: 250000,
    royalties: 13333,
    crm: 532.11,
    treinamento: 2350,
    anos: 10,
    prazoTexto: '10 anos',
    abrangencia: 'Nacional',
    pctTax: 0.50,
    pctCorporate: 0.50,
    podeVenderFranquia: true,
    estrutura: 'Cria sua rede de partners e franqueados',
    consultasPJ: 200,
    midiaMensal: 10000,
    equipeDedicada: true,
  },
];

// tkm = ticket médio de honorário por contrato (Total de Créditos x % Honorários)
// aprovacao = taxa de aprovação/êxito aplicada sobre o tkm (aba Operação)
// tempo = meses até a 1ª parcela | parcelas = número de parcelas
const PRODUCTS = [
  { id: 'credadm', nome: 'Créditos Administrativos', grupo: 'tax', tkm: 63550.30, aprovacao: 0.85, tempo: 4, parcelas: 6 },
  { id: 'pontos', nome: 'Pontos Qualificados', grupo: 'tax', tkm: 358897.56, aprovacao: 0.35, tempo: 4, parcelas: 24 },
  { id: 'prev', nome: 'Previdenciário Qualif.', grupo: 'tax', tkm: 184999.28, aprovacao: 0.35, tempo: 2, parcelas: 6 },
  { id: 'reforma', nome: 'Reforma Tributária', grupo: 'tax', tkm: 120000, aprovacao: 1.0, tempo: 1, parcelas: 6 },

  { id: 'holding', nome: 'Holding', grupo: 'corporate', tkm: 70000, aprovacao: 1.0, tempo: 1, parcelas: 10 },
  { id: 'itbi', nome: 'ITBI', grupo: 'corporate', tkm: 45000, aprovacao: 1.0, tempo: 9, parcelas: 10 },
  { id: 'energy', nome: 'Energy', grupo: 'corporate', tkm: 108000, aprovacao: 1.0, tempo: 6, parcelas: 36 },
  { id: 'valuation', nome: 'Valuation', grupo: 'corporate', tkm: 50000, aprovacao: 1.0, tempo: 1, parcelas: 4 },
  { id: 'contabilidade', nome: 'Contabilidade', grupo: 'corporate', tkm: 24000, aprovacao: 1.0, tempo: 1, parcelas: 12 },
  { id: 'transinicial', nome: 'Transação Inicial', grupo: 'corporate', tkm: 35000, aprovacao: 1.0, tempo: 1, parcelas: 5 },
  { id: 'transexito', nome: 'Transação Êxito', grupo: 'corporate', tkm: 294000, aprovacao: 1.0, tempo: 10, parcelas: 24 },
  { id: 'captacao', nome: 'Captação de Recursos', grupo: 'corporate', tkm: 45000, aprovacao: 1.0, tempo: 3, parcelas: 1 },
  { id: 'juridico', nome: 'Jurídico', grupo: 'corporate', tkm: 100000, aprovacao: 1.0, tempo: 10, parcelas: 12 },
];

// custo fixo mensal de contabilidade da própria unidade (não confundir com o produto "Contabilidade")
const CUSTO_CONTABILIDADE_MENSAL = 350;
const CUSTO_FUNCIONARIO_MENSAL = 7000;
const IMPOSTOS_PCT = 0.065;
const CUSTO_POR_REUNIAO = 40;
const REUNIOES_POR_CONTRATO = 20;
