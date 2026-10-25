const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const { loadFlows, matchFluxo } = require('./fluxoService');
const { jaRespondeuRecentemente, registrarResposta } = require('./historicoService');
const delay = require('../utils/delay');
const { processarMensagemConversacional } = require('../services/ai/conversationalAiService');
const { enviarSaudacaoSeNecessario } = require('./saudacaoService');
const { formatPhoneNumber } = require('../utils/logger');

const processingMessageIds = new Set();

// 1. MAPAS PARA O AGRUPADOR (MANTÊM A MEMÓRIA TEMPORÁRIA DE MENSAGENS ONLINE)
const mensagensAcumuladas = new Map();
const timersDeResposta = new Map();
const contatosOcupados = new Set(); // Evita dupla resposta concorrente enquanto gera/envia

const PALAVRAS_CHAVE_BOT = [
    'assistente virtual', 'atendimento automático', 'atendimento virtual',
    'robô de atendimento', 'inteligência artificial', 'chatbot', 'digite uma opção',
    'enviada automaticamente', 'não responda esta mensagem', 'Banco BV',
];

/**
 * FUNÇÃO PRINCIPAL: Decide entre processamento imediato (offline) ou agrupado (online).
 */
async function processarMensagem(msg, client, tempoExpiracaoMs, saudacaoAtiva, respostasAtivas, iaAtiva, handleCriticalClientError = () => {}, isOfflineMessage = false, io = null) {
    try {
        // Validações de segurança básicas
        if (!msg || !msg.id || !msg.id.id) return;
        const messageId = msg.id.id;
        
        if (processingMessageIds.has(messageId)) return;
        processingMessageIds.add(messageId);
        setTimeout(() => { processingMessageIds.delete(messageId); }, 20000);

        if (msg.fromMe || msg.type !== 'chat' || !msg.from || typeof msg.from !== 'string') return;
        if (msg.from.endsWith('@g.us') || msg.from.endsWith('@broadcast') || msg.from.endsWith('@newsletter') || msg.from === 'status@broadcast' || msg.from === '0@c.us' || msg.from.startsWith('0@')) return;
        if (!msg.body || typeof msg.body !== 'string') return;

        const remetente = msg.from;
        const textoAtual = msg.body;

        // --- CENÁRIO A: VARREDURA OFFLINE (Responde na hora para limpar a fila) ---
        if (isOfflineMessage) {
            console.log(`[Offline Scan] Respondendo imediatamente pendência de: ${remetente}`);
            return await executarAcaoDeResposta(msg, client, textoAtual, tempoExpiracaoMs, saudacaoAtiva, respostasAtivas, iaAtiva, true, io);
        }

        // --- CENÁRIO B: MENSAGEM EM TEMPO REAL (Usa o agrupador para parecer humano) ---
        let conversaAnterior = mensagensAcumuladas.get(remetente) || "";
        let conversaNova = conversaAnterior + (conversaAnterior ? "\n" : " ") + textoAtual;
        mensagensAcumuladas.set(remetente, conversaNova);

        // Se o bot já está respondendo a este remetente, não agenda novo timer.
        // A lógica do final da resposta em execução pegará as novas mensagens acumuladas de uma vez.
        if (contatosOcupados.has(remetente)) {
            console.log(`[Agrupador] Contato ${remetente} está ocupado. Nova mensagem acumulada na fila.`);
            return;
        }

        // Se o cliente enviar outra mensagem, cancelamos o timer anterior e iniciamos um novo
        if (timersDeResposta.has(remetente)) {
            clearTimeout(timersDeResposta.get(remetente));
        }

        // Aguarda 3.5 segundos de silêncio do cliente antes de processar tudo junto
        const timer = setTimeout(async () => {
            timersDeResposta.delete(remetente);
            await gerenciarFilaDeResposta(msg, client, remetente, tempoExpiracaoMs, saudacaoAtiva, respostasAtivas, iaAtiva, io);
        }, 3500); 

        timersDeResposta.set(remetente, timer);

    } catch (err) {
        console.error(`[Erro Geral] Erro ao processar mensagem de ${msg?.from || 'desconhecido'}:`, err.message);
        // PASSO 5 FIX: Desacopla erros de lógica de negócio do ciclo de vida da conexão do WhatsApp.
        // Falhas de API externa (Gemini), formatação ou mídias NÃO devem derrubar a sessão do WhatsApp.
        const errMsg = (err.message || '').toLowerCase();
        const isFatalProtocolError = errMsg.includes('target closed') ||
                                     errMsg.includes('session closed') ||
                                     errMsg.includes('browser has disconnected') ||
                                     errMsg.includes('protocol error');

        if (isFatalProtocolError && typeof handleCriticalClientError === 'function') {
            handleCriticalClientError(err, `processarMensagem para ${msg?.from || 'desconhecido'}`);
        } else if (io) {
            const remetenteErro = msg?.from;
            const ehRestrito = remetenteErro && (
                remetenteErro.endsWith('@g.us') ||
                remetenteErro.endsWith('@broadcast') ||
                remetenteErro.endsWith('@newsletter') ||
                remetenteErro === 'status@broadcast' ||
                remetenteErro === '0@c.us' ||
                remetenteErro.startsWith('0@')
            );
            if (!ehRestrito) {
                io.emit('system-log', {
                    id: Date.now(),
                    type: 'warning',
                    action: 'Processamento de Mensagem',
                    message: `Aviso no processamento de mensagem de ${remetenteErro || 'contato'}: ${err.message}`,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }
}

/**
 * Função auxiliar que gerencia a ocupação do remetente e o pós-processamento de novas mensagens.
 */
async function gerenciarFilaDeResposta(msg, client, remetente, tempoExpiracaoMs, saudacaoAtiva, respostasAtivas, iaAtiva, io = null) {
    contatosOcupados.add(remetente);

    try {
        const textoCompleto = mensagensAcumuladas.get(remetente);
        mensagensAcumuladas.delete(remetente);

        console.log(`[Agrupador] Processando bloco de mensagens de ${remetente}: "${textoCompleto.length > 100 ? textoCompleto.substring(0, 100) + '...' : textoCompleto}"`);
        await executarAcaoDeResposta(msg, client, textoCompleto, tempoExpiracaoMs, saudacaoAtiva, respostasAtivas, iaAtiva, false, io);
    } catch (error) {
        console.error(`[Agrupador] Erro durante a execução da resposta para ${remetente}:`, error.message);
    } finally {
        contatosOcupados.delete(remetente);

        // Se novas mensagens chegaram enquanto o bot estava processando/enviando a resposta anterior
        if (mensagensAcumuladas.has(remetente)) {
            console.log(`[Agrupador] Novas mensagens chegaram para ${remetente} durante a resposta. Re-agendando em 2.5 segundos...`);
            
            if (timersDeResposta.has(remetente)) {
                clearTimeout(timersDeResposta.get(remetente));
            }

            const timer = setTimeout(async () => {
                timersDeResposta.delete(remetente);
                await gerenciarFilaDeResposta(msg, client, remetente, tempoExpiracaoMs, saudacaoAtiva, respostasAtivas, iaAtiva, io);
            }, 2500);

            timersDeResposta.set(remetente, timer);
        }
    }
}

function verificarMensagemSpamOuCortesia(texto) {
    const textoLimpo = (texto || '').toLowerCase().trim();
    
    // Ignora silenciosamente apenas mensagens vazias ou ruído de pontuação isolada (ex: ".", "-", ",")
    const ehApenasPontuacao = /^[.,\-_/\\;:+*=~^`'"]+$/.test(textoLimpo);
    if (!textoLimpo || (textoLimpo.length < 2 && !/^[a-z0-9?]$/i.test(textoLimpo)) || ehApenasPontuacao) {
        return { isSpam: true, resposta: "" };
    }
    
    return { isSpam: false };
}

/**
 * FUNÇÃO DE EXECUÇÃO: Contém a lógica de negócio (Saudação -> Anti-Loop -> Fluxo -> IA)
 */
async function executarAcaoDeResposta(msg, client, texto, tempoExpiracaoMs, saudacaoAtiva, respostasAtivas, iaAtiva, isOffline, io = null) {
    const remetente = msg.from;
    if (!remetente || typeof remetente !== 'string' || remetente.endsWith('@broadcast') || remetente.endsWith('@newsletter') || remetente.endsWith('@g.us') || remetente === '0@c.us' || remetente.startsWith('0@')) {
        console.warn(`[AcaoDeResposta] ⚠️ Abortando resposta para remetente incompatível com protocolo: ${remetente}`);
        return;
    }
    const textoFormatado = texto.toLowerCase().trim();

    // Resolve o label do contato (número real + nome se disponível) — usado apenas nos logs
    let contatoLabel = formatPhoneNumber(remetente); // fallback imediato
    if (io) {
        try {
            const contact = await client.getContactById(remetente).catch(() => null);
            if (contact) {
                const phoneJid =
                    (contact.id?.server === 'c.us' ? contact.id._serialized : null) ||
                    (contact.number && contact.number.length >= 6 ? contact.number : null);
                const phoneFormatted = phoneJid
                    ? formatPhoneNumber(phoneJid)
                    : formatPhoneNumber(remetente);
                const name = contact.name || contact.pushname || '';
                contatoLabel = name ? `${name} ${phoneFormatted}` : phoneFormatted;
            }
        } catch (_) { /* mantém o fallback */ }
    }

    // Helper local para emitir logs sem repetição de código
    const emitLog = (type, action, message) => {
        if (io) io.emit('system-log', { id: Date.now(), type, action, message, timestamp: new Date().toISOString() });
    };

    // 1. Saudação (Apenas se o bot estiver online para não repetir em mensagens antigas)
    if (!isOffline) {
        const saudacaoEnviada = await enviarSaudacaoSeNecessario(msg, client, saudacaoAtiva);
        if (saudacaoEnviada) return;
    }

    // 2. Filtro Anti-Loop
    const isBotMessage = PALAVRAS_CHAVE_BOT.some(keyword => textoFormatado.includes(keyword));
    if (isBotMessage) return;

    // 3. Decisão: Fluxo ou IA
    let fluxo = null;
    if (respostasAtivas) {
        const flows = loadFlows();
        fluxo = flows.find(f => matchFluxo(f, textoFormatado));
    }

    if (fluxo) {
        // --- LÓGICA DE FLUXO ---
        if (jaRespondeuRecentemente(remetente, fluxo.trigger, tempoExpiracaoMs)) return;

        const respostas = Array.isArray(fluxo.response) ? fluxo.response : fluxo.response.split('||').map(r => r.trim());
        const respostaFinal = respostas[Math.floor(Math.random() * respostas.length)];

        try {
            if (fluxo.imageUrl) {
                const media = await MessageMedia.fromUrl(fluxo.imageUrl);
                await client.sendMessage(remetente, media, { caption: respostaFinal });
            } else {
                await enviarComoHumano(client, remetente, respostaFinal);
            }
            registrarResposta(remetente, fluxo.trigger);
            // Log de fluxo ativado
            const preview = respostaFinal.length > 40 ? respostaFinal.substring(0, 40) + '…' : respostaFinal;
            emitLog('success', isOffline ? 'Fluxo Ativado (Offline)' : 'Fluxo Ativado', `Para ${contatoLabel}: gatilho "${fluxo.trigger}" → "${preview}"`);
        } catch (mediaError) {
            console.error("[Fluxo] Erro ao enviar mídia, tentando apenas texto.", mediaError.message);
            await enviarComoHumano(client, remetente, respostaFinal);
            emitLog('success', isOffline ? 'Fluxo Ativado (Offline)' : 'Fluxo Ativado', `Para ${contatoLabel}: "${respostaFinal.length > 40 ? respostaFinal.substring(0, 40) + '…' : respostaFinal}"`);
        }

    } else if (iaAtiva) {
        // --- LÓGICA DE IA CONVERSACIONAL INTELIGENTE (Gemini + Memória Persistente) ---
        const filtroSpam = verificarMensagemSpamOuCortesia(texto);
        if (filtroSpam.isSpam) {
            if (filtroSpam.resposta) {
                await enviarComoHumano(client, remetente, filtroSpam.resposta);
                emitLog('warning', 'Mensagem Ignorada', `Cortesia de ${contatoLabel} filtrada.`);
            }
            return;
        }

        try {
            let contactName = '';
            try {
                const contact = await client.getContactById(remetente).catch(() => null);
                if (contact) {
                    contactName = contact.name || contact.pushname || '';
                }
            } catch (_) {}

            const respostaIA = await processarMensagemConversacional(remetente, texto, { name: contactName });
            if (respostaIA && respostaIA.trim()) {
                await enviarComoHumano(client, remetente, respostaIA);
                const previewIA = respostaIA.length > 40 ? respostaIA.substring(0, 40) + '…' : respostaIA;
                emitLog('success', isOffline ? 'IA Respondeu (Offline)' : 'IA Respondeu', `Para ${contatoLabel}: "${previewIA}"`);
            }
        } catch (iaError) {
            console.error("[IA] Erro Gemini:", iaError.message);
            if (remetente && !remetente.endsWith('@broadcast') && !remetente.endsWith('@newsletter') && !remetente.endsWith('@g.us')) {
                await client.sendMessage(remetente, "Tive um pequeno problema técnico. Pode repetir, por favor?").catch(() => {});
            }
            emitLog('warning', isOffline ? 'IA Respondeu (Offline)' : 'IA Respondeu', `Erro Gemini para ${contatoLabel}: ${iaError.message}`);
        }
    }
}

/**
 * FUNÇÃO HUMANA: Simulação de digitação com segurança reforçada (Modo Pós-Restrição)
 */
async function enviarComoHumano(client, numero, texto) {
    if (!numero || typeof numero !== 'string' || numero.endsWith('@broadcast') || numero.endsWith('@newsletter') || numero.endsWith('@g.us') || numero === '0@c.us' || numero.startsWith('0@')) {
        console.warn(`[Humanize] ⚠️ Tentativa de envio para JID inválido ou restrito (${numero}). Abortando envio para proteger a sessão.`);
        return;
    }
    const inicio = Date.now();
    try {
        const chat = await client.getChatById(numero);
        await chat.sendSeen(); // Marca a conversa como lida no celular
        
        // Configuração ágil e natural de digitação humana
        const baseLeitura = 800; 
        const porLetra = Math.min(texto.length * 15, 2500); 
        const aleatorio = Math.floor(Math.random() * 800);
        const tempoTotal = Math.min(baseLeitura + porLetra + aleatorio, 4200);

        await chat.sendStateTyping(); 
        
        console.log(`[Humanize] ⏳ Digitante para ${numero}: ${texto.length} chars | ${(tempoTotal / 1000).toFixed(2)}s`);

        await new Promise(resolve => setTimeout(resolve, tempoTotal));
        await chat.clearState(); 
        
        await client.sendMessage(numero, texto);
        
        const fim = Date.now();
        console.log(`[Humanize] ✅ Enviada em ${((fim - inicio) / 1000).toFixed(2)}s`);

    } catch (err) {
        console.error("[Humanize] ❌ Erro na simulação. Enviando direto.", err.message);
        if (numero && !numero.endsWith('@broadcast') && !numero.endsWith('@newsletter') && !numero.endsWith('@g.us')) {
            await client.sendMessage(numero, texto).catch(() => {});
        }
    }
}

module.exports = { processarMensagem };