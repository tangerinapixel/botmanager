// backend/handlers/configService.js (VERSÃO FINAL E COMPLETA)

const fs = require('fs');
const { getDataFilePath } = require('../utils/paths');

// --- Bloco para config.json ---
const configFilePath = getDataFilePath('config.json');

const defaultConfig = {
  tempoExpiracaoMinutos: 3
};

// --- Bloco para ia_context.json (NOVO) ---
const IA_CONTEXT_PATH = getDataFilePath('ia_context.json');

const defaultIAContext = {
  "nomeBot": "Assistente Virtual",
  "nomeEmpresa": "Sua Empresa",
  "tipoNegocio": "atendimento ao cliente",
  "tomDeVoz": "amigável e prestativo",
  "informacoes": {
    "horarioAtendimento": "Segunda a Sexta, das 9h às 18h.",
    "endereco": "Não informado",
    "pagamento": "Não informado",
    "produtos": "Nenhum produto cadastrado.",
    "contatoHumano": "Não informado",
    "site": "Não informado",
    "gruposWhatsapp": [],
    "principaisTopicos": ["atendimento", "suporte"]
  }
};

// --- Funções para config.json ---
function loadConfig() {
  try {
    if (!fs.existsSync(configFilePath)) {
      fs.writeFileSync(configFilePath, JSON.stringify(defaultConfig, null, 2));
      console.log('[Config Service] Arquivo config.json não encontrado, um novo foi criado com valores padrão.');
      return defaultConfig;
    }
    const data = fs.readFileSync(configFilePath, 'utf-8');
    return { ...defaultConfig, ...JSON.parse(data) };
  } catch (error) {
    console.error(`[Config Service] Erro ao carregar config.json: ${error.message}. Usando configuração padrão.`);
    return defaultConfig;
  }
}

function saveConfig(config) {
  try {
    const dataString = JSON.stringify(config, null, 2);
    fs.writeFileSync(configFilePath, dataString, 'utf8');
    console.log('[Config Service] ✅ Configuração salva com sucesso em:', configFilePath);
  } catch (error) {
    console.error(`[Config Service] ❌ ERRO CRÍTICO AO SALVAR CONFIG.JSON:`, error);
    throw new Error('Falha ao escrever no arquivo de configuração.');
  }
}

// --- Funções para ia_context.json (NOVAS) ---
function loadConfigIA() {
  try {
    if (!fs.existsSync(IA_CONTEXT_PATH)) {
      fs.writeFileSync(IA_CONTEXT_PATH, JSON.stringify(defaultIAContext, null, 2));
      console.log('[Config Service] Arquivo ia_context.json não encontrado, um novo foi criado com valores padrão.');
      return defaultIAContext;
    }
    const data = fs.readFileSync(IA_CONTEXT_PATH, 'utf-8');
    return { ...defaultIAContext, ...JSON.parse(data) };
  } catch (error) {
    console.error(`[Config Service] Erro ao carregar ia_context.json: ${error.message}. Usando configuração padrão.`);
    return defaultIAContext;
  }
}

function saveConfigIA(config) {
  try {
    const dataString = JSON.stringify(config, null, 2);
    fs.writeFileSync(IA_CONTEXT_PATH, dataString, 'utf8');
    console.log('[Config Service] ✅ Configuração da IA salva com sucesso em:', IA_CONTEXT_PATH);
  } catch (error) {
    console.error(`[Config Service] ❌ ERRO CRÍTICO AO SALVAR IA_CONTEXT.JSON:`, error);
    throw new Error('Falha ao escrever no arquivo de configuração da IA.');
  }
}

// --- Exportações ---
module.exports = { loadConfig, saveConfig, loadConfigIA, saveConfigIA };