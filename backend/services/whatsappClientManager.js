// backend/services/whatsappClientManager.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');
const { OFFLINE_CONFIG } = require('../config.js');
const { ts, formatPhoneNumber } = require('../utils/logger');
const WWebJSPatcher = require('../utils/wwebjsPatcher');
const DripQueueManager = require('./DripQueueManager');
const MessageQueueService = require('./MessageQueueService');
const DiskQueuePersistence = require('./DiskQueuePersistence');
const lidPhoneStore = require('../utils/lidPhoneStore');

class WhatsAppClientManager {
    constructor(io, handlers, configRefs) {
        this.io = io;
        this.handlers = handlers;
        this.configRefs = configRefs;

        this.waClientState = 'DISCONNECTED';
        this.lastQrCode = null;
        this.isInitializing = false;

        // Propriedades para resiliência, concorrência e gerenciamento de estado
        this.readyCallbacks = [];
        this.bootTime = Date.now();
        this.connectedAt = null;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectTimeout = null;
        this.watchdogInterval = null;
        this.watchdogFailures = 0; // Contador de falhas consecutivas do watchdog
        this.isDisconnecting = false; // Flag para ignorar erros e auto-reconexão no logout
        this.loadingProgress = 0; // Armazena percentual de carregamento/sincronização do WhatsApp
        this.isSyncing = false; // Flag para inibir falsos positivos do Watchdog durante sincronização/deep scan
        this.authReadyTimeout = null; // Watchdog de transição: protege contra travamentos entre AUTHENTICATED e READY
        this.authReadyRetries = 0; // Contador de tentativas de recuperação suave
        this._authenticatedAt = null; // Instante do último 'authenticated' (diagnóstico do handshake)
        this._attachInFlight = null; // { startedAt, promise } da injeção de listeners em andamento
        this._ensureListenersInFlight = null; // Promise da verificação/reparo de listeners em andamento
        this._listenerRepairFailures = 0; // Reparos consecutivos de listeners que falharam (watchdog)

        this.queuePersistence = new DiskQueuePersistence();
        this.messageQueue = new MessageQueueService({
            concurrency: 1,
            cooldownMs: 3000,
            persistenceAdapter: this.queuePersistence
        });

        this.messageQueue.setWorker(async (payload) => {
            const { msg, isOffline } = payload;
            if (!msg) return;

            await this.handlers.processarMensagem(
                msg,
                this.client,
                this.configRefs.tempoExpiracaoMsRef.value,
                this.configRefs.saudacaoAtivaRef.value,
                this.configRefs.respostasAtivasRef.value,
                this.configRefs.iaAtivaRef.value,
                (err, origin) => this._handleCriticalClientError(err, origin),
                Boolean(isOffline),
                this.io
            );

            // Marca o chat como visto somente após a execução segura do fluxo
            if (isOffline && msg.from) {
                try {
                    const chat = (typeof msg.getChat === 'function')
                        ? await msg.getChat()
                        : (this.client && typeof this.client.getChatById === 'function' ? await this.client.getChatById(msg.from) : null);
                    if (chat && typeof chat.sendSeen === 'function') {
                        await chat.sendSeen();
                    }
                } catch (_) {}
            }
        });

        // Mantém compatibilidade reversa com referências existentes
        this.dripQueue = this.messageQueue;

        // Definindo o caminho absoluto unificado para a pasta de autenticação.
        // Em desenvolvimento (dev), mantemos a pasta local no projeto para visibilidade.
        // Em produção (produção/empacotado), usamos obrigatoriamente a pasta AppData do usuário (USER_DATA_PATH) para evitar falhas de permissão de escrita.
        this.pastaAuth = process.env.USER_DATA_PATH
            ? path.join(process.env.USER_DATA_PATH, '.wwebjs_auth')
            : path.join(__dirname, '..', '.wwebjs_auth');

        // Caminho absoluto unificado para o cache local de versões estáveis do WhatsApp Web
        const localCachePath = path.join(__dirname, '..', '.wwebjs_cache');
        const userCachePath = process.env.USER_DATA_PATH
            ? path.join(process.env.USER_DATA_PATH, '.wwebjs_cache')
            : null;
        this.pastaCache = (userCachePath && fs.existsSync(path.join(userCachePath, '2.3000.1043584437.html')))
            ? userCachePath
            : localCachePath;

        // client é null até initialize() ser chamado — lazy init
        this.client = null;

        // PID do processo Chrome lançado pelo Puppeteer — usado para kill cirúrgico
        // (evita matar o Chrome do usuário por nome de processo)
        this._browserPid = null;
    }

    _clearSingletonLock() {
        // FIX #1: Matar APENAS o processo Chrome específico do Puppeteer pelo PID salvo.
        // Isso evita fechar o Chrome do usuário (que pode ter abas e dados abertos).
        if (this._browserPid) {
            try {
                const { execSync } = require('child_process');
                execSync(`cmd /c taskkill /F /PID ${this._browserPid} /T`, { stdio: 'ignore' });
                console.log(`[System] Processo Chrome do Puppeteer (PID ${this._browserPid}) encerrado preventivamente.`);
            } catch (_) {
                // Ignorar — processo pode já ter terminado
            }
            this._browserPid = null;
        }

        try {
            const lockPath = path.join(this.pastaAuth, 'session', 'SingletonLock');
            if (fs.existsSync(lockPath)) {
                fs.unlinkSync(lockPath);
                console.log(`[System] Arquivo SingletonLock removido preventivamente.`);
            }
        } catch (err) {
            console.warn(`[System] Aviso ao remover SingletonLock: ${err.message}`);
        }
    }

    _createClient() {
        const getChromePath = () => {
            const paths = [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
                'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
            ];
            for (const p of paths) {
                if (fs.existsSync(p)) return p;
            }
            return null;
        };

        const chromePath = getChromePath();
        if (!chromePath) {
            console.warn('[WhatsAppClientManager] ⚠️ Navegador Chrome/Edge não encontrado nos locais padrão. Usando Chromium interno.');
        }

        const puppeteerConfig = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                // PASSO 4 FIX: Inibe suspensão de timers e WebSocket em segundo plano no Windows
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-extensions',
                '--disable-default-apps',
                '--mute-audio',
                '--no-default-browser-check',
                '--log-level=3'
            ]
        };
        if (chromePath) {
            puppeteerConfig.executablePath = chromePath;
        }

        this._clearSingletonLock();

        this.client = new Client({
            authStrategy: new LocalAuth({ dataPath: this.pastaAuth }),
            bypassCSP: true,
            // User-Agent moderno e padrão para evitar anomalias de fingerprint
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
            puppeteer: puppeteerConfig,
            authTimeoutMs: 0 // Timeout desabilitado: permite sync offline massivo sem abortar o Chrome
        });

        this._attachInFlight = null;
        this._ensureListenersInFlight = null;
        this._listenerRepairFailures = 0;
        this._authenticatedAt = null;
        this._instrumentAttachEventListeners();
        this._setupClientEventListeners();
    }

    /**
     * Envolve client.attachEventListeners() para torná-lo idempotente e verificável.
     * Toda chamada (da lib no handshake natural, do watchdog ou do reparo) passa por aqui.
     * Um marcador é gravado na PÁGINA somente quando a injeção conclui com sucesso; como vive no
     * documento, ele desaparece sozinho em reload/navegação, sinalizando que os listeners se perderam.
     */
    _instrumentAttachEventListeners() {
        const client = this.client;
        if (!client || client.__attachInstrumented || typeof client.attachEventListeners !== 'function') {
            return;
        }

        const ATTACH_STALE_MS = 20000;
        const original = client.attachEventListeners.bind(client);
        client.__attachInstrumented = true;

        client.attachEventListeners = async (...args) => {
            const page = client.pupPage;
            const tag = ts();

            // Já injetado neste documento: não duplica listeners
            if (page && !page.isClosed()) {
                const alreadyAttached = await page.evaluate(() => window.__botMsgListenersOk === true).catch(() => false);
                if (alreadyAttached) {
                    console.log(`[${tag}] [Listeners] Injeção ignorada: listeners de mensagens já ativos neste documento.`);
                    return;
                }
            }

            // Injeção concorrente recente: reaproveita em vez de duplicar (uma tentativa travada há mais de 20s é descartada)
            if (this._attachInFlight && (Date.now() - this._attachInFlight.startedAt) < ATTACH_STALE_MS) {
                return this._attachInFlight.promise;
            }

            const entry = { startedAt: Date.now(), promise: null };
            entry.promise = (async () => {
                await original(...args);
                if (page && !page.isClosed()) {
                    await page.evaluate(() => { window.__botMsgListenersOk = true; });
                }
                const sinceAuth = this._authenticatedAt ? `${((Date.now() - this._authenticatedAt) / 1000).toFixed(1)}s após authenticated` : 'sem referência de authenticated';
                console.log(`[${ts()}] [Listeners] ✅ attachEventListeners concluído em ${Date.now() - entry.startedAt}ms (${sinceAuth}).`);
            })();
            this._attachInFlight = entry;

            try {
                return await entry.promise;
            } finally {
                if (this._attachInFlight === entry) {
                    this._attachInFlight = null;
                }
            }
        };
    }

    /**
     * Garante, com verificação real, que o listener de mensagens (Msg.on('add')) está ativo no navegador.
     * Se não estiver, completa a injeção de utilitários (quando incompleta) e injeta os listeners.
     * @param {string} origem Identificador de quem solicitou (para logs)
     * @returns {Promise<boolean>} true se os listeners estão ativos ao final
     */
    _ensureMessageListeners(origem = 'desconhecida') {
        if (this._ensureListenersInFlight) {
            return this._ensureListenersInFlight;
        }

        const run = async () => {
            const client = this.client;
            if (!client || !client.pupPage || client.pupPage.isClosed()) {
                console.warn(`[${ts()}] [Listeners] (${origem}) Página indisponível; verificação de listeners adiada.`);
                return false;
            }
            const page = client.pupPage;

            try {
                const probe = await page.evaluate(() => ({
                    marker: window.__botMsgListenersOk === true,
                    modelFn: Boolean(window.WWebJS && typeof window.WWebJS.getMessageModel === 'function')
                }));

                if (probe.marker && probe.modelFn) {
                    return true;
                }

                console.warn(`[${ts()}] [Listeners] ⚠️ (${origem}) Listeners de mensagens NÃO confirmados (marcador=${probe.marker}, utils=${probe.modelFn}). Iniciando reparo...`);

                // Utilitários ausentes/incompletos (ex.: handshake interrompido após window.WWebJS = {}): reinjeta
                if (!probe.modelFn) {
                    try {
                        const { LoadUtils } = require('whatsapp-web.js/src/util/Injected/Utils');
                        await page.evaluate(LoadUtils);
                        await WWebJSPatcher.applyChatsPatch(client).catch(() => {});
                        console.log(`[${ts()}] [Listeners] (${origem}) Utilitários WWebJS reinjetados.`);
                    } catch (utilsErr) {
                        console.error(`[${ts()}] [Listeners] (${origem}) Falha ao reinjetar utilitários WWebJS: ${utilsErr.message}`);
                    }
                }

                if (!probe.marker) {
                    let timer = null;
                    const timeoutPromise = new Promise((_, reject) => {
                        timer = setTimeout(() => reject(new Error('Timeout (20s) em attachEventListeners')), 20000);
                    });
                    try {
                        await Promise.race([client.attachEventListeners(), timeoutPromise]);
                    } finally {
                        clearTimeout(timer);
                    }
                }

                const after = await page.evaluate(() => window.__botMsgListenersOk === true && Boolean(window.WWebJS && typeof window.WWebJS.getMessageModel === 'function'));
                if (after) {
                    console.log(`[${ts()}] [Listeners] ✅ (${origem}) Listeners de mensagens restaurados e confirmados.`);
                    this.io.emit('system-log', { id: Date.now(), type: 'info', action: 'Tempo Real', message: 'Listeners de mensagens restaurados com sucesso.', timestamp: new Date().toISOString() });
                    return true;
                }

                console.error(`[${ts()}] [Listeners] 🚨 (${origem}) Reparo concluído, mas a confirmação dos listeners falhou.`);
                return false;
            } catch (err) {
                console.error(`[${ts()}] [Listeners] 🚨 (${origem}) Erro ao verificar/reparar listeners: ${err.message}`);
                this.io.emit('system-log', { id: Date.now(), type: 'warning', action: 'Tempo Real', message: `Falha ao ativar listeners de mensagens: ${err.message}`, timestamp: new Date().toISOString() });
                return false;
            }
        };

        const OVERALL_TIMEOUT_MS = 40000;
        let overallTimer = null;
        const overallTimeout = new Promise((resolve) => {
            overallTimer = setTimeout(() => {
                console.error(`[${ts()}] [Listeners] 🚨 (${origem}) Verificação de listeners excedeu ${OVERALL_TIMEOUT_MS / 1000}s. Abortando espera.`);
                resolve(false);
            }, OVERALL_TIMEOUT_MS);
        });

        const promise = Promise.race([run(), overallTimeout]).finally(() => {
            clearTimeout(overallTimer);
            if (this._ensureListenersInFlight === promise) {
                this._ensureListenersInFlight = null;
            }
        });
        this._ensureListenersInFlight = promise;
        return promise;
    }



    async _deepScanForUnreadMessages() {
        this.isSyncing = true;
        try {
            console.log('[Deep Scan] Iniciando varredura profunda de chats não lidos...');
            this.io.emit('system-log', { id: Date.now(), type: 'info', action: 'Leitura de Mensagens', message: 'Iniciando varredura profunda de chats não lidos...', timestamp: new Date().toISOString() });

            if (!this.client || !this.client.pupPage || this.client.pupPage.isClosed()) {
                console.warn('[Deep Scan] Página do Puppeteer não está pronta. Varredura cancelada.');
                this.io.emit('system-log', { id: Date.now(), type: 'warning', action: 'Leitura de Mensagens', message: 'Varredura cancelada: página do Puppeteer não está pronta.', timestamp: new Date().toISOString() });
                return;
            }

        // Aplica o patch para tratar falhas em chats individuais
        await WWebJSPatcher.applyChatsPatch(this.client);

        let unreadJids = [];
        let usedFallback = false;

        // Estratégia 1: Filtro no lado do Chromium (mais rápido, sem tráfego via Puppeteer bridge)
        try {
            const browserResult = await this.client.pupPage.evaluate(() => {
                try {
                    let models = null;
                    try {
                        const collections = window.require('WAWebCollections');
                        if (collections && collections.Chat) {
                            if (typeof collections.Chat.getModelsArray === 'function') {
                                models = collections.Chat.getModelsArray();
                            }
                            if ((!models || !Array.isArray(models)) && Array.isArray(collections.Chat.models)) {
                                models = collections.Chat.models;
                            }
                        }
                    } catch (_) {}

                    if (!models || !Array.isArray(models)) {
                        try {
                            const chatCol = window.require('WAWebChatCollection');
                            const colInst = chatCol && (chatCol.ChatCollection || chatCol.default || chatCol);
                            if (colInst) {
                                if (typeof colInst.getModelsArray === 'function') {
                                    models = colInst.getModelsArray();
                                } else if (Array.isArray(colInst.models)) {
                                    models = colInst.models;
                                }
                            }
                        } catch (_) {}
                    }

                    if (!models || !Array.isArray(models)) {
                        try {
                            const chatStore = window.Store && window.Store.Chat;
                            if (chatStore) {
                                if (typeof chatStore.getModelsArray === 'function') {
                                    models = chatStore.getModelsArray();
                                } else if (Array.isArray(chatStore.models)) {
                                    models = chatStore.models;
                                }
                            }
                        } catch (_) {}
                    }

                    if (!models || !Array.isArray(models)) return null;

                    return models
                        .filter(c => c && c.unreadCount > 0 && !c.isGroup && !c.isBroadcast)
                        .map(c => c.id && c.id._serialized)
                        .filter(jid => jid && jid !== '0@c.us' && !jid.startsWith('0@') && !jid.endsWith('@broadcast') && !jid.endsWith('@newsletter') && !jid.endsWith('@g.us'));
                } catch (e) {
                    return null; // Sinaliza fallback necessário
                }
            });

            if (browserResult !== null) {
                unreadJids = browserResult;
                console.log(`[Deep Scan] Estratégia 1 (WAWebCollections/Store) retornou ${unreadJids.length} JID(s) não lidos.`);
            } else {
                usedFallback = true;
            }
        } catch (err) {
            console.warn('[Deep Scan] Estruturas diretas do browser não disponíveis. Usando fallback nativo:', err.message);
            usedFallback = true;
        }

        // Estratégia 2: Fallback — usa client.getChats() (API nativa blindada pelo patcher)
        if (usedFallback) {
            console.log('[Deep Scan] Usando Estratégia 2 (client.getChats) como fallback...');
            try {
                const WWebJSPatcher = require('../utils/wwebjsPatcher');
                await WWebJSPatcher.applyChatsPatch(this.client);
                const chats = await this.client.getChats();
                const validChats = Array.isArray(chats) ? chats : [];
                unreadJids = validChats
                    .filter(c => c && c.unreadCount > 0 && !c.isGroup && !c.isBroadcast && c.id?._serialized && !c.id._serialized.endsWith('@broadcast') && !c.id._serialized.endsWith('@newsletter') && !c.id._serialized.endsWith('@g.us'))
                    .map(c => c.id._serialized)
                    .filter(jid => jid && jid !== '0@c.us' && !jid.startsWith('0@') && !jid.endsWith('@broadcast') && !jid.endsWith('@newsletter') && !jid.endsWith('@g.us'));
                console.log(`[Deep Scan] Estratégia 2 (getChats) retornou ${unreadJids.length} JID(s) não lidos.`);
            } catch (err2) {
                console.error('[Deep Scan] Ambas as estratégias falharam:', err2.message);
                this.io.emit('system-log', { id: Date.now(), type: 'warning', action: 'Leitura de Mensagens', message: `Varredura abortada: ${err2.message}`, timestamp: new Date().toISOString() });
                return;
            }
        }

        console.log(`[Deep Scan] Total de chats privados não lidos a processar: ${unreadJids.length}`);
        this.io.emit('system-log', { id: Date.now(), type: 'info', action: 'Leitura de Mensagens', message: `Encontrados ${unreadJids.length} chats não lidos para processar.`, timestamp: new Date().toISOString() });

        const maxHoursOld = (OFFLINE_CONFIG && OFFLINE_CONFIG.MAX_HOURS_OLD) || 72;
        const maxAgeLimitMs = maxHoursOld * 60 * 60 * 1000;

        for (const jid of unreadJids) {
            if (this.waClientState !== 'READY') {
                console.log('[Deep Scan] Varredura profunda interrompida: Cliente não está mais READY.');
                break;
            }

            // Proteção estrita contra grupos, canais e transmissões
            if (!jid || typeof jid !== 'string' || jid.endsWith('@broadcast') || jid.endsWith('@newsletter') || jid.endsWith('@g.us') || jid === '0@c.us' || jid.startsWith('0@')) {
                console.warn(`[Deep Scan] Ignorando JID incompatível/restrito na fila: ${jid}`);
                continue;
            }

            try {
                const chat = await this.client.getChatById(jid);
                if (!chat) continue;

                const chatLabel = chat.name || formatPhoneNumber(chat.id._serialized || chat.id.user);
                console.log(`[Deep Scan] Processando chat não lido com ${chatLabel} (${chat.unreadCount} mensagens)...`);

                let messages = [];
                try {
                    messages = await chat.fetchMessages({ limit: chat.unreadCount + 5 });
                } catch (fetchErr) {
                    console.warn(`[Deep Scan] Erro ao buscar com limite, tentando sem limite para: ${chatLabel}`);
                    try {
                        messages = await chat.fetchMessages();
                    } catch (err2) {
                        console.error(`[Deep Scan] Falha total ao buscar mensagens do chat ${chatLabel}:`, err2.message);
                        continue;
                    }
                }

                const mensagensNaoLidas = [];
                let unreadRemaining = chat.unreadCount;
                const agora = Date.now();
                for (let i = messages.length - 1; i >= 0; i--) {
                    if (unreadRemaining <= 0) break;
                    if (!messages[i].fromMe) {
                        const msgAgeMs = agora - (messages[i].timestamp * 1000);
                        if (msgAgeMs <= maxAgeLimitMs) {
                            mensagensNaoLidas.unshift(messages[i]); // Mantém ordem cronológica
                        } else {
                            console.log(`[Deep Scan] Mensagem de ${chatLabel} ignorada por ser muito antiga (${(msgAgeMs / 3600000).toFixed(1)} horas).`);
                        }
                        unreadRemaining--;
                    }
                }

                if (mensagensNaoLidas.length > 0) {
                    const msgFinal = mensagensNaoLidas[mensagensNaoLidas.length - 1];
                    if (msgFinal && msgFinal.from && !msgFinal.from.endsWith('@broadcast') && !msgFinal.from.endsWith('@newsletter') && !msgFinal.from.endsWith('@g.us') && msgFinal.from !== '0@c.us' && !msgFinal.from.startsWith('0@')) {
                        const corposJuntos = mensagensNaoLidas.map(m => m.body).filter(b => typeof b === 'string').join('\n');
                        msgFinal.body = corposJuntos;

                        this.messageQueue.enqueue({
                            id: msgFinal.id?._serialized || `${jid}_${msgFinal.timestamp || Date.now()}`,
                            payload: {
                                msg: msgFinal,
                                isOffline: true,
                                chatLabel
                            }
                        }, chatLabel);
                    } else {
                        console.warn(`[Deep Scan] Descartando mensagem de JID não suportado: ${msgFinal?.from}`);
                    }
                }

                // Delay entre carregamento de chats para aliviar a ponte do Puppeteer e evitar travamentos
                await new Promise(resolve => setTimeout(resolve, 800));

            } catch (error) {
                console.warn(`[Deep Scan] Erro ao processar chat ${jid}:`, error.message);
            }
        }
            console.log('[Deep Scan] Varredura profunda concluída.');
            this.io.emit('system-log', { id: Date.now(), type: 'success', action: 'Leitura de Mensagens', message: 'Varredura profunda concluída com sucesso.', timestamp: new Date().toISOString() });
        } finally {
            this.isSyncing = false;
        }
    }



    onReady(callback) {
        if (typeof callback === 'function') {
            this.readyCallbacks.push(callback);
        }
    }

    async _destroyClient() {
        const timestamp = ts();
        console.log(`[${timestamp}] [_destroyClient] Iniciando destruição completa da instância do cliente.`);

        if (this.authReadyTimeout) {
            clearTimeout(this.authReadyTimeout);
            this.authReadyTimeout = null;
        }
        this.authReadyRetries = 0;

        if (this.watchdogInterval) {
            clearInterval(this.watchdogInterval);
            this.watchdogInterval = null;
        }
        this.watchdogFailures = 0;
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        this.messageQueue.stop();
        this.messageQueue.clear();

        const browserPid = this.client?.pupBrowser?.process()?.pid || this._browserPid;

        if (this.client) {
            try {
                this.client.removeAllListeners();
                if (this.client.pupBrowser) {
                    try {
                        await this.client.pupBrowser.close();
                    } catch (browserErr) {
                        console.warn(`[${timestamp}] [_destroyClient] Aviso ao fechar pupBrowser: ${browserErr.message}`);
                    }
                }
                await this.client.destroy();
                console.log(`[${timestamp}] [_destroyClient] Cliente destroy() executado com sucesso.`);
            } catch (err) {
                console.error(`[${timestamp}] [_destroyClient] Erro ao executar destroy():`, err.message);
            }
            this.client = null;
        }

        // Garante que o processo Chromium e toda a sua árvore de renderers/gpu seja eliminada (evita zumbis)
        if (browserPid) {
            try {
                const { execSync } = require('child_process');
                execSync(`cmd /c taskkill /F /PID ${browserPid} /T`, { stdio: 'ignore' });
                console.log(`[${timestamp}] [_destroyClient] Árvore de processos Chromium (PID ${browserPid}) limpa com sucesso.`);
            } catch (_) {
                // Processo já havia terminado com o pupBrowser.close()
            }
        }
        this._browserPid = null;

        // Limpa qualquer SingletonLock que o Chromium possa ter deixado
        this._clearSingletonLock();

        this.waClientState = 'DISCONNECTED';
        this.lastQrCode = null;
        this.loadingProgress = 0;
        this.isSyncing = false;
        this.isInitializing = false;
        this.isConnecting = false;
        this.connectedAt = null;
        this.io.emit('status', 'disconnected');
    }

    _limparPastaAuth() {
        const timestamp = ts();
        const pasta = this.pastaAuth || path.join(__dirname, '..', '.wwebjs_auth');
        if (fs.existsSync(pasta)) {
            try {
                console.log(`[${timestamp}] Removendo pasta de autenticação: ${pasta}`);
                fs.rmSync(pasta, { recursive: true, force: true });
                console.log(`[${timestamp}] Pasta de autenticação removida com sucesso.`);
            } catch (e) {
                console.warn(`[${timestamp}] Aviso ao remover pasta ${pasta}: ${e.message}`);
            }
        }
    }

    getClient() {
        return this.client;
    }

    // =======================================================
    // 🎯 AQUI: NOVO MÉTODO PARA VERIFICAR A VERSÃO DO WA WEB
    // =======================================================
    async verificarVersao() {
        if (this.waClientState !== 'READY') {
            console.warn('[WA Version] O cliente WhatsApp não está pronto. Não foi possível verificar a versão.');
            return;
        }

        try {
            const versao = await this.client.getWWebVersion();
            console.log(`[WA Version] A versão atual do WhatsApp Web é: ${versao}`);
        } catch (error) {
            console.error('[WA Version] Ocorreu um erro ao buscar a versão:', error.message);
        }
    }

    getState() {
        return {
            waClientState: this.waClientState,
            lastQrCode: this.lastQrCode,
            loadingProgress: this.loadingProgress
        };
    }

    async initialize(solicitadoPor = 'sistema') {
        const timestamp = ts();
        if (this.isConnecting) {
            console.log(`[${timestamp}] Conexão/Reconexão já em andamento. Abortando nova tentativa.`);
            return;
        }
        this.isConnecting = true;

        try {
            if (this.isInitializing && solicitadoPor !== 'AUTO_RECONNECT' && solicitadoPor !== 'REPAIR_AFTER_LOGOUT') {
                console.log(`[${timestamp}] Inicialização já em progresso. Ignorando solicitação de: ${solicitadoPor}`);
                this.isConnecting = false;
                return;
            }
            if (this.waClientState === 'READY' && solicitadoPor !== 'REINICIO_FORCADO' && !solicitadoPor.includes('socket') && solicitadoPor !== 'AUTO_RECONNECT' && solicitadoPor !== 'REPAIR_AFTER_LOGOUT') {
                console.log(`[${timestamp}] Cliente já está 'READY'. Ignorando inicialização solicitada por: ${solicitadoPor}`);
                this.io.emit('status', 'ready');
                this.isConnecting = false;
                return;
            }

            this.isInitializing = true;
            this.waClientState = 'LOADING';
            this.io.emit('status', 'loading');
            this.lastQrCode = null;

            // Garante a destruição limpa de qualquer instância órfã
            if (this.client) {
                console.log(`[${timestamp}] Cliente existente encontrado em initialize. Limpando...`);
                await this._destroyClient();
            }

            console.log(`[${timestamp}] Criando nova instância do Client WhatsApp...`);
            this._createClient();

            await this.client.initialize();

            // FIX #1: Salva o PID do browser do Puppeteer para kill cirúrgico futuro
            this._browserPid = this.client.pupBrowser?.process()?.pid || null;
            if (this._browserPid) {
                console.log(`[${timestamp}] Browser Puppeteer iniciado com PID: ${this._browserPid}`);
            }

            // Limpa o rastro de automação após o browser iniciar
            const browser = this.client.pupBrowser;
            if (browser) {
                const pages = await browser.pages();
                if (pages.length > 0) {
                    await pages[0].evaluateOnNewDocument(() => {
                        Object.defineProperty(navigator, 'webdriver', { get: () => false });
                    });
                }
            }

            console.log(`[${timestamp}] client.initialize() PROMESSA CONCLUÍDA.`);
        } catch (error) {
            // FIX #4: Removido o emit duplo de 'fatal_error' — _handleCriticalClientError já gerencia
            // o estado e o emit corretamente conforme o número de tentativas.
            console.error(`[${timestamp}] ERRO CRÍTICO durante client.initialize():`, error);
            await this._handleCriticalClientError(error, `Falha em client.initialize()`);
        } finally {
            this.isConnecting = false;
        }
    }

    /**
     * Encerramento gracioso do cliente WhatsApp (para shutdown do app / SIGINT / close).
     * Finaliza o Chromium, mata zumbis e libera SingletonLock, PRESERVANDO a sessão (.wwebjs_auth).
     */
    async destroy(motivo = 'encerramento') {
        const timestamp = ts();
        console.log(`[${timestamp}] [SHUTDOWN] Desligando cliente WhatsApp com segurança (motivo: ${motivo})...`);
        this.isDisconnecting = true;
        try {
            await this._destroyClient();
            await lidPhoneStore.saveNow().catch(() => {});
            console.log(`[${timestamp}] [SHUTDOWN] Recursos e processos do WhatsApp liberados com sucesso. Sessão preservada intacta.`);
        } finally {
            this.isDisconnecting = false;
        }
    }

    async restart(origem = 'desconhecida') {
        const timestamp = ts();
        console.log(`[${timestamp}] Iniciando desconexão suave e limpeza do cliente WhatsApp. Solicitado por: ${origem}`);

        this.isDisconnecting = true;

        try {
            await this._destroyClient();
            this._limparPastaAuth();
        } finally {
            this.isDisconnecting = false;
            this.waClientState = 'DISCONNECTED';
            this.io.emit('status', 'disconnected');
            console.log(`[${timestamp}] [REINICIO_WA] Desconexão suave finalizada com sucesso. Status 'disconnected' emitido.`);
        }
    }

    async _handleCriticalClientError(error, originMessage = 'Operação do cliente WhatsApp') {
        const timestamp = ts();
        console.error(`[${timestamp}] ❗ Erro crítico capturado em "${originMessage}": Tipo: ${error.name}, Mensagem: ${error.message}`);
        
        if (this.isDisconnecting) {
            console.log(`[${timestamp}] [_handleCriticalClientError] Desconexão voluntária em progresso. Ignorando auto-reconexão.`);
            return;
        }

        await this._destroyClient();

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        const errMsg = (error.message || '').toLowerCase();
        const isNetworkError = errMsg.includes('err_internet_disconnected') ||
                               errMsg.includes('err_name_not_resolved') ||
                               errMsg.includes('err_connection') ||
                               errMsg.includes('etimedout') ||
                               errMsg.includes('enotfound') ||
                               errMsg.includes('navigation timeout') ||
                               errMsg.includes('fetch');

        if (isNetworkError) {
            console.warn(`[${timestamp}] 🌐 Falha de conexão de rede detectada ao carregar o WhatsApp Web.`);
            this.waClientState = 'NO_INTERNET';
            this.io.emit('status', 'no_internet');
            this.io.emit('system-log', {
                id: Date.now(),
                type: 'error',
                action: 'Conexão de Rede',
                message: 'Sem conexão com a internet para carregar o WhatsApp Web. Verifique sua rede.',
                timestamp: new Date().toISOString()
            });

            const delay = 15000;
            console.warn(`[${timestamp}] Agendando nova verificação de rede em 15 segundos...`);
            this.reconnectTimeout = setTimeout(async () => {
                await this.initialize('AUTO_RECONNECT');
            }, delay);
            return;
        }

        const isAuthError = errMsg.includes('execution context') ||
                            errMsg.includes('auth') ||
                            errMsg.includes('session') ||
                            errMsg.includes('evaluation failed') ||
                            errMsg.includes('protocol error') ||
                            errMsg.includes('already running') ||
                            errMsg.includes('userdatadir');

        // BUG #3 FIX: A verificação do limite de reconexões deve ocorrer ANTES do reset do contador.
        if (this.reconnectAttempts >= 3) {
            console.error(`[${timestamp}] 🚨 Limite de reconexões automáticas atingido (${this.reconnectAttempts}). Parando automação para intervenção manual.`);
            this.waClientState = 'FATAL_ERROR';
            this.io.emit('status', 'fatal_error');
            this.io.emit('system-log', {
                id: Date.now(),
                type: 'error',
                action: 'Erro Fatal',
                message: `Falha crítica persistente após ${this.reconnectAttempts} tentativas. A sessão permanece salva. Clique em "Reiniciar Bot" para tentar novamente.`,
                timestamp: new Date().toISOString()
            });
            this.reconnectAttempts = 0; // Reset apenas AQUI, após parar
            return;
        }

        // PASSO 3 FIX: A pasta .wwebjs_auth NÃO deve ser deletada em erros transitórios ou tentativas de reconexão!
        // A exclusão da sessão só deve ocorrer no evento nativo 'auth_failure' (rejeição explícita do WhatsApp)
        // ou quando o usuário clica deliberadamente em "Desconectar" (método restart).
        // Isso impede a perda desnecessária do login e evita exigir novo QR Code a cada reinício.

        const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 5000, 60000);
        console.warn(`[${timestamp}] Agendando reconexão automática em ${(delay / 1000).toFixed(1)} segundos (Tentativa #${this.reconnectAttempts + 1}/3)...`);
        
        this.reconnectAttempts++;
        this.reconnectTimeout = setTimeout(async () => {
            await this.initialize('AUTO_RECONNECT');
        }, delay);
    }

    _armAuthReadyWatchdog() {
        if (this.authReadyTimeout) {
            clearTimeout(this.authReadyTimeout);
        }

        this.authReadyTimeout = setTimeout(async () => {
            if (this.waClientState === 'READY' || !this.client) {
                return;
            }
            const checkTs = ts();
            console.warn(`[${checkTs}] ⚠️ [AuthReadyWatchdog] Cliente autenticado há 45s, mas evento 'ready' ainda não disparou. Diagnosticando aba...`);

            if (!this.client.pupPage || this.client.pupPage.isClosed()) {
                console.error(`[${checkTs}] 🚨 [AuthReadyWatchdog] Página do Puppeteer fechada ou inválida.`);
                await this._handleCriticalClientError(new Error('Página do Puppeteer fechada durante handshake'), 'AuthReadyWatchdog');
                return;
            }

            try {
                // Diagnóstico 1: Verifica se a interface do WhatsApp Web já está aberta visualmente
                const isUIReady = await this.client.pupPage.evaluate(() => {
                    try {
                        const chatList = document.querySelector('#pane-side') ||
                                         document.querySelector('div[data-testid="chat-list"]') ||
                                         document.querySelector('[role="navigation"]');
                        return Boolean(chatList);
                    } catch (_) {
                        return false;
                    }
                });

                if (isUIReady) {
                    console.log(`[${checkTs}] 💡 [AuthReadyWatchdog] Interface do WhatsApp Web detectada como ATIVA na tela! Forçando sincronização completa dos listeners.`);
                    
                    let syncedTriggered = false;
                    try {
                        syncedTriggered = await this.client.pupPage.evaluate(async () => {
                            if (typeof window.onAppStateHasSyncedEvent === 'function') {
                                await window.onAppStateHasSyncedEvent();
                                return true;
                            }
                            return false;
                        });
                    } catch (syncErr) {
                        console.warn(`[${checkTs}] [AuthReadyWatchdog] Aviso ao acionar onAppStateHasSyncedEvent:`, syncErr?.message);
                    }

                    // Verificação REAL dos listeners (marcador gravado na página somente após injeção concluída).
                    // Substitui a heurística anterior (typeof window.onAddMessageEvent), que gerava falso-positivo
                    // porque a função exposta existe antes de Msg.on('add') ser registrado.
                    await this._ensureMessageListeners('AuthReadyWatchdog');

                    // Aplica patches resilientes de chats
                    await WWebJSPatcher.applyChatsPatch(this.client).catch(() => {});

                    // Garante a transição para READY caso o ciclo interno não o tenha feito
                    if (this.waClientState !== 'READY') {
                        this.client.emit('ready');
                    }
                    return;
                }

                // Diagnóstico 2: Se ainda não atingiu o limite de retentativas (máx 2), tenta recarregamento suave da aba (F5)
                if (this.authReadyRetries < 2) {
                    this.authReadyRetries++;
                    console.warn(`[${checkTs}] 🔄 [AuthReadyWatchdog] Interface do WhatsApp Web retida no carregamento. Tentativa #${this.authReadyRetries}/2: Executando recarregamento suave da aba...`);

                    try {
                        await this.client.pupPage.reload({ waitUntil: 'domcontentloaded', timeout: 25000 });
                    } catch (reloadErr) {
                        console.warn(`[${checkTs}] [AuthReadyWatchdog] Aviso no reload suave: ${reloadErr.message}`);
                    }

                    // Re-agenda o watchdog para mais 45 segundos após o reload
                    this._armAuthReadyWatchdog();
                    return;
                }

                // Diagnóstico 3: Se após 2 recarregamentos continuar retido, aciona reconexão limpa preservando sessão
                console.error(`[${checkTs}] 🚨 [AuthReadyWatchdog] Limite de tentativas de recuperação atingido. Reiniciando cliente com segurança.`);
                await this._handleCriticalClientError(new Error('Auth-to-ready timeout persistente'), 'AuthReadyWatchdog');

            } catch (watchdogErr) {
                console.error(`[${checkTs}] 🚨 [AuthReadyWatchdog] Erro durante diagnóstico (${watchdogErr.message}). Reiniciando cliente.`);
                await this._handleCriticalClientError(watchdogErr, 'AuthReadyWatchdog');
            }
        }, 45000);
    }

    _setupClientEventListeners() {
        this.client.removeAllListeners();

        this.client.on('qr', (qr) => {
            const timestamp = ts();
            console.log(`[${timestamp}] QR RECEIVED`);
            this.lastQrCode = qr;
            this.waClientState = 'QR_PENDING';
            this.isInitializing = true;
            this.io.emit('qr', qr);
            this.io.emit('status', 'qr');
        });

        this.client.on('authenticated', () => {
            const timestamp = ts();
            console.log(`[${timestamp}] CLIENT AUTHENTICATED`);

            if (this.client.pupPage && !this.client.pupPage._hasConsoleListener) {
                this.client.pupPage._hasConsoleListener = true;
                this.client.pupPage.on('pageerror', err => console.log('[PAGE ERROR] ' + err.toString()));
                this.client.pupPage.on('error', err => console.log('[PAGE CRASH] ' + err.toString()));
            }

            this.lastQrCode = null;
            this._authenticatedAt = Date.now();
            this.waClientState = 'LOADING';
            this.io.emit('status', 'loading');

            // BLINDAGEM: Ativa o Watchdog de Transição
            this._armAuthReadyWatchdog();
        });

        this.client.on('auth_failure', async (msg) => {
            const timestamp = ts();
            console.error(`[${timestamp}] AUTHENTICATION FAILURE:`, msg);

            if (this.authReadyTimeout) {
                clearTimeout(this.authReadyTimeout);
                this.authReadyTimeout = null;
            }
            this.authReadyRetries = 0;

            this.lastQrCode = null;
            this.waClientState = 'AUTH_FAILURE';
            this.isInitializing = false;
            this.isConnecting = false;
            await this._destroyClient();
            this._limparPastaAuth();
            this.reconnectAttempts = 0;
            this.io.emit('status', 'auth_failure');
        });

        this.client.on('loading_screen', (percent, message) => {
            const timestamp = ts();
            this.isSyncing = true;
            this.loadingProgress = percent;
            console.log(`[${timestamp}] LOADING SCREEN WA: ${percent}% ${message}`);
            this.io.emit('loading-progress', percent);
        });

        this.client.on('ready', async () => {
            const timestamp = ts();
            console.log(`[${timestamp}] ✅ Dispositivo conectado! WhatsApp Client está pronto.`);

            if (this.authReadyTimeout) {
                clearTimeout(this.authReadyTimeout);
                this.authReadyTimeout = null;
            }
            this.authReadyRetries = 0;

            this.waClientState = 'READY';
            this.isInitializing = false;
            this.lastQrCode = null;
            this.loadingProgress = 100;
            this.connectedAt = Date.now();
            this.reconnectAttempts = 0;
            this.io.emit('loading-progress', 100);
            this.io.emit('status', 'ready');

            this.verificarVersao();

            // Executa o patch de chats uma única vez ao conectar
            await WWebJSPatcher.applyChatsPatch(this.client).catch(() => {});

            // Dispara auto-diagnóstico não-bloqueante dos contratos Meta Comet
            const WAEngine = require('../wa-engine');
            WAEngine.runHealthCheck(this.client).catch(() => {});

            // Garante que o listener de mensagens em tempo real está realmente ativo.
            // Cobre o caso em que a lib emitiu 'ready' sem executar attachEventListeners (handshake retomado/forçado).
            await this._ensureMessageListeners('ready').catch(() => false);

            // Sincroniza cofre local com o cache de mapeamento do WhatsApp Web
            lidPhoneStore.syncFromClient(this.client).catch(() => {});

            // Inicia o Watchdog de Saúde (PASSO 2 FIX: Timeout de 25s, tolerância a 3 falhas e pausa durante sincronização)
            if (this.watchdogInterval) {
                clearInterval(this.watchdogInterval);
            }
            this.watchdogFailures = 0;
            this.watchdogInterval = setInterval(async () => {
                if (this.waClientState !== 'READY' || this.isDisconnecting || !this.client) {
                    return;
                }
                if (this.isSyncing) {
                    const checkTime = ts();
                    console.log(`[${checkTime}] [Watchdog] Sincronização/Varredura de mensagens em andamento. Pausando verificação para evitar falso positivo.`);
                    this.watchdogFailures = 0;
                    return;
                }
                if (!this.client.pupPage || this.client.pupPage.isClosed()) {
                    return;
                }

                const checkTime = ts();
                console.log(`[${checkTime}] [Watchdog] Verificando saúde do cliente WhatsApp...`);
                try {
                    const statePromise = this.client.getState();
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout na resposta do Watchdog (25s)')), 25000)
                    );
                    const state = await Promise.race([statePromise, timeoutPromise]);
                    this.watchdogFailures = 0; // Reseta contador de falhas consecutivas
                    console.log(`[${checkTime}] [Watchdog] Cliente WhatsApp está saudável (Estado: ${state || 'OK'}).`);
                } catch (watchdogErr) {
                    if (this.isSyncing) {
                        this.watchdogFailures = 0;
                        return;
                    }
                    this.watchdogFailures = (this.watchdogFailures || 0) + 1;
                    console.warn(`[${checkTime}] ⚠️ [Watchdog] Verificação lenta ou sem resposta (${this.watchdogFailures}/3): ${watchdogErr.message}`);
                    
                    // Apenas reinicia após 3 falhas consecutivas comprovadas (tolerância de ~90 segundos)
                    if (this.watchdogFailures >= 3) {
                        console.error(`[${checkTime}] 🚨 [Watchdog] 3 falhas consecutivas confirmadas! Travamento real detectado. Iniciando reconexão.`);
                        this.watchdogFailures = 0;
                        await this._handleCriticalClientError(new Error('Browser unresponsive (Watchdog 3x timeout)'), 'Watchdog heartbeat');
                    }
                }

                // AUTO-CURA DE LISTENERS: o getState() acima não detecta um cliente "surdo" (conectado, mas sem
                // Msg.on('add') registrado). Só executa quando o cliente respondeu saudável, e fora do try/catch
                // do heartbeat para que uma falha de reparo nunca seja contada como travamento do navegador.
                if (this.watchdogFailures === 0 && this.waClientState === 'READY' && this.client && !this.isDisconnecting) {
                    try {
                        const listenersOk = await this._ensureMessageListeners('Watchdog');
                        if (listenersOk) {
                            this._listenerRepairFailures = 0;
                        } else {
                            this._listenerRepairFailures = (this._listenerRepairFailures || 0) + 1;
                            console.warn(`[${checkTime}] ⚠️ [Watchdog] Listeners de mensagens não confirmados (${this._listenerRepairFailures}/3).`);
                            if (this._listenerRepairFailures >= 3) {
                                console.error(`[${checkTime}] 🚨 [Watchdog] Reparo de listeners falhou 3x seguidas. Iniciando reconexão limpa (sessão preservada).`);
                                this._listenerRepairFailures = 0;
                                await this._handleCriticalClientError(new Error('Message listeners unrecoverable (Watchdog 3x repair failure)'), 'Watchdog listeners');
                            }
                        }
                    } catch (healErr) {
                        console.error(`[${checkTime}] [Watchdog] Erro inesperado na auto-cura de listeners:`, healErr?.message);
                    }
                }
            }, 30000);

            // Notifica callbacks de prontidão
            for (const cb of this.readyCallbacks) {
                try {
                    cb();
                } catch (cbErr) {
                    console.error('[ClientManager] Erro no callback de ready:', cbErr);
                }
            }

            // Aplica imediatamente o patch de resiliência de chats na conexão inicial
            WWebJSPatcher.applyChatsPatch(this.client).catch(() => {});

            // Inicia o processamento da fila offline e varredura de chats acumulados após 10 segundos
            setTimeout(async () => {
                try {
                    console.log('[Offline Queue] Restaurando mensagens pendentes do armazenamento persistente...');
                    await this.messageQueue.hydrateFromPersistence();

                    console.log('[Offline Queue] Iniciando varredura e processamento de mensagens acumuladas...');
                    await this._deepScanForUnreadMessages();
                } catch (err) {
                    console.error('[ClientManager] Erro na varredura offline inicial:', err);
                } finally {
                    // A fila SEMPRE é liberada, mesmo se a hidratação ou o Deep Scan falharem.
                    // Como _destroyClient() pausa a fila (stop()), pular o start() deixaria o tempo real mudo.
                    // Se o cliente foi destruído/substituído durante a varredura, não reinicia a fila de uma sessão encerrada.
                    if (this.waClientState === 'READY' && this.client) {
                        try {
                            this.messageQueue.start();
                        } catch (startErr) {
                            console.error('[ClientManager] Erro ao iniciar a fila de mensagens:', startErr);
                        }
                    }
                }
            }, 10000);
        });

        this.client.on('message', (msg) => {
            if (!msg || !msg.body || typeof msg.body !== 'string' || !msg.from || typeof msg.from !== 'string') {
                return;
            }

            // Descarta mensagens enviadas pelo próprio usuário/bot ou mídias não textuais
            if (msg.fromMe || (msg.type && msg.type !== 'chat')) {
                return;
            }

            const from = msg.from;

            // Filtro estrito contra canais, listas de transmissão e status
            if (
                from.endsWith('@broadcast') ||
                from.endsWith('@newsletter') ||
                from === 'status@broadcast' ||
                from === '0@c.us' ||
                from.startsWith('0@')
            ) {
                return;
            }

            // Tratamento especial para Grupos e Comunidades (@g.us):
            // Transmite em tempo real para a aba "Conversas" do operador,
            // mas NUNCA enfileira no MessageQueueService nem dispara IA/Saudação automática.
            if (from.endsWith('@g.us')) {
                const CLOCK_SKEW_TOLERANCE_MS = 60000;
                const msgTimestamp = (msg.timestamp || 0) * 1000;
                const referenceTime = this.connectedAt || this.bootTime;
                const isOldMessage = Boolean(referenceTime && (msgTimestamp + CLOCK_SKEW_TOLERANCE_MS) < referenceTime);

                if (this.waClientState === 'READY' && !isOldMessage) {
                    const authorJid = msg.author || '';
                    const authorName = msg._data?.notifyName || (authorJid ? formatPhoneNumber(authorJid) : '');
                    const hasMedia = Boolean(msg.hasMedia || msg.type === 'image' || msg.type === 'sticker');
                    const isVisualMedia = Boolean(hasMedia && (msg.type === 'image' || msg.type === 'sticker'));
                    const serializedId = msg.id?._serialized || `${from}_${Date.now()}`;

                    this.io.emit('live-chat:new-message', {
                        jid: from,
                        message: {
                            id: serializedId,
                            from: from,
                            to: 'me',
                            author: authorJid,
                            authorName: authorName,
                            fromMe: false,
                            body: msg.body,
                            type: msg.type || 'chat',
                            hasMedia,
                            mediaUrl: isVisualMedia ? `/api/live-chat/media/${encodeURIComponent(from)}/${encodeURIComponent(serializedId)}` : null,
                            timestamp: msgTimestamp || Date.now(),
                            isGroup: true
                        }
                    });
                }
                return;
            }

            const timestamp = ts();

            // Validação de timestamp para mensagens antigas ou disparadas durante sincronização
            // Margem de segurança de 60s para absorver clock skew entre o celular e o PC
            const CLOCK_SKEW_TOLERANCE_MS = 60000;
            const msgTimestamp = (msg.timestamp || 0) * 1000;
            const referenceTime = this.connectedAt || this.bootTime;
            const isOldMessage = Boolean(referenceTime && (msgTimestamp + CLOCK_SKEW_TOLERANCE_MS) < referenceTime);

            // Se o cliente ainda não estiver READY ou se a mensagem for anterior à conexão, ignora no tempo real
            // (o Deep Scan cuidará de pendências de forma segura após o estado READY)
            if (this.waClientState !== 'READY' || isOldMessage) {
                console.log(`[MSG ANTIGA/SYNC][${timestamp}] Ignorando mensagem fora de tempo real de ${from} no listener de eventos.`);
                return;
            }

            console.log(`[MSG RECEBIDA][${timestamp}] De: ${from} | Corpo: "${msg.body.substring(0, 30)}..."`);

            const previewMensagem = msg.body.length > 40 ? msg.body.substring(0, 40) + '…' : msg.body;
            const ioRef = this.io;
            ;(async () => {
                let label;
                try {
                    const contact = await msg.getContact();
                    let phoneJid =
                        (contact.id?.server === 'c.us' ? contact.id._serialized : null) ||
                        (msg._data?.senderPn) ||
                        (contact.number && contact.number.length >= 6 ? contact.number : null);

                    const phoneFormatted = phoneJid
                        ? formatPhoneNumber(phoneJid)
                        : formatPhoneNumber(msg.from);

                    const name = contact.name || contact.pushname || '';
                    label = name ? `${name} ${phoneFormatted}` : phoneFormatted;

                    // Hook para o cofre ultra-leve lidPhoneStore
                    if (from.endsWith('@lid')) {
                        let phoneCandidate = (contact.id?.server === 'c.us' ? contact.id.user : null) ||
                                             (msg._data?.senderPn ? msg._data.senderPn.replace(/\D/g, '') : null) ||
                                             (contact.number && contact.number.length >= 8 ? contact.number.replace(/\D/g, '') : null);
                        if (!phoneCandidate && msg.body) {
                            phoneCandidate = lidPhoneStore.extractPhoneFromText(msg.body);
                        }
                        if (phoneCandidate) {
                            lidPhoneStore.set(from, phoneCandidate, name);
                        }
                    }
                } catch (_) {
                    label = formatPhoneNumber(msg.from);
                }
                ioRef.emit('system-log', {
                    id: Date.now(),
                    type: 'info',
                    action: 'Mensagem Recebida',
                    message: `De ${label}: "${previewMensagem}"`,
                    timestamp: new Date().toISOString()
                });

                // Transmite a mensagem em tempo real para o painel de atendimento/Live Chat
                const hasMedia = Boolean(msg.hasMedia || msg.type === 'image' || msg.type === 'sticker');
                const isVisualMedia = Boolean(hasMedia && (msg.type === 'image' || msg.type === 'sticker'));
                const serializedId = msg.id?._serialized || `${msg.from}_${Date.now()}`;

                ioRef.emit('live-chat:new-message', {
                    jid: msg.from,
                    message: {
                        id: serializedId,
                        from: msg.from,
                        to: 'me',
                        fromMe: false,
                        body: msg.body,
                        type: msg.type || 'chat',
                        hasMedia,
                        mediaUrl: isVisualMedia ? `/api/live-chat/media/${encodeURIComponent(msg.from)}/${encodeURIComponent(serializedId)}` : null,
                        timestamp: (msg.timestamp || 0) * 1000 || Date.now()
                    }
                });
            })();

            // Enfileira a mensagem no MessageQueueService em vez de processamento imediato,
            // garantindo concorrência controlada e cooldown entre requisições
            this.messageQueue.enqueue({
                id: msg.id?._serialized || `${msg.from}_${msg.timestamp || Date.now()}`,
                payload: {
                    msg,
                    isOffline: false,
                    chatLabel: msg.from
                }
            }, msg.from);
        });

        this.client.on('disconnected', async (reason) => {
            const timestamp = ts();
            console.log(`[${timestamp}] EVENTO 'disconnected' DO CLIENTE WA RECEBIDO! Razão: ${reason}`);

            if (this.authReadyTimeout) {
                clearTimeout(this.authReadyTimeout);
                this.authReadyTimeout = null;
            }
            this.authReadyRetries = 0;

            if (this.isDisconnecting) {
                console.log(`[${timestamp}] [disconnected event] Desconexão voluntária em progresso. Ignorando auto-reconexão.`);
                return;
            }

            // Desvio ágil para logout deliberado no celular (Aparelhos Conectados):
            if (reason === 'LOGOUT') {
                console.log(`[${timestamp}] [Logout Mobile] Sessão encerrada no celular. Limpando dados locais e iniciando ciclo para novo QR Code...`);
                await this._destroyClient();
                this._limparPastaAuth();
                this.reconnectAttempts = 0;
                this.io.emit('status', 'disconnected');

                setTimeout(async () => {
                    await this.initialize('REPAIR_AFTER_LOGOUT');
                }, 500);
                return;
            }

            // Para outras desconexões imprevistas (queda de rede, falha de processo, timeout):
            await this._handleCriticalClientError(
                new Error(`WA disconnected: ${reason}`),
                'Evento disconnected'
            );
        });
    }
}

module.exports = WhatsAppClientManager;