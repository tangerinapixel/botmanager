// backend/src/services/whatsappBot.js
const { Client, LocalAuth } = require('whatsapp-web.js');

class WhatsAppBot {
  constructor(io) {
    this.io = io;
    
    // Configuração do cliente WhatsApp
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: false,  // Importante: isso faz com que o Chromium abra visualmente
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      }
    });

    // Iniciar cliente
    this.client.initialize();
  }
}

module.exports = WhatsAppBot;