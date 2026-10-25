const fs = require('fs');
const path = require('path');
const { dataDir, getDataFilePath } = require('../utils/paths');

module.exports = function setupInitialFiles() {
  const arquivos = {
    'fluxos.json': { flows: [] },
    'greetings.json': { greetings: [] },
    'greeted.json': { greeted: [] },
    'config.json': {
      tempoExpiracaoMinutos: 3,
      respostasAtivas: true,
      saudacaoAtiva: true
    },
    'ia_context.json': {
      nomeBot: "Assistente Virtual",
      nomeEmpresa: "Sua Empresa",
      tipoNegocio: "atendimento ao cliente",
      tomDeVoz: "amigável",
      informacoes: {
        horarioAtendimento: "Segunda a Sexta, das 9h às 18h.",
        site: "",
        contatoHumano: "",
        produtos: [],
        gruposWhatsapp: [],
        principaisTopicos: []
      },
      promptConfig: {
        persona: "Você é o ${nomeBot}.",
        baseConhecimentoHeader: "",
        regrasGerais: []
      }
    },
    'respondidas.json': { historico: [] }
  };

  for (const [nomeArquivo, conteudo] of Object.entries(arquivos)) {
    const destPath = getDataFilePath(nomeArquivo);
    if (!fs.existsSync(destPath)) {
      // Tenta copiar do template empacotado se existir
      const srcPath = path.join(__dirname, '..', 'data', nomeArquivo);
      if (fs.existsSync(srcPath)) {
        try {
          fs.copyFileSync(srcPath, destPath);
          console.log(`[setupInitialFiles] Copiado template de ${nomeArquivo} para ${destPath}`);
          continue;
        } catch (e) {
          console.error(`[setupInitialFiles] Falha ao copiar template de ${nomeArquivo}:`, e);
        }
      }
      fs.writeFileSync(destPath, JSON.stringify(conteudo, null, 2));
      console.log(`[setupInitialFiles] Criado arquivo ${nomeArquivo} padrão em ${destPath}`);
    }
  }
};
