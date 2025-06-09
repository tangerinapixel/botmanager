const fs = require('fs');
const path = require('path');

module.exports = function setupInitialFiles() {
  const dataDir = path.join(__dirname, '../data');
  const arquivos = {
    'fluxos.json': { flows: [] },
    'greetings.json': { greetings: [] },
    'greeted.json': { greeted: [] },
    'config.json': { tempoExpiracaoMinutos: 3 },
  };

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }

  for (const [nomeArquivo, conteudo] of Object.entries(arquivos)) {
    const filePath = path.join(dataDir, nomeArquivo);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(conteudo, null, 2));
    }
  }
};
