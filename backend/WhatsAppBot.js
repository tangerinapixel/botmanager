// backend/src/services/whatsappBot.js
const { Client, LocalAuth } = require('whatsapp-web.js');

class WhatsAppBot {
  constructor(io) {
    this.io = io;
    
    // Configuração do cliente WhatsApp
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: [
          '--headless',
          '--disable-gpu',
          '--no-sandbox',
          '--disable-software-rasterizer',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process'
        ]
      }
    });

    // Iniciar cliente
    this.client.initialize();
  }
}

module.exports = WhatsAppBot;