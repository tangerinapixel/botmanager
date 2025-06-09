// backend/bot.js (arquivo principal)
const path = require('path');
const fs = require('fs'); // fs já está aqui, ótimo!
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js'); // Removido MessageMedia se não usado diretamente aqui
const multer = require('multer');

const { processarMensagem, processarMensagemNaoLida } = require('./handlers/messageHandler');
const { limparHistoricoExpirado, jaRespondeuRecentemente } = require('./handlers/historicoService');
const { matchFluxo, loadFlows, saveFlows } = require('./handlers/fluxoService');
const { loadConfig, saveConfig } = require('./handlers/configService');
const { loadGreetings, saveGreetings } = require('./handlers/saudacaoService'); // Removido enviarSaudacaoSeNecessario se não usado diretamente aqui
const setupInitialFiles = require('./handlers/setupFiles');

// Inicializa arquivos/pastas se necessário
setupInitialFiles();

// Variáveis globais
let respostasAtivas = true;
let saudacaoAtiva = true;
const config = loadConfig();
let tempoExpiracaoMs = config.tempoExpiracaoMinutos * 60 * 1000;

const respostasAtivasRef = { value: respostasAtivas };
const saudacaoAtivaRef = { value: saudacaoAtiva };
const tempoExpiracaoMsRef = { value: tempoExpiracaoMs };

// App e servidor
const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 5001; // MODIFICADO: Usar variável de ambiente para porta é uma boa prática
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000', // Ou a URL do seu frontend em produção
    methods: ['GET', 'POST'],
  },
});

// Middleware e uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:5001 ws://localhost:3000;"); // MODIFICADO: Adicionado ws://localhost:3000 para HMR do frontend se necessário. Ajuste 'unsafe-inline' conforme suas necessidades de segurança.
  next();
});

app.set('io', io); // Disponibiliza 'io' para as rotas, se necessário

// --- Cliente WhatsApp ---
// MODIFICADO: Definido como 'let' para permitir re-instanciação se necessário, ou manter como const se a re-inicialização for sempre via process.exit()
let client = new Client({
  authStrategy: new LocalAuth({
    // dataPath: 'sessions' // Opcional: para especificar onde salvar a sessão
  }),
  puppeteer: {
    headless: false, // Mude para true para produção se não precisar ver o navegador
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Verifique se este caminho está correto
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu', // Pode ajudar em alguns ambientes
      // '--single-process', // Teste se tiver problemas com múltiplos processos do Chrome
    ]
  }
});

// --- FUNÇÃO DE REINICIALIZAÇÃO DO WHATSAPP --- (NOVO - Opção 2)
async function executarReinicializacaoWhatsApp(origem = 'desconhecida') {
  console.log(`[${new Date().toISOString()}] Iniciando reinicialização do cliente WhatsApp. Solicitado por: ${origem}`);
  io.emit('status', 'loading'); // Avisa o frontend que está reiniciando/carregando

  if (client && typeof client.destroy === 'function') {
    try {
      console.log('[REINICIO_WA] Destruindo cliente WhatsApp existente...');
      await client.destroy();
      console.log('[REINICIO_WA] Cliente WhatsApp destruído.');
    } catch (e) {
      console.error('[REINICIO_WA] Erro ao destruir cliente WhatsApp:', e.message);
    }
  } else {
    console.log('[REINICIO_WA] Nenhuma instância de cliente ativa para destruir ou destroy não é uma função.');
  }

  const pastaAuth = path.join(__dirname, '.wwebjs_auth');
  if (fs.existsSync(pastaAuth)) {
    try {
      console.log(`[REINICIO_WA] Removendo pasta de autenticação: ${pastaAuth}`);
      fs.rmSync(pastaAuth, { recursive: true, force: true });
      console.log('[REINICIO_WA] Pasta .wwebjs_auth removida com sucesso.');
    } catch (e) {
      console.error(`[REINICIO_WA] Erro ao remover pasta ${pastaAuth}:`, e.message);
      // Mesmo se falhar ao remover a pasta, tentar reiniciar o processo pode resolver
    }
  } else {
    console.log('[REINICIO_WA] Pasta .wwebjs_auth não encontrada, nada a remover.');
  }
  
  console.log('[REINICIO_WA] Sessão limpa. Forçando reinício do servidor (process.exit)...');
  // Força o processo a sair. O PM2 (ou outro gerenciador) deve reiniciá-lo.
  process.exit(1); // Usar 1 geralmente indica uma saída não planejada, mas PM2 reinicia.
}

// --- FUNÇÃO PARA INICIALIZAR O CLIENTE WHATSAPP --- (NOVO - para organização)
async function inicializarClienteWhatsApp(solicitadoPor = 'sistema') {
  console.log(`[${new Date().toISOString()}] Solicitado inicialização do cliente WhatsApp por: ${solicitadoPor}`);
  // Lógica para evitar múltiplas inicializações simultâneas pode ser adicionada aqui se necessário
  try {
    // Se o cliente foi destruído, precisamos de uma nova instância.
    // Se a abordagem for sempre process.exit() para reinício, a instância será nova automaticamente.
    // Se não for process.exit(), e client.destroy() foi chamado, você pode precisar de:
    // client = new Client({ authStrategy: new LocalAuth(), puppeteer: { ... } });
    // Por ora, assumindo que `client.initialize()` pode ser chamado novamente ou que o processo reinicia.

    console.log(`[${new Date().toISOString()}] Chamando client.initialize()...`);
    io.emit('status', 'loading'); // Avisa o frontend que está carregando
    await client.initialize(); // initialize é assíncrono
    console.log(`[${new Date().toISOString()}] client.initialize() concluído (ou promessa resolvida). Aguardando eventos 'qr' ou 'ready'.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ERRO CRÍTICO durante client.initialize():`, error);
    io.emit('status', 'disconnected'); // Ou um status de erro mais específico
    io.emit('auth_failure', `Falha ao inicializar cliente: ${error.message}`);
    // Considerar se deve chamar executarReinicializacaoWhatsApp aqui em caso de falha crítica na inicialização
  }
}

// --- INICIALIZAÇÃO INICIAL DO CLIENTE ---
// MODIFICADO: Chamada inicial movida para ser mais controlada ou chamada via socket
// client.initialize(); // Comentado para possivelmente iniciar via ação do usuário ou após o servidor estar pronto
// Vamos iniciar quando o servidor estiver escutando ou via solicitação do frontend.
// Por enquanto, vamos manter a inicialização automática, mas a função acima pode ser usada.
inicializarClienteWhatsApp('inicialização automática do servidor');


// --- Rotas Express ---
const sendMassRoute = require('./routes/sendMassRoute')(client, io);
app.use('/api', sendMassRoute);

app.use('/', require('./routes/exportarEtiquetas')(client));
app.use('/', require('./routes/listarEtiquetasComTotal')(client));
// Se você tiver a rota reiniciarWhatsapp.js e quiser usá-la:
// app.use('/api/whatsapp', require('./routes/reiniciarWhatsapp')(client, io)); // Precisaria passar client e io

// Rotas organizadas
const apiRoutes = require('./routes/apiRoutes');
apiRoutes(app, io, client, { // Passando client e io para apiRoutes
  loadFlows, saveFlows,
  loadGreetings, saveGreetings,
  loadConfig, saveConfig,
  upload,
  respostasAtivasRef,
  saudacaoAtivaRef,
  tempoExpiracaoMsRef
});

// --- Eventos Socket.IO --- (NOVO Bloco)
io.on('connection', (socket) => {
  console.log(`[${new Date().toISOString()}] Frontend conectado via Socket.IO: ${socket.id}`);

  socket.on('initialize_whatsapp_client', () => {
    inicializarClienteWhatsApp(`socket ${socket.id}`);
  });

  socket.on('restart_whatsapp_client', () => {
    executarReinicializacaoWhatsApp(`socket ${socket.id}`);
  });

  socket.on('request_initial_status', () => {
    console.log(`[${new Date().toISOString()}] Frontend ${socket.id} solicitou status inicial.`);
    // Lógica para enviar o estado atual do 'client' (ready, qr_code, disconnected)
    // e o QR code se aplicável. Isso pode ser mais complexo de rastrear globalmente.
    // Por enquanto, se o frontend pedir, podemos tentar emitir o QR se soubermos que está pendente,
    // ou 'disconnected' se 'client.info' não existir.
    // if (client && client.pupPage && !client.info) { // Heurística para QR pendente
    //   // O QR é emitido pelo client.on('qr'), o frontend já deve pegar.
    //   // Mas podemos reemitir o status 'qr' se soubermos.
    //   console.log("Ainda não temos como re-enviar QR sob demanda de forma simples, frontend deve pegar o evento 'qr'.");
    // } else if (client && client.info) {
    //   socket.emit('status', 'ready');
    // } else {
    //   socket.emit('status', 'disconnected');
    // }
    // Uma abordagem mais simples é o frontend ter seu próprio estado inicial e esperar os eventos normais.
    // Ou o backend poderia manter uma variável global de estado WA (ex: global.waClientState)
  });

  socket.on('disconnect', () => {
    console.log(`[${new Date().toISOString()}] Frontend desconectado: ${socket.id}`);
  });
});


// --- Eventos WhatsApp ---
client.on('qr', (qr) => {
  console.log(`[${new Date().toISOString()}] QR RECEIVED`);
  // console.log(qr); // Logar o QR pode ser muito verboso, mas útil para debug
  io.emit('qr', qr); // Envia o QR Code para o frontend
  io.emit('status', 'qr'); // Envia um status para o Header saber que está aguardando QR
});

client.on('authenticated', () => { // NOVO listener (ou MODIFICADO)
  console.log(`[${new Date().toISOString()}] AUTHENTICATED`);
  io.emit('status', 'loading'); // Muda para 'loading' após autenticar, antes de 'ready'
});

client.on('auth_failure', (msg) => { // NOVO listener (ou MODIFICADO)
  console.error(`[${new Date().toISOString()}] AUTHENTICATION FAILURE:`, msg);
  io.emit('status', 'auth_failure'); // Envia status de falha
  // Você pode querer chamar executarReinicializacaoWhatsApp() aqui se a falha for irrecuperável.
});

client.on('ready', async () => {
  console.log(`[${new Date().toISOString()}] ✅ Dispositivo conectado! WhatsApp Client está pronto.`);
  io.emit('status', 'ready'); // Envia status de pronto

  // A lógica de carregar labels e processar não lidas pode permanecer aqui
  try {
    const labels = await client.getLabels();
    console.log(`[${new Date().toISOString()}] Labels carregadas: ${labels.length}`);
    // labels.forEach(label => {
    //   console.log(`- ${label.name} | ID: ${label.id}`);
    // });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Erro ao carregar labels no evento 'ready':`, err);
  }
  
  // Processar mensagens não lidas (opcional, pode consumir recursos na inicialização)
  try {
    const chats = await client.getChats();
    for (const chat of chats) {
      if (!chat.isGroup && chat.unreadCount > 0) {
        const messages = await chat.fetchMessages({ limit: chat.unreadCount > 5 ? 5 : chat.unreadCount }); // Limitar para não sobrecarregar
        for (const msg of messages.reverse()) {
          if (!msg.fromMe) { // Processar apenas se não for sua própria mensagem não lida
            console.log(`[${new Date().toISOString()}] 📩 Processando não lida (on ready) de ${msg.from}: "${msg.body.substring(0,30)}..."`);
            await processarMensagemNaoLida(msg, client, tempoExpiracaoMsRef.value, saudacaoAtivaRef.value);
          }
        }
      }
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Erro ao processar mensagens não lidas no evento 'ready':`, err);
  }
});

client.on('loading_screen', (percent, message) => { // NOVO listener (ou MODIFICADO)
  console.log(`[${new Date().toISOString()}] LOADING SCREEN WHATSAPP`, percent, message);
  io.emit('status', 'loading'); // Mantém o status como 'loading'
  io.emit('loading_update', { percent, message }); // Opcional: envia detalhes do loading
});

client.on('disconnected', (reason) => {
  console.log(`[${new Date().toISOString()}] 🔴 Cliente WhatsApp foi desconectado! Razão:`, reason);
  io.emit('status', 'disconnected');
  // Tentar reconectar automaticamente ou limpar sessão e pedir novo QR?
  // Por enquanto, apenas emite o status. O usuário pode clicar em "CONECTAR" no frontend.
  // Se quiser tentar uma reinicialização automática em certos casos de desconexão:
  // if (reason === 'NAVIGATION') { // Exemplo de uma razão que pode justificar um reset
  //   console.log("Desconexão por navegação, tentando reinicializar...");
  //   executarReinicializacaoWhatsApp('desconexão automática por navegação');
  // }
});

client.on('message', (msg) => processarMensagem(msg, client, tempoExpiracaoMsRef.value, saudacaoAtivaRef.value));

// Agendamentos
setInterval(limparHistoricoExpirado, 10 * 60 * 1000);

// Frontend SPA
const frontendPath = path.join(__dirname, '../frontend/build');
app.use(express.static(frontendPath));
app.get('*', (req, res) => {
  console.log(`[${new Date().toISOString()}] Rota curinga '*' acessada, enviando index.html`);
  res.sendFile(path.join(frontendPath, 'index.html'));
});

httpServer.listen(port, () => {
  console.log(`[${new Date().toISOString()}] ✅ Servidor rodando na porta ${port}`);
  console.log(`[${new Date().toISOString()}] Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

// Captura de erros não tratados para evitar que o servidor caia abruptamente
process.on('uncaughtException', (error) => {
  console.error(`[${new Date().toISOString()}] 💥 ERRO NÃO TRATADO (Uncaught Exception):`, error);
  // Considerar se deve tentar um io.emit aqui, mas pode não funcionar se o erro for grave.
  // Em um ambiente de produção, você pode querer sair do processo para que o PM2 o reinicie.
  // process.exit(1); // Cuidado com loops de restart se o erro for na inicialização.
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`[${new Date().toISOString()}] 💥 REJEIÇÃO DE PROMISE NÃO TRATADA (Unhandled Rejection):`, reason);
  // Detalhes da promise original, se disponível
  // console.error("Promise original:", promise); 
});