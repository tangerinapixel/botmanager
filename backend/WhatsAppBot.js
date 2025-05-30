const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const EventEmitter = require('events');

// Caminho do arquivo fluxos.json (dentro da pasta backend/data)
const fluxoPath = path.join(__dirname, '../data/fluxos.json');

// Se o arquivo de fluxos ainda não existir, cria um inicial com um array vazio
if (!fs.existsSync(fluxoPath)) {
  fs.writeFileSync(fluxoPath, JSON.stringify({ flows: [] }, null, 2));
}

// Função para carregar os fluxos
function loadFlows() {
  try {
    const data = fs.readFileSync(fluxoPath, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed.flows) ? parsed.flows : [];
  } catch (err) {
    console.error('Erro ao carregar os fluxos:', err);
    return [];
  }
}

// Função para salvar os fluxos
function saveFlows(flows) {
  try {
    fs.writeFileSync(fluxoPath, JSON.stringify({ flows }, null, 2));
  } catch (err) {
    console.error('Erro ao salvar os fluxos:', err);
  }
}

class WhatsAppBot extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.client = null;
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.flows = loadFlows();
    this.watcher = null;

    this.initializeClient();
    this.watchFlowFile();
  }

  initializeClient() {
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth'
      }),
      puppeteer: {
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      },
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
      }
    });

    this.setupEvents();
    this.startWithRetry();
  }

  setupEvents() {
    this.client.on('qr', async (qr) => {
      if (this.isConnected) return;
      try {
        const qrImage = await qrcode.toDataURL(qr);
        this.io.emit('qr', qrImage);
        this.io.emit('status', 'qr');
        console.log('📸 QR Code gerado e enviado ao frontend');
      } catch (err) {
        console.error('Erro ao gerar QR:', err);
      }
    });

    this.client.on('ready', () => {
      console.log('✅ Cliente conectado!');
      this.isConnected = true;
      this.io.emit('status', 'ready');
    });

    this.client.on('authenticated', () => {
      console.log('🔐 Autenticado com sucesso');
      this.io.emit('status', 'authenticated');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ Falha na autenticação:', msg);
      this.io.emit('status', 'auth_failure');
    });

    this.client.on('disconnected', () => {
      console.warn('⚠️ Cliente desconectado. Tentando reconectar...');
      this.io.emit('status', 'disconnected');
      this.isConnected = false;
      setTimeout(() => this.initializeClient(), 5000);
    });

    this.io.on('connection', (socket) => {
      socket.on('updateFlow', (flow) => {
        this.updateFlow(flow);
      });

      socket.on('updateFlows', (flows) => {
        this.flows = flows;
        saveFlows(this.flows);
        this.io.emit('loadedFlows', this.flows);
        console.log('📦 Fluxos atualizados via updateFlows');
      });
    });
  }

  async startWithRetry() {
    try {
      await this.client.initialize();
    } catch (err) {
      console.error('Erro na inicialização:', err);
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Tentando novamente... (${this.retryCount}/${this.maxRetries})`);
        setTimeout(() => this.startWithRetry(), 5000);
      } else {
        console.error('❌ Número máximo de tentativas atingido.');
        this.io.emit('status', 'error');
      }
    }
  }

  async sendMessage(number, message) {
    try {
      const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
      await this.client.sendMessage(chatId, message);
      return true;
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      return false;
    }
  }

  updateFlow(updatedFlow) {
    if (!updatedFlow?.id) {
      console.error('Fluxo inválido: id ausente');
      return;
    }

    const index = this.flows.findIndex(flow => flow.id === updatedFlow.id);
    if (index !== -1) {
      this.flows[index] = updatedFlow;
      saveFlows(this.flows);
      this.io.emit('loadedFlows', this.flows);
      console.log(`✅ Fluxo de id ${updatedFlow.id} atualizado`);
    } else {
      console.error('⚠️ Fluxo não encontrado para atualização');
    }
  }

  watchFlowFile() {
    if (this.watcher) this.watcher.close(); // Evita múltiplos watchers

    this.watcher = fs.watch(fluxoPath, () => {
      console.log('🔄 Fluxos atualizados pelo arquivo');
      this.flows = loadFlows();
      this.io.emit('loadedFlows', this.flows);
    });
  }
}

module.exports = WhatsAppBot;
