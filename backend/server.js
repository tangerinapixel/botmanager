// Importações necessárias
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const WhatsAppBot = require('./WhatsAppBot');

// Inicialização do Express e Socket.IO
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Configurações básicas
const port = 5001;
app.use(cors());
app.use(bodyParser.json());

// Caminhos para arquivos e diretórios de dados
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'fluxos.json');

// Garantir que o diretório e o arquivo de dados existam
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ flows: [] }, null, 2));

// Instância do bot do WhatsApp
const bot = new WhatsAppBot(io);

bot.client.on('ready', () => {
    console.log('✅ Dispositivo conectado!');
    io.emit('status', 'ready'); // Envia o status 'ready' ao frontend
});

bot.client.on('disconnected', () => {
    console.log('❌ Dispositivo desconectado!');
    io.emit('status', 'disconnected'); // Envia o status 'disconnected' ao frontend
});

bot.client.on('qr', (qr) => {
    console.log('📲 QR Code gerado!');
    io.emit('qr', qr); // Envia o QR Code ao frontend
});

// Captura de mensagens recebidas e resposta automática
bot.client.on('message', async (msg) => {
  const mensagemRecebida = msg.body.toLowerCase().trim();
  const remetente = msg.from;

  // Ignorar mensagens de grupos
  if (remetente.endsWith('@g.us')) {
    console.log('⚠️ Mensagem recebida de um grupo. O bot não responde a grupos.');
    return;
  }

  console.log(`📩 Mensagem recebida de ${remetente}: ${mensagemRecebida}`);

  // Carregar fluxos salvos
  const data = fs.readFileSync(DATA_FILE, 'utf8');
  const { flows } = JSON.parse(data);

  // Procurar gatilho correspondente
  const fluxoEncontrado = flows.find(fluxo => mensagemRecebida.includes(fluxo.trigger.toLowerCase()));

  if (fluxoEncontrado) {
    const respostas = Array.isArray(fluxoEncontrado.response) ? fluxoEncontrado.response : [fluxoEncontrado.response];
    const respostaSelecionada = respostas[Math.floor(Math.random() * respostas.length)];

    await bot.client.sendMessage(remetente, respostaSelecionada);
    console.log(`✅ Resposta enviada: ${respostaSelecionada}`);
  } else {
    console.log('⚠️ Nenhuma resposta automática encontrada para essa mensagem.');
    await bot.client.sendMessage(remetente, "Desculpe, não entendi. Poderia reformular?");
  }
});

// Rotas da API para o bot
app.post('/api/send-message', async (req, res) => {
  const { number, message } = req.body;
  try {
    const sanitizedNumber = number.includes('@c.us') ? number : `${number}@c.us`;
    await bot.client.sendMessage(sanitizedNumber, message);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

app.post('/api/fluxos', (req, res) => {
  const novosFluxos = req.body.flows;
  try {
    const data = { flows: novosFluxos };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    bot.updateFlows(novosFluxos);
    io.emit('loadedFlows', novosFluxos);
    console.log('✅ Fluxos atualizados via API');
    res.json({ success: true, message: 'Fluxos atualizados com sucesso!', flows: novosFluxos });
  } catch (err) {
    console.error('Erro ao salvar fluxos:', err);
    res.status(500).json({ message: 'Erro ao salvar os fluxos' });
  }
});

app.post('/api/adicionar-fluxo', (req, res) => {
  const novoFluxo = req.body.fluxo;

  if (!novoFluxo || !novoFluxo.trigger || !novoFluxo.response) {
    return res.status(400).json({ message: 'Dados inválidos. São necessários "trigger" e "response".' });
  }

  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    const currentData = JSON.parse(data);
    const flows = currentData.flows;

    novoFluxo.id = Date.now().toString();
    flows.push(novoFluxo);

    fs.writeFileSync(DATA_FILE, JSON.stringify({ flows }, null, 2));
    io.emit('loadedFlows', flows);

    console.log('✅ Novo fluxo adicionado');
    res.json({ message: 'Novo fluxo adicionado com sucesso!', flows });
  } catch (err) {
    console.error('Erro ao salvar o novo fluxo:', err);
    res.status(500).json({ message: 'Erro ao salvar o fluxo' });
  }
});

app.delete('/api/fluxos/:id', (req, res) => {
  const fluxoId = req.params.id;

  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    const currentData = JSON.parse(data);
    const flows = currentData.flows;

    const updatedFlows = flows.filter(fluxo => fluxo.id !== fluxoId);

    fs.writeFileSync(DATA_FILE, JSON.stringify({ flows: updatedFlows }, null, 2));
    io.emit('loadedFlows', updatedFlows);
    console.log(`✅ Fluxo com ID ${fluxoId} excluído com sucesso.`);
    res.json({ success: true, message: 'Fluxo excluído com sucesso!', flows: updatedFlows });
  } catch (err) {
    console.error('Erro ao excluir fluxo:', err);
    res.status(500).json({ message: 'Erro ao excluir o fluxo' });
  }
});

app.get('/api/fluxos', (req, res) => {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    const { flows } = JSON.parse(data);
    res.json({ success: true, flows });
  } catch (err) {
    console.error('Erro ao carregar fluxos:', err);
    res.status(500).json({ success: false, message: 'Erro ao carregar fluxos' });
  }
});

app.get('/api/status', (req, res) => {
  try {
    res.json({ success: true, message: 'Servidor está ativo' });
  } catch (err) {
    console.error('Erro ao verificar status do servidor:', err);
    res.status(500).json({ success: false, message: 'Erro ao verificar status do servidor' });
  }
});

// Servir frontend buildado
app.use(express.static(path.join(__dirname, '../frontend/build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

// Inicializar servidor
httpServer.listen(port, () => {
  console.log(`✅ Servidor rodando na porta ${port}`);
  console.log('🌐 Frontend está sendo servido em http://localhost:3000');
});