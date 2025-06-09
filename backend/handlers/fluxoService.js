const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data', 'fluxos.json');

function loadFlows() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).flows;
}

function saveFlows(flows) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ flows }, null, 2));
}

function matchFluxo(fluxo, mensagem) {
  const gatilho = fluxo.trigger.toLowerCase();
  const recebido = mensagem.toLowerCase();
  const tipo = fluxo.matchType || 'equals';
  return tipo === 'equals' ? recebido === gatilho : recebido.includes(gatilho);
}

module.exports = {
  loadFlows,
  saveFlows,
  matchFluxo
};
