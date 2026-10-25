const fs = require('fs');
const { getDataFilePath } = require('../utils/paths');

const DATA_FILE = getDataFilePath('fluxos.json');

function loadFlows() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (Array.isArray(data)) return data;
    return data && Array.isArray(data.flows) ? data.flows : [];
  } catch (error) {
    console.error('[Config] Erro ao carregar ou parsear fluxos.json:', error);
    return [];
  }
}

function saveFlows(flows) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ flows }, null, 2));
}

function matchFluxo(fluxo, mensagem) {
  const gatilho = fluxo.trigger.toLowerCase();
  const recebido = mensagem.toLowerCase();
  const tipo = fluxo.matchType || 'equals';
  
  const resultado = tipo === 'equals'
  ? recebido === gatilho
  : gatilho.includes(recebido) || recebido.includes(gatilho);
  
  console.log(`[MATCH] tipo: ${tipo}, gatilho: "${gatilho}", recebido: "${recebido}", bateu: ${resultado}`);
  
  return resultado;
}

module.exports = {
  loadFlows,
  saveFlows,
  matchFluxo
};
