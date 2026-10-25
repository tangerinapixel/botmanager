// backend/handlers/saudacaoService.js (VERSÃO FINAL E CORRIGIDA)
const fs = require('fs');
const { getDataFilePath } = require('../utils/paths');

// --- CONSTANTES DE CAMINHO ---
// Define os caminhos dos arquivos de forma clara no topo
const GREETINGS_MESSAGES_PATH = getDataFilePath('greetings.json');
const GREETINGS_HISTORY_PATH = getDataFilePath('sent_greetings.json');


// --- FUNÇÕES DE GERENCIAMENTO DAS MENSAGENS (O QUE DIZER) ---

function loadGreetings() {
    try {
        if (!fs.existsSync(GREETINGS_MESSAGES_PATH)) return [];
        const data = fs.readFileSync(GREETINGS_MESSAGES_PATH, 'utf8');
        // A estrutura do seu JSON de saudações pode ser um array direto
        // ou um objeto {greetings: []}. Este código suporta ambos.
        const jsonData = JSON.parse(data);
        return Array.isArray(jsonData) ? jsonData : jsonData.greetings || [];
    } catch {
        return [];
    }
}

function saveGreetings(greetings) {
    // Salva sempre em um formato consistente para facilitar a leitura
    fs.writeFileSync(GREETINGS_MESSAGES_PATH, JSON.stringify(greetings, null, 2));
}


// --- FUNÇÕES DE GERENCIAMENTO DO HISTÓRICO (PARA QUEM JÁ DISSE) ---

function loadGreetingHistory() {
    try {
        if (!fs.existsSync(GREETINGS_HISTORY_PATH)) return new Set();
        const data = fs.readFileSync(GREETINGS_HISTORY_PATH, 'utf8');
        return new Set(JSON.parse(data));
    } catch {
        return new Set();
    }
}

function saveToGreetingHistory(remetente) {
    const history = loadGreetingHistory();
    history.add(remetente);
    fs.writeFileSync(GREETINGS_HISTORY_PATH, JSON.stringify([...history], null, 2));
}

function limparHistoricoSaudacao() {
    try {
        fs.writeFileSync(GREETINGS_HISTORY_PATH, JSON.stringify([], null, 2));
        console.log('[SAUDAÇÃO] Histórico de saudações enviadas foi limpo com sucesso.');
        return true;
    } catch (error) {
        console.error('[SAUDAÇÃO] Erro ao tentar limpar o histórico de saudações:', error);
        return false;
    }
}


// --- FUNÇÃO PRINCIPAL (A DECISÃO DE ENVIAR) ---

async function enviarSaudacaoSeNecessario(msg, client, saudacaoAtiva) {
    console.log(`[DIAGNÓSTICO SAUDAÇÃO] Iniciando verificação para ${msg.from}. Status do toggle 'Saudações': ${saudacaoAtiva}`);

    if (!saudacaoAtiva) {
        console.log('[DIAGNÓSTICO SAUDAÇÃO] Retornando false porque o toggle de saudações está DESLIGADO.');
        return false;
    }
    
    const remetente = msg.from;
    if (!remetente || typeof remetente !== 'string' || remetente.endsWith('@broadcast') || remetente.endsWith('@newsletter') || remetente.endsWith('@g.us') || remetente === '0@c.us' || remetente.startsWith('0@')) {
        return false;
    }
    const history = loadGreetingHistory();

    if (history.has(remetente)) {
        console.log(`[DIAGNÓSTICO SAUDAÇÃO] Retornando false porque ${remetente} JÁ ESTÁ no histórico permanente.`);
        return false;
    }

    try {
        const greetings = loadGreetings();
        if (!greetings || greetings.length === 0) {
            console.warn('[DIAGNÓSTICO SAUDAÇÃO] Retornando false porque NENHUMA mensagem de saudação foi cadastrada.');
            return false;
        }

        console.log(`[SAUDAÇÃO] Contato novo detectado: ${remetente}. Enviando saudação.`);
        const saudacao = greetings[Math.floor(Math.random() * greetings.length)].message;
        
        await client.sendMessage(remetente, saudacao);
        
        saveToGreetingHistory(remetente);
        console.log(`[SAUDAÇÃO] Saudação enviada e ${remetente} registrado no histórico permanente.`);
        return true;

    } catch (error) {
        console.error(`[SAUDAÇÃO] Erro ao enviar saudação para ${remetente}:`, error);
        return false;
    }
}

// --- EXPORTAÇÕES ---
// Exportamos apenas as funções que são realmente usadas por outros arquivos
module.exports = {
    loadGreetings,
    saveGreetings,
    enviarSaudacaoSeNecessario,
    limparHistoricoSaudacao
};