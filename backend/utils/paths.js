const path = require('path');
const fs = require('fs');

const user_data_path = process.env.USER_DATA_PATH;

const dataDir = user_data_path
  ? path.join(user_data_path, 'data')
  : path.join(__dirname, '..', 'data');

const uploadsDir = user_data_path
  ? path.join(user_data_path, 'uploads')
  : path.join(__dirname, '..', 'uploads');

// Chamada explicitamente em bot.js antes de qualquer operação de arquivo.
// Separar do escopo de módulo evita I/O síncrono bloqueante no require().
function ensureDirectories() {
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (err) {
      console.error(`Erro ao criar diretório dataDir: ${dataDir}`, err);
    }
  }
  if (!fs.existsSync(uploadsDir)) {
    try {
      fs.mkdirSync(uploadsDir, { recursive: true });
    } catch (err) {
      console.error(`Erro ao criar diretório uploadsDir: ${uploadsDir}`, err);
    }
  }
}

module.exports = {
  dataDir,
  uploadsDir,
  ensureDirectories,
  getDataFilePath: (filename) => path.join(dataDir, filename)
};
