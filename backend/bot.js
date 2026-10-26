console.log('[Bot.js]: EXECUTANDO PRIMEIRA LINHA DO BOT.JS');
// backend/bot.js (BOOT EM 2 ESTÁGIOS - EARLY BINDING GENUÍNO)

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 5005;

const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
  pingInterval: 25000,
  pingTimeout: 10000,
});

app.use(cors());
app.use(bodyParser.json());
app.set('io', io);

// --- VARIÁVEIS GLOBAIS DE ESTADO E CLIENTE ---
let globalClientManager = null;
let isShuttingDown = false;

// --- ESTÁGIO 1: ROTAS IMEDIATAS, CONFIGURAÇÕES E ENTREGA DO FRONTEND SPA ---
const { ts } = require('./utils/logger');
const { uploadsDir, ensureDirectories } = require('./utils/paths');

// Garante pastas e arquivos essenciais (< 20ms)
ensureDirectories();
const setupInitialFiles = require('./handlers/setupFiles');
setupInitialFiles();

// Configurações de upload e segurança
const multer = require('multer');
app.use('/uploads', express.static(uploadsDir));
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ws://localhost:5005 ws://localhost:3000;");
  next();
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

// Handlers de dados essenciais em memória e disco
const { loadConfig, saveConfig, loadConfigIA, saveConfigIA } = require('./handlers/configService');
const { loadGreetings, saveGreetings, limparHistoricoSaudacao } = require('./handlers/saudacaoService');
const { loadFlows, saveFlows } = require('./handlers/fluxoService');
const { limparHistoricoExpirado } = require('./handlers/historicoService');

const config = loadConfig();
const respostasAtivasRef = { value: config.respostasAtivas ?? true };
const saudacaoAtivaRef = { value: config.saudacaoAtiva ?? true };
const tempoExpiracaoMsRef = { value: (config.tempoExpiracaoMinutos ?? 5) * 60 * 1000 };
const iaAtivaRef = { value: config.iaAtiva ?? true };

// Registro imediato das rotas da API (atende /api/data, /api/fluxos, /api/greetings, /api/status, etc.)
const apiRoutes = require('./routes/apiRoutes');
apiRoutes(app, io, null, {
  loadFlows, saveFlows, loadGreetings, saveGreetings, loadConfig, saveConfig, loadConfigIA, saveConfigIA, limparHistoricoSaudacao,
  upload, respostasAtivasRef, saudacaoAtivaRef, tempoExpiracaoMsRef, iaAtivaRef
});

// Configuração imediata do Socket.IO com getters dinâmicos para o WhatsApp Client
const configurarSocketEvents = require('./socketEvents');
configurarSocketEvents(io, {
  getWaClientState: () => globalClientManager ? globalClientManager.getState().waClientState : 'DISCONNECTED',
  getLastQrCode: () => globalClientManager ? globalClientManager.getState().lastQrCode : null,
  getLoadingProgress: () => globalClientManager ? globalClientManager.getState().loadingProgress : 0,
  inicializarClienteWhatsApp: (origin) => globalClientManager && globalClientManager.initialize(origin),
  executarReinicializacaoWhatsApp: (origin) => globalClientManager && globalClientManager.restart(origin)
});

// Rota estática do frontend para resposta imediata
const frontendPath = path.join(__dirname, '../frontend/build');
app.use(express.static(frontendPath));

// Fallback SPA imediato para requisições não-API
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/exportar-')) {
    return next();
  }
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

// Limpeza periódica de histórico expirado
setInterval(() => {
  limparHistoricoExpirado(tempoExpiracaoMsRef.value);
}, 10 * 60 * 1000);

// --- ESTÁGIO 2: BOOT PESADO (CARREGAMENTO DO WHATSAPP CLIENT EM BACKGROUND) ---
async function bootPesado() {
  console.log(`[${ts()}] [BootPesado] Carregando serviços do WhatsApp em segundo plano...`);

  const { processarMensagem } = require('./handlers/messageHandler');
  const WhatsAppClientManager = require('./services/whatsappClientManager');

  const clientManager = new WhatsAppClientManager(
    io,
    { processarMensagem },
    { tempoExpiracaoMsRef, saudacaoAtivaRef, respostasAtivasRef, iaAtivaRef }
  );
  globalClientManager = clientManager;

  // Rotas que dependem do WhatsApp Client
  const sendMassRoute = require('./routes/sendMassRoute')(clientManager, io);
  app.use('/api', sendMassRoute);

  const exportarEtiquetasRouter = require('./routes/exportarEtiquetas')(clientManager);
  app.use('/', exportarEtiquetasRouter);

  const exportarGruposRouter = require('./routes/exportarGrupos')(clientManager);
  app.use('/', exportarGruposRouter);

  const listarEtiquetasRouter = require('./routes/listarEtiquetasComTotal')(clientManager);
  app.use('/', listarEtiquetasRouter);

  const liveChatRouter = require('./routes/liveChatRoutes')(clientManager, io);
  app.use('/api/live-chat', liveChatRouter);

  console.log(`[${ts()}] [BootPesado] Módulos WhatsApp carregados! Inicializando cliente WhatsApp...`);
  setTimeout(() => {
    clientManager.initialize('inicialização do servidor HTTP');
  }, 100);
}

// --- ESTÁGIO 1: ABERTURA DO SERVIDOR HTTP COM API E FRONTEND 100% PRONTOS ---
httpServer.listen(port, () => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ✅ Servidor rodando na porta ${port} com API e rotas prontas`);
  console.log(`[${timestamp}] Ambiente: ${process.env.NODE_ENV || 'development'}`);

  // Notifica o Electron via IPC — a API e o Frontend estão 100% aptos a responder agora
  if (process.parentPort) {
    process.parentPort.postMessage({ type: 'backend-ready', port });
  }

  // Executa o boot pesado do WhatsApp em segundo plano sem competir com a interface
  setImmediate(() => {
    bootPesado().catch(err => {
      console.error(`[${new Date().toLocaleTimeString()}] 💥 Erro durante bootPesado:`, err);
    });
  });
}).on('error', (err) => {
  console.error(`💥 Erro ao iniciar servidor HTTP:`, err);
  process.exit(1);
});

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[Bot.js] 🛑 Recebido sinal de encerramento (${signal}). Encerrando cliente WhatsApp e liberando recursos...`);

  try {
    if (globalClientManager) {
      await globalClientManager.destroy(`Shutdown (${signal})`);
    }
  } catch (err) {
    console.error('[Bot.js] Erro ao encerrar cliente WhatsApp:', err.message);
  } finally {
    // Notifica o Electron via IPC que os recursos do backend foram liberados com sucesso
    if (process.parentPort) {
      try {
        process.parentPort.postMessage({ type: 'shutdown-complete' });
      } catch (_) {}
    }

    httpServer.close(() => {
      console.log('[Bot.js] Servidor HTTP encerrado com sucesso.');
      process.exit(0);
    });
    // Força término de segurança em no máximo 2.5 segundos caso conexões residuais fiquem presas
    setTimeout(() => process.exit(0), 2500);
  }
}

// Sinais do console (Ctrl+C no terminal / SIGTERM / Nodemon restart)
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.once('SIGUSR2', () => gracefulShutdown('SIGUSR2'));

// Listener IPC para desligamento suave solicitado pelo processo Main do Electron (produção)
if (process.parentPort) {
  process.parentPort.on('message', (e) => {
    const msg = e && e.data ? e.data : e;
    if (msg && msg.type === 'graceful-shutdown') {
      gracefulShutdown('ELECTRON_IPC');
    }
  });
}

// --- TRATAMENTO DE ERROS GLOBAIS ---
process.on('uncaughtException', (error) => {
  console.error(`💥 ERRO NÃO TRATADO (Uncaught Exception):`, error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`💥 REJEIÇÃO DE PROMISE NÃO TRATADA (Unhandled Rejection):`, reason);
});