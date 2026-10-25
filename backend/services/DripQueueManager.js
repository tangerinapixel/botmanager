const { ts } = require('../utils/logger');

class DripQueueManager {
    constructor(processCallback) {
        if (typeof processCallback !== 'function') {
            throw new Error('processCallback deve ser uma funcao');
        }
        this.processCallback = processCallback;
        this.queue = [];
        this.isProcessing = false;
        this.timeout = null;
    }

    enqueue(msg, chatLabel) {
        if (!msg || !msg.from || typeof msg.from !== 'string') return false;
        const from = msg.from;
        if (from.endsWith('@broadcast') || from.endsWith('@newsletter') || from.endsWith('@g.us') || from === 'status@broadcast' || from === '0@c.us' || from.startsWith('0@')) {
            const timestamp = ts();
            console.warn(`[${timestamp}] [Drip Queue] ⚠️ Descartando mensagem de JID restrito/incompatível (${from}) de ${chatLabel} para proteção da conexão.`);
            return false;
        }

        const isDuplicate = this.queue.some(m => 
            (m.id?._serialized && m.id?._serialized === msg.id?._serialized) || 
            (m.id?.id && m.id?.id === msg.id?.id)
        );
        if (!isDuplicate) {
            const timestamp = ts();
            console.log(`[${timestamp}] [Drip Queue] Enfileirando mensagem offline de ${chatLabel} na fila de gotejamento.`);
            this.queue.push(msg);
            return true;
        } else {
            const timestamp = ts();
            console.log(`[${timestamp}] [Drip Queue] Mensagem offline de ${chatLabel} ja estava na fila. Ignorando duplicata.`);
            return false;
        }
    }

    start() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        this._processNext();
    }

    async _processNext() {
        const timestamp = ts();
        if (this.queue.length === 0) {
            console.log(`[${timestamp}] [Drip Queue] Fila de mensagens offline concluida.`);
            this.isProcessing = false;
            return;
        }

        const msg = this.queue.shift();
        if (!msg) {
            this._processNext();
            return;
        }

        console.log(`[${timestamp}] [Drip Queue] Processando mensagem offline de ${msg.from} (Restam ${this.queue.length} na fila).`);

        try {
            await this.processCallback(msg);
        } catch (err) {
            console.error(`[${timestamp}] [Drip Queue] Erro ao processar mensagem de ${msg.from}:`, err.message);
        }

        const proximoDelay = Math.floor(Math.random() * (12000 - 6000 + 1)) + 6000;
        console.log(`[${timestamp}] [Drip Queue] Agendando proximo gotejamento em ${(proximoDelay / 1000).toFixed(1)}s.`);

        if (this.isProcessing) {
            this.timeout = setTimeout(() => this._processNext(), proximoDelay);
        }
    }

    stop() {
        const timestamp = ts();
        console.log(`[${timestamp}] [Drip Queue] Parando o gotejamento de mensagens offline.`);
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
        this.isProcessing = false;
    }

    clear() {
        this.queue = [];
    }
}

module.exports = DripQueueManager;
