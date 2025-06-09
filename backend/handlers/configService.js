// backend/handlers/configService.js

const fs = require('fs');
const path = require('path');

// Define o caminho para o arquivo de forma segura
const configFilePath = path.join(__dirname, '..', '..', 'data', 'config.json');

// Garante que o diretório de dados exista
const dataDir = path.dirname(configFilePath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const defaultConfig = {
  tempoExpiracaoMinutos: 3
};

function loadConfig() {
  try {
    // Se o arquivo não existe, cria um com valores padrão e o retorna
    if (!fs.existsSync(configFilePath)) {
        fs.writeFileSync(configFilePath, JSON.stringify(defaultConfig, null, 2));
        console.log('[Config Service] Arquivo config.json não encontrado, um novo foi criado com valores padrão.');
        return defaultConfig;
    }
    // Se existe, lê o arquivo
    const data = fs.readFileSync(configFilePath, 'utf-8');
    // Retorna o conteúdo do arquivo mesclado com o padrão (para garantir que todas as chaves existam)
    return { ...defaultConfig, ...JSON.parse(data) };
  } catch (error) {
    console.error(`[Config Service] Erro ao carregar config.json: ${error.message}. Usando configuração padrão.`);
    // Em caso de erro de leitura ou parse, retorna o padrão para não quebrar a aplicação
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
    // A LINHA MAIS IMPORTANTE: Avisa quem chamou a função que deu erro!
    throw new Error('Falha ao escrever no arquivo de configuração.');
  }
}

module.exports = { loadConfig, saveConfig };