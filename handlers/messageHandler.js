import { getAIResponse } from './services/deepseekService';
import { Client, LocalAuth } from 'whatsapp-web.js'; // Exemplo com whatsapp-web.js
import { empresaInfo } from '../data/empresaData';

const SYSTEM_PROMPT = `
Você é um assistente virtual da ${empresaInfo.nome}. 
Siga estas regras:
- Sempre responda em português BR
- Use informações EXATAS da empresa (não invente dados)
- Seja educado e profissional

Dados da empresa para usar nas respostas:
${JSON.stringify(empresaInfo, null, 2)}
`;

export async function handleMessage(message) {
  if (message.isGroupMsg) return;

  try {
    const respostaIA = await getAIResponse({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: message.body
    });
    
    await message.reply(respostaIA);
  } catch (error) {
    await message.reply("❌ Problema ao acessar nossos sistemas. Chame um humano: " + empresaInfo.contato);
  }
}

const client = new Client({
  authStrategy: new LocalAuth()
});

// Evento quando uma mensagem é recebida
client.on('message', async (message) => {
  if (!message.isGroupMsg) { // Só responde em chats privados (opcional)
    const respostaIA = await getAIResponse(message.body);
    await message.reply(respostaIA);
  }
});

export async function handleMessage(message) {
  // =====================
  // 1. FILTROS INICIAIS
  // =====================
  
  // Não responde a mensagens de grupos
  if (message.isGroupMsg) {
    console.log('[Filtro] Ignorando mensagem de grupo');
    return;
  }

  // Não responde a mensagens enviadas pelo próprio bot
  if (message.fromMe) {
    console.log('[Filtro] Ignorando mensagem auto-enviada');
    return;
  }

  // Filtro por comando (ex: só responde se começar com "!")
  if (!message.body.startsWith('!')) {
    console.log('[Filtro] Mensagem sem comando (!)');
    return;
  }

  // Ignora mensagens muito curtas (opcional)
  if (message.body.length < 3) {
    console.log('[Filtro] Mensagem muito curta');
    return await message.reply("❌ Por favor, envie mensagens mais completas.");
  }

  // =====================
  // 2. PROCESSAMENTO DA IA
  // =====================
  try {
    const prompt = message.body.slice(1); // Remove o "!" do comando
    const respostaIA = await getAIResponse(prompt);
    
    // Delay anti-flood (opcional)
    await new Promise(resolve => setTimeout(resolve, 1500));

    await message.reply(respostaIA);

  } catch (error) {
    console.error('[Handler] Erro:', error);
    await message.reply("🔧 Erro ao processar sua mensagem. Tente novamente!");
  }
}

// Filtro por horário comercial (8h-18h)
const now = new Date().getHours();
if (now < 8 || now > 18) {
  await message.reply("⏰ Atendimento das 8h às 18h");
  return;
}

client.initialize();