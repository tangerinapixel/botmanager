// backend/services/MessageQueueService.js
const EventEmitter = require('events');
const { ts } = require('../utils/logger');

function isRestrictedJid(jid) {
    if (!jid || typeof jid !== 'string') return false;
    return jid.endsWith('@g.us') ||
           jid.endsWith('@broadcast') ||
           jid.endsWith('@newsletter') ||
           jid === 'status@broadcast' ||
           jid === '0@c.us' ||
           jid.startsWith('0@');
}

/**
 * MessageQueueService
 * Gerenciador de fila assíncrono com controle estrito de concorrência,
 * respiro (cooldown) entre jobs, isolamento de falhas e persistência opcional.
 */
class MessageQueueService extends EventEmitter {
    constructor(options = {}) {
        super();
        this.concurrency = Math.max(1, options.concurrency || 1);
        this.cooldownMs = typeof options.cooldownMs === 'number' ? options.cooldownMs : 3000;
        this.workerFn = typeof options.workerFn === 'function' ? options.workerFn : null;
        this.persistenceAdapter = options.persistenceAdapter || null;

        this.queue = [];
        this.activeCount = 0;
        this.isPaused = false;
        this.isProcessing = false;
        this.processedIds = new Set();
        this.cooldownTimers = new Set();
        // Tempo máximo que uma tarefa pode ocupar o slot do worker (0 desativa). O trabalho em si não é cancelável,
        // mas o slot é liberado para que o tempo real não fique bloqueado por uma tarefa travada.
        this.taskTimeoutMs = typeof options.taskTimeoutMs === 'number' ? Math.max(0, options.taskTimeoutMs) : 120000;
        // Geração da fila: incrementada em clear(). Tarefas de gerações anteriores não mexem no contador atual.
        this.epoch = 0;
    }

    /**
     * Define ou atualiza a função de execução de cada tarefa da fila.
     * @param {Function} workerFn 
     */
    setWorker(workerFn) {
        if (typeof workerFn !== 'function') {
            throw new Error('[MessageQueueService] O workerFn deve ser uma função executável.');
        }
        this.workerFn = workerFn;
    }

    /**
     * Enfileira uma mensagem ou tarefa genérica.
     * Suporta tanto o payload padronizado { id, payload } quanto diretamente objetos de mensagem do WhatsApp.
     */
    async enqueue(taskOrMsg, chatLabel = '') {
        const timestamp = ts();
        if (!taskOrMsg) return false;

        let taskId = null;
        let payload = null;

        // Caso 1: Objeto estruturado { id, payload }
        if (taskOrMsg.id && taskOrMsg.payload !== undefined) {
            taskId = typeof taskOrMsg.id === 'string' ? taskOrMsg.id : (taskOrMsg.id._serialized || taskOrMsg.id.id);
            payload = taskOrMsg.payload;

            const from = payload?.msg?.from || payload?.chatLabel || (typeof chatLabel === 'string' ? chatLabel : '');
            if (isRestrictedJid(from) || payload?.msg?.fromMe) {
                console.warn(`[${timestamp}] [Queue] ⚠️ Descartando mensagem de JID restrito (${from}) para proteção do cliente.`);
                return false;
            }
        } else {
            // Caso 2: Objeto puro de mensagem do whatsapp-web.js
            const from = taskOrMsg.from;
            if (!from || typeof from !== 'string') return false;

            // Filtro de segurança contra broadcasts, grupos e newsletters
            if (isRestrictedJid(from) || taskOrMsg.fromMe) {
                console.warn(`[${timestamp}] [Queue] ⚠️ Descartando mensagem de JID restrito (${from}) para proteção do cliente.`);
                return false;
            }

            taskId = taskOrMsg.id?._serialized || taskOrMsg.id?.id || `${from}_${taskOrMsg.timestamp || Date.now()}`;
            payload = {
                msg: taskOrMsg,
                chatLabel: chatLabel || from
            };
        }

        if (!taskId) return false;

        // Deduplicação: se já estiver em processamento ou na fila, ignora
        if (this.processedIds.has(taskId) || this.queue.some(item => item.id === taskId)) {
            console.log(`[${timestamp}] [Queue] Mensagem [${taskId}] já se encontra na fila ou foi processada recentemente. Ignorando duplicata.`);
            return false;
        }

        const queueItem = {
            id: taskId,
            payload: payload,
            attempts: 0,
            enqueuedAt: Date.now()
        };

        this.queue.push(queueItem);
        console.log(`[${timestamp}] [Queue] Tarefa [${taskId}] adicionada à fila. Total pendente: ${this.queue.length}`);
        this.emit('task:enqueued', queueItem);

        if (this.persistenceAdapter) {
            await this.persistenceAdapter.save(queueItem).catch(err => {
                console.error(`[${timestamp}] [Queue Persistence] Erro ao persistir tarefa: ${err.message}`);
            });
        }

        // Despacha execução automática se o worker estiver ativo
        if (!this.isPaused) {
            this._processNext();
        }

        return true;
    }

    /**
     * Inicia a execução da fila (compatibilidade com lifecycle anterior).
     */
    start() {
        this.isPaused = false;
        this.isProcessing = true;
        this._processNext();
    }

    /**
     * Ciclo de consumo da fila com respeito à concorrência e cooldown
     */
    async _processNext() {
        if (this.isPaused || this.activeCount >= this.concurrency || this.queue.length === 0) {
            return;
        }

        if (!this.workerFn) {
            const timestamp = ts();
            console.warn(`[${timestamp}] [Queue] Nenhum workerFn registrado. Aguardando vinculação.`);
            return;
        }

        const item = this.queue.shift();
        if (!item) return;

        this.activeCount++;
        this.processedIds.add(item.id);

        // Limpeza de cache de IDs processados para evitar consumo excessivo de memória
        if (this.processedIds.size > 2000) {
            const firstKey = this.processedIds.values().next().value;
            this.processedIds.delete(firstKey);
        }

        const timestamp = ts();
        console.log(`[${timestamp}] [Queue Worker] 🚀 Processando tarefa [${item.id}]. Restam ${this.queue.length} na fila.`);
        this.emit('task:started', item);

        const epoch = this.epoch;

        (async () => {
            let taskTimer = null;
            try {
                if (this.taskTimeoutMs > 0) {
                    const timeoutPromise = new Promise((_, reject) => {
                        taskTimer = setTimeout(() => {
                            reject(new Error(`Tarefa excedeu o tempo máximo de ${Math.round(this.taskTimeoutMs / 1000)}s e teve o slot liberado.`));
                        }, this.taskTimeoutMs);
                    });
                    await Promise.race([this.workerFn(item.payload), timeoutPromise]);
                } else {
                    await this.workerFn(item.payload);
                }
                
                const doneTime = ts();
                console.log(`[${doneTime}] [Queue Worker] ✅ Tarefa [${item.id}] concluída com sucesso.`);
                this.emit('task:completed', item);

                if (this.persistenceAdapter) {
                    await this.persistenceAdapter.markDone(item.id).catch(() => {});
                }
            } catch (err) {
                const failTime = ts();
                console.error(`[${failTime}] [Queue Worker] ❌ Erro não-fatal ao processar tarefa [${item.id}]:`, err.message);
                this.emit('task:failed', { item, error: err });

                if (this.persistenceAdapter) {
                    await this.persistenceAdapter.markFailed(item.id, err.message).catch(() => {});
                }
            } finally {
                if (taskTimer) clearTimeout(taskTimer);

                // Tarefa de uma geração anterior (fila limpa/reiniciada enquanto rodava): o activeCount já foi
                // zerado por clear(); não decrementa nem agenda a próxima para não corromper a fila atual.
                if (epoch !== this.epoch) {
                    return;
                }

                // Cadência obrigatória (cooldown) antes de liberar o slot para a próxima tarefa
                const timer = setTimeout(() => {
                    this.cooldownTimers.delete(timer);
                    this.activeCount = Math.max(0, this.activeCount - 1);
                    this._processNext();

                    if (this.activeCount === 0 && this.queue.length === 0) {
                        this.isProcessing = false;
                        const drainTime = ts();
                        console.log(`[${drainTime}] [Queue] 🏁 Fila de mensagens concluída com sucesso. Zero itens pendentes.`);
                        this.emit('queue:drained');
                    }
                }, this.cooldownMs);
                this.cooldownTimers.add(timer);
            }
        })();

        // Se houver capacidade de concorrência livre, despacha próxima imediatamente
        if (this.activeCount < this.concurrency && this.queue.length > 0) {
            this._processNext();
        }
    }

    /**
     * Hidrata a fila com tarefas que ficaram pendentes na persistência em disco.
     */
    async hydrateFromPersistence() {
        if (!this.persistenceAdapter) return 0;
        const pending = this.persistenceAdapter.getPendingItems();
        if (!Array.isArray(pending) || pending.length === 0) return 0;

        const timestamp = ts();
        console.log(`[${timestamp}] [Queue Persistence] Recuperando ${pending.length} tarefas pendentes do disco...`);

        let count = 0;
        const agora = Date.now();
        const maxHoursOld = 72;
        const maxAgeMs = maxHoursOld * 60 * 60 * 1000;

        for (const item of pending) {
            const enqueuedAt = item.enqueuedAt || (item.payload?.msg?.timestamp ? item.payload.msg.timestamp * 1000 : null);
            const isExpired = enqueuedAt && (agora - enqueuedAt > maxAgeMs);
            const msgFrom = item.payload?.msg?.from || item.payload?.chatLabel;

            if (isExpired) {
                console.log(`[${timestamp}] [Queue Persistence] Descartando tarefa expirada [${item.id}] salva há mais de ${maxHoursOld} horas.`);
                if (this.persistenceAdapter && typeof this.persistenceAdapter.markDone === 'function') {
                    this.persistenceAdapter.markDone(item.id).catch(() => {});
                }
                continue;
            }

            if (msgFrom && isRestrictedJid(msgFrom)) {
                console.log(`[${timestamp}] [Queue Persistence] Descartando tarefa de JID restrito [${item.id}] recuperada do disco.`);
                if (this.persistenceAdapter && typeof this.persistenceAdapter.markDone === 'function') {
                    this.persistenceAdapter.markDone(item.id).catch(() => {});
                }
                continue;
            }

            if (!this.processedIds.has(item.id) && !this.queue.some(q => q.id === item.id)) {
                this.queue.push(item);
                count++;
            }
        }
        console.log(`[${timestamp}] [Queue Persistence] ${count} tarefas restauradas com sucesso na fila.`);
        if (!this.isPaused && count > 0) {
            this._processNext();
        }
        return count;
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
        this._processNext();
    }

    stop() {
        this.isPaused = true;
        this.isProcessing = false;
        for (const t of this.cooldownTimers) {
            clearTimeout(t);
        }
        this.cooldownTimers.clear();
    }

    clear() {
        this.queue = [];
        this.processedIds.clear();
        for (const t of this.cooldownTimers) {
            clearTimeout(t);
        }
        this.cooldownTimers.clear();
        this.activeCount = 0;
        this.isProcessing = false;
        this.epoch++;
    }

    size() {
        return this.queue.length;
    }
}

module.exports = MessageQueueService;
