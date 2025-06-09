const fs = require('fs');
const path = require('path');

const RESPONDIDAS_FILE = path.join(__dirname, '../data', 'respondidas.json');

if (!fs.existsSync(RESPONDIDAS_FILE)) {
  fs.writeFileSync(RESPONDIDAS_FILE, JSON.stringify({ historico: [] }, null, 2));
}

function loadRespondidas() {
  return JSON.parse(fs.readFileSync(RESPONDIDAS_FILE, 'utf8')).historico;
}

function saveRespondidas(historico) {
  fs.writeFileSync(RESPONDIDAS_FILE, JSON.stringify({ historico }, null, 2));
}

function jaRespondeuRecentemente(remetente, trigger, tempoExpiracaoMs) {
  const historico = loadRespondidas();
  const chave = `${remetente}-${trigger}`;
  const item = historico.find(entry => entry.chave === chave);
  if (!item) return false;
  return (Date.now() - item.timestamp) < tempoExpiracaoMs;
}

function registrarResposta(remetente, trigger) {
  const historico = loadRespondidas();
  const chave = `${remetente}-${trigger}`;
  const index = historico.findIndex(entry => entry.chave === chave);
  if (index !== -1) historico.splice(index, 1);
  historico.push({ chave, timestamp: Date.now() });
  saveRespondidas(historico);
}

function limparHistoricoExpirado(tempoExpiracaoMs) {
  const historico = loadRespondidas();
  const agora = Date.now();
  const filtrado = historico.filter(entry => (agora - entry.timestamp) < tempoExpiracaoMs * 3);
  if (filtrado.length !== historico.length) {
    saveRespondidas(filtrado);
    console.log(`🧹 Limpeza: histórico reduzido para ${filtrado.length} itens.`);
  }
}

module.exports = {
  loadRespondidas,
  saveRespondidas,
  jaRespondeuRecentemente,
  registrarResposta,
  limparHistoricoExpirado
};
