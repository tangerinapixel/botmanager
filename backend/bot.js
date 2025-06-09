// backend/bot.js (arquivo principal)
const path = require('path');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const multer = require('multer');

const { processarMensagem, processarMensagemNaoLida } = require('./handlers/messageHandler');
const { limparHistoricoExpirado, jaRespondeuRecentemente } = require('./handlers/historicoService');
const { matchFluxo, loadFlows, saveFlows } = require('./handlers/fluxoService');
const { loadConfig, saveConfig } = require('./handlers/configService');
const { loadGreetings, saveGreetings } = require('./handlers/saudacaoService');
const setupInitialFiles = require('./handlers/setupFiles');

setupInitialFiles();

let respostasAtivas = true;
let saudacaoAtiva = true;
const config = loadConfig();
let tempoExpiracaoMs = config.tempoExpiracaoMinutos * 60 * 1000;

const respostasAtivasRef = { value: respostasAtivas };
const saudacaoAtivaRef = { value: saudacaoAtiva };
const tempoExpiracaoMsRef = { value: tempoExpiracaoMs };

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 5001;
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:5001 ws://localhost:3000;");
  next();
});

app.set('io', io);

// --- ESTADO GLOBAL DO CLIENTE WHATSAPP ---
let waClientState = 'DISCONNECTED'; 
let lastQrCode = null;
let isInitializing = false; 

let client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
    ]
  }
});

// --- FUNÇÕES DE CONTROLE DO CLIENTE WHATSAPP ---

function handleCriticalClientError(error, originMessage = 'Operação do cliente WhatsApp') {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ❗ Erro crítico capturado em "${originMessage}": Tipo: ${error.name}, Mensagem: ${error.message}`);
  // Logar mais do stack para debug, se não for muito verboso
  // if (error.stack) {
  //   console.error(`[${timestamp}] Stack trace parcial: ${error.stack.substring(0, 300)}`);
  // }

  const isSessionClosedError = error.message.includes('Session closed') || 
                               error.message.includes('Target closed') ||
                               error.message.includes('Protocol error'); // Erros comuns do Puppeteer/CDP

  if (isSessionClosedError && waClientState !== 'DISCONNECTED') {
    console.warn(`[${timestamp}] HANDLE_CRITICAL_ERROR: Detectada sessão fechada (${error.message}). Forçando estado para DESCONECTADO.`);
    waClientState = 'DISCONNECTED';
    lastQrCode = null;
    isInitializing = false;
    io.emit('status', 'disconnected'); 
    console.log(`[${timestamp}] HANDLE_CRITICAL_ERROR: Emitido 'status', 'disconnected' para o frontend.`);
  } else if (isSessionClosedError && waClientState === 'DISCONNECTED') {
    console.log(`[${timestamp}] HANDLE_CRITICAL_ERROR: Sessão fechada detectada, mas estado já é DISCONNECTED.`);
  } else if (!isSessionClosedError) {
    console.log(`[${timestamp}] HANDLE_CRITICAL_ERROR: Erro não parece ser de sessão fechada. Erro: ${error.message}`);
  }
}

async function executarReinicializacaoWhatsApp(origem = 'desconhecida') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Iniciando reinicialização do cliente WhatsApp. Solicitado por: ${origem}`);
  
  waClientState = 'LOADING';
  io.emit('status', 'loading'); 

  if (client && typeof client.destroy === 'function') {
    try {
      console.log(`[${timestamp}] [REINICIO_WA] Destruindo cliente WhatsApp existente...`);
      await client.destroy();
      console.log(`[${timestamp}] [REINICIO_WA] Cliente WhatsApp destruído.`);
    } catch (e) {
      console.error(`[${timestamp}] [REINICIO_WA] Erro ao destruir cliente WhatsApp:`, e.message);
    }
  } else {
    console.log(`[${timestamp}] [REINICIO_WA] Nenhuma instância de cliente ativa para destruir ou destroy não é uma função.`);
  }

  const pastaAuth = path.join(__dirname, '.wwebjs_auth');
  if (fs.existsSync(pastaAuth)) {
    try {
      console.log(`[${timestamp}] [REINICIO_WA] Removendo pasta de autenticação: ${pastaAuth}`);
      fs.rmSync(pastaAuth, { recursive: true, force: true });
      console.log(`[${timestamp}] [REINICIO_WA] Pasta .wwebjs_auth removida com sucesso.`);
    } catch (e) {
      console.error(`[${timestamp}] [REINICIO_WA] Erro ao remover pasta ${pastaAuth}:`, e.message);
    }
  } else {
    console.log(`[${timestamp}] [REINICIO_WA] Pasta .wwebjs_auth não encontrada.`);
  }
  
  waClientState = 'DISCONNECTED'; 
  lastQrCode = null;
  isInitializing = false;
  console.log(`[${timestamp}] [REINICIO_WA] Sessão limpa. Forçando reinício do servidor (process.exit)...`);
  process.exit(1); 
}

async function inicializarClienteWhatsApp(solicitadoPor = 'sistema') {
  const timestamp = new Date().toISOString();
  if (isInitializing) {
    console.log(`[${timestamp}] Inicialização já em progresso. Ignorando nova solicitação de: ${solicitadoPor}`);
    return;
  }
  // Se já está pronto e não é um reinício forçado (que viria de executarReinicializacaoWhatsApp)
  if (waClientState === 'READY' && solicitadoPor !== 'REINICIO_FORCADO' && !solicitadoPor.includes('socket')) { // Evita que um clique em "Conectar" com o bot já pronto tente re-inicializar desnecessariamente
      console.log(`[${timestamp}] Cliente já está 'READY'. Ignorando inicialização solicitada por: ${solicitadoPor}`);
      if (solicitadoPor.startsWith('socket ')) {
        const socketId = solicitadoPor.split(' ')[1];
        if (io.sockets.sockets.get(socketId)) {
            io.sockets.sockets.get(socketId).emit('status', 'ready');
        }
      } else {
          io.emit('status', 'ready'); 
      }
      return;
  }

  isInitializing = true;
  console.log(`[${timestamp}] Iniciando processo de conexão do cliente WhatsApp. Solicitado por: ${solicitadoPor}`);
  waClientState = 'LOADING';
  io.emit('status', 'loading'); 
  lastQrCode = null;

  try {
    // Se 'client' foi destruído e precisa ser recriado (process.exit() já cuida disso criando uma nova instância ao reiniciar o script)
    // Se você tivesse uma lógica de destroy() sem process.exit(), aqui seria o lugar para:
    // client = new Client({ authStrategy: new LocalAuth(), puppeteer: { ... } });
    // setupClientEventListeners(); // Função para reatribuir todos os client.on()
    console.log(`[${timestamp}] Chamando client.initialize()...`);
    await client.initialize();
    console.log(`[${timestamp}] client.initialize() PROMESSA CONCLUÍDA. Aguardando eventos 'qr' ou 'ready'.`);
  } catch (error) {
    console.error(`[${timestamp}] ERRO CRÍTICO durante client.initialize() (solicitado por ${solicitadoPor}):`, error);
    // Não definir isInitializing = false aqui ainda, o evento 'disconnected' ou 'auth_failure' deve tratar isso
    handleCriticalClientError(error, `Falha em client.initialize() por ${solicitadoPor}`);
  }
}

// --- Rotas Express ---
// CERTIFIQUE-SE DISTO: Suas rotas que usam 'client' devem receber e usar 'handleCriticalClientError'
const sendMassRoute = require('./routes/sendMassRoute')(client, io, handleCriticalClientError);
app.use('/api', sendMassRoute);

const exportarEtiquetasRouter = require('./routes/exportarEtiquetas')(client, handleCriticalClientError);
app.use('/', exportarEtiquetasRouter);

const exportarGruposRouter = require('./routes/exportarGrupos')(client, handleCriticalClientError);
app.use('/', exportarGruposRouter);

const listarEtiquetasRouter = require('./routes/listarEtiquetasComTotal')(client, handleCriticalClientError); // 'io' não parece ser usado aqui
app.use('/', listarEtiquetasRouter);

const apiRoutes = require('./routes/apiRoutes');
apiRoutes(app, io, client, { 
  loadFlows, saveFlows, loadGreetings, saveGreetings, loadConfig, saveConfig,
  upload, respostasAtivasRef, saudacaoAtivaRef, tempoExpiracaoMsRef,
  handleCriticalClientErrorFunc: handleCriticalClientError // Passando para apiRoutes se os handlers internos precisarem
});

// --- Eventos Socket.IO ---
io.on('connection', (socket) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Frontend conectado via Socket.IO: ${socket.id}`);

  socket.on('request_initial_status', () => {
    const currentTimestamp = new Date().toISOString();
    console.log(`[${currentTimestamp}] Frontend ${socket.id} solicitou status inicial. Estado atual do backend: ${waClientState}`);

    if (waClientState === 'QR_PENDING' && lastQrCode) {
      console.log(`[${currentTimestamp}] Enviando QR e status 'qr' para ${socket.id}`);
      socket.emit('qr', lastQrCode); 
      socket.emit('status', 'qr');  
    } else if (waClientState === 'READY') {
      console.log(`[${currentTimestamp}] Enviando status 'ready' para ${socket.id}`);
      socket.emit('status', 'ready');
    } else if (waClientState === 'LOADING') {
      console.log(`[${currentTimestamp}] Enviando status 'loading' para ${socket.id}`);
      socket.emit('status', 'loading');
    } else if (waClientState === 'AUTH_FAILURE') {
      console.log(`[${currentTimestamp}] Enviando status 'auth_failure' para ${socket.id}`);
      socket.emit('status', 'auth_failure');
    } else { 
      console.log(`[${currentTimestamp}] Enviando status 'disconnected' para ${socket.id}`);
      socket.emit('status', 'disconnected');
    }
  });

  socket.on('connect-whatsapp', () => {
    inicializarClienteWhatsApp(`socket ${socket.id}`);
  });

  socket.on('disconnect-whatsapp', () => {
    executarReinicializacaoWhatsApp(`socket ${socket.id}`);
  });

  socket.on('disconnect', () => {
    console.log(`[${new Date().toISOString()}] Frontend desconectado: ${socket.id}`);
  });
});

// --- Eventos WhatsApp ---
// PONTO DE ATENÇÃO: Esses handlers devem ser reatribuídos se a instância 'client' for recriada manualmente sem process.exit()
function setupClientEventListeners() {
    client.removeAllListeners(); // Limpa listeners antigos para evitar duplicação se esta função for chamada múltiplas vezes em uma instância de client existente

    client.on('qr', (qr) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] QR RECEIVED`);
      lastQrCode = qr;
      waClientState = 'QR_PENDING';
      isInitializing = true; // Ainda está inicializando até ficar 'ready'
      io.emit('qr', qr);
      io.emit('status', 'qr');
    });

    client.on('authenticated', () => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] CLIENT AUTHENTICATED`);
      lastQrCode = null; 
      waClientState = 'LOADING'; 
      io.emit('status', 'loading');
    });

    client.on('auth_failure', (msg) => {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] AUTHENTICATION FAILURE:`, msg);
      lastQrCode = null;
      waClientState = 'AUTH_FAILURE';
      isInitializing = false;
      io.emit('status', 'auth_failure');
    });

    client.on('ready', async () => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ✅ Dispositivo conectado! WhatsApp Client está pronto.`);
      waClientState = 'READY'; 
      isInitializing = false;  
      lastQrCode = null;       
      io.emit('status', 'ready');

      console.log(`[${timestamp}] Verificando mensagens não lidas recebidas enquanto offline...`);
      try {
        const chats = await client.getChats();
        for (const chat of chats) {
          if (!chat.isGroup && chat.unreadCount > 0) {
            console.log(`[${timestamp}] Chat com ${chat.name || chat.id.user} tem ${chat.unreadCount} mensagens não lidas.`);
            const limitFetch = Math.min(chat.unreadCount, 15); 
            const messages = await chat.fetchMessages({ limit: limitFetch });
            let ultimaMensagemDoContato = null;
            for (const msg of messages) {
              if (!msg.fromMe) { 
                ultimaMensagemDoContato = msg;
                break; 
              }
            }
            if (ultimaMensagemDoContato) {
              console.log(`[${timestamp}] Processando ÚLTIMA mensagem não lida de ${ultimaMensagemDoContato.from}: "${ultimaMensagemDoContato.body.substring(0, 50)}..."`);
              await processarMensagemNaoLida(
                ultimaMensagemDoContato, client, tempoExpiracaoMsRef.value, saudacaoAtivaRef.value
              );
            } else {
              console.log(`[${timestamp}] Nenhuma mensagem DO CONTATO encontrada entre as ${messages.length} mais recentes não lidas no chat com ${chat.name || chat.id.user}.`);
            }
          }
        }
        console.log(`[${timestamp}] Verificação de mensagens não lidas concluída.`);
      } catch (err) {
        console.error(`[${timestamp}] Erro ao processar mensagens não lidas no evento 'ready':`, err);
        handleCriticalClientError(err, "processar mensagens não lidas no 'ready'"); // PONTO DE ATENÇÃO
      }
      
      try {
        const labels = await client.getLabels();
        console.log(`[${timestamp}] Labels carregadas no evento 'ready': ${labels.length}`);
      } catch (err) {
        console.error(`[${timestamp}] Erro ao carregar labels no evento 'ready':`, err);
        handleCriticalClientError(err, "carregar labels no 'ready'"); // PONTO DE ATENÇÃO
      }
    });

    client.on('loading_screen', (percent, message) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] LOADING SCREEN WA: ${percent}% ${message}`);
      if(waClientState !== 'READY') { 
          if (waClientState !== 'LOADING' && waClientState !== 'QR_PENDING') { // Evita mudar de QR_PENDING para LOADING desnecessariamente
            waClientState = 'LOADING'; 
            io.emit('status', 'loading');
          }
      }
      io.emit('loading_update', { percent, message });
    });

    client.on('disconnected', (reason) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] EVENTO 'disconnected' DO CLIENTE WA RECEBIDO! Razão: ${reason}`);
      lastQrCode = null;
      waClientState = 'DISCONNECTED';
      isInitializing = false; 
      console.log(`[${timestamp}] Emitindo 'status', 'disconnected' para o frontend...`);
      io.emit('status', 'disconnected');
      console.log(`[${timestamp}] Evento 'status', 'disconnected' emitido globalmente.`);
    });

    client.on('message', (msg) => processarMensagem(msg, client, tempoExpiracaoMsRef.value, saudacaoAtivaRef.value));
}

setupClientEventListeners(); // Chama para configurar os listeners na instância inicial do client

// --- Agendamentos e Servidor HTTP ---
setInterval(limparHistoricoExpirado, 10 * 60 * 1000);

const frontendPath = path.join(__dirname, '../frontend/build');
app.use(express.static(frontendPath));
app.get('*', (req, res) => {
  console.log(`[${new Date().toISOString()}] Rota curinga '*' acessada, enviando index.html`);
  res.sendFile(path.join(frontendPath, 'index.html'));
});

httpServer.listen(port, () => {
  console.log(`[${new Date().toISOString()}] ✅ Servidor rodando na porta ${port}`);
  console.log(`[${new Date().toISOString()}] Ambiente: ${process.env.NODE_ENV || 'development'}`);
  inicializarClienteWhatsApp('inicialização do servidor HTTP');
});

process.on('uncaughtException', (error) => {
  console.error(`[${new Date().toISOString()}] 💥 ERRO NÃO TRATADO (Uncaught Exception):`, error);
  // Em um ambiente de produção, você pode querer que o PM2 reinicie de forma limpa.
  // Adicionar um pequeno delay antes de sair pode ajudar os logs a serem escritos.
  // setTimeout(() => process.exit(1), 1000); 
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`[${new Date().toISOString()}] 💥 REJEIÇÃO DE PROMISE NÃO TRATADA (Unhandled Rejection):`, reason);
});