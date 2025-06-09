const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');

const GREETINGS_FILE = path.join(__dirname, '../data/greetings.json');
const GREETED_FILE = path.join(__dirname, '../data/greeted.json');

function loadGreetings() {
  return JSON.parse(fs.readFileSync(GREETINGS_FILE, 'utf8')).greetings;
}

function saveGreetings(greetings) {
  fs.writeFileSync(GREETINGS_FILE, JSON.stringify({ greetings }, null, 2));
}

function loadGreeted() {
  return JSON.parse(fs.readFileSync(GREETED_FILE, 'utf8')).greeted;
}

function saveGreeted(greetedList) {
  fs.writeFileSync(GREETED_FILE, JSON.stringify({ greeted: greetedList }, null, 2));
}

async function enviarSaudacaoSeNecessario(msg, client, saudacaoAtiva) {
  if (!saudacaoAtiva) return;

  const remetente = msg.from;
  const greetings = loadGreetings();
  const greetedList = loadGreeted();

  if (!greetedList.includes(remetente) && greetings.length > 0) {
    const greeting = greetings[0];
    const contato = await msg.getContact(); // ✅ CORRETO AQUI
    const nome = contato.pushname || contato.name || 'amigo';
    const saudacaoPersonalizada = greeting.message.replace(/{{nome}}/gi, nome);

    if (greeting.imageUrl) {
      const imagePath = path.join(__dirname, '../', greeting.imageUrl);
      const media = MessageMedia.fromFilePath(imagePath);
      await client.sendMessage(remetente, media, { caption: saudacaoPersonalizada });
    } else {
      await client.sendMessage(remetente, saudacaoPersonalizada);
    }

    greetedList.push(remetente);
    saveGreeted(greetedList);
    console.log(`✅ Saudação enviada para ${remetente}`);
  } else {
    console.log(`⏩ Saudação já enviada para ${remetente}`);
  }
}

module.exports = {
  loadGreetings,
  saveGreetings,
  enviarSaudacaoSeNecessario
};
