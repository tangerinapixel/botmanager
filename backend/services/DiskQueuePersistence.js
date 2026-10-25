// backend/services/DiskQueuePersistence.js
const fs = require('fs');
const path = require('path');
const { ts } = require('../utils/logger');

/**
 * Adaptador de persistência atômica em arquivo JSON para a fila de mensagens.
 * Garante que mensagens pendentes sobrevivam a desligamentos imprevistos ou reinicializações do bot.
 */
class DiskQueuePersistence {
    constructor(customFilePath = null) {
        if (customFilePath) {
            this.filePath = customFilePath;
        } else {
            const basePath = process.env.USER_DATA_PATH
                ? process.env.USER_DATA_PATH
                : path.join(__dirname, '..');
            this.filePath = path.join(basePath, 'queue_state.json');
        }

        this.state = this._load();
    }

    _load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const data = fs.readFileSync(this.filePath, 'utf-8');
                const parsed = JSON.parse(data);
                return {
                    pending: parsed.pending || {},
                    completed: Array.isArray(parsed.completed) ? parsed.completed : []
                };
            }
        } catch (err) {
            const timestamp = ts();
            console.warn(`[${timestamp}] [QueuePersistence] Aviso ao ler ${this.filePath}: ${err.message}. Iniciando novo estado.`);
        }
        return { pending: {}, completed: [] };
    }

    _saveToDisk() {
        try {
            const tempPath = `${this.filePath}.tmp`;
            fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2), 'utf-8');
            fs.renameSync(tempPath, this.filePath);
        } catch (err) {
            const timestamp = ts();
            console.error(`[${timestamp}] [QueuePersistence] ❌ Falha na gravação atômica em disco:`, err.message);
        }
    }

    async save(queueItem) {
        if (!queueItem || !queueItem.id) return;

        // Sanitização de segurança: extrai apenas os dados primitivos essenciais,
        // evitando erros de estrutura circular inerentes a instâncias do whatsapp-web.js
        const rawMsg = queueItem.payload?.msg;
        const serializedMsg = rawMsg ? {
            id: rawMsg.id || { id: queueItem.id, _serialized: queueItem.id },
            from: rawMsg.from,
            to: rawMsg.to,
            body: rawMsg.body,
            timestamp: rawMsg.timestamp,
            fromMe: Boolean(rawMsg.fromMe),
            type: rawMsg.type || 'chat'
        } : null;

        this.state.pending[queueItem.id] = {
            id: queueItem.id,
            enqueuedAt: queueItem.enqueuedAt || Date.now(),
            payload: {
                msg: serializedMsg,
                isOffline: Boolean(queueItem.payload?.isOffline),
                chatLabel: queueItem.payload?.chatLabel || rawMsg?.from || ''
            },
            attempts: queueItem.attempts || 0
        };
        this._saveToDisk();
    }

    async markDone(id) {
        if (!id) return;
        if (this.state.pending[id]) {
            delete this.state.pending[id];
        }
        if (!this.state.completed.includes(id)) {
            this.state.completed.push(id);
            if (this.state.completed.length > 1000) {
                this.state.completed.shift();
            }
        }
        this._saveToDisk();
    }

    async markFailed(id, reason) {
        if (!id) return;
        if (this.state.pending[id]) {
            this.state.pending[id].status = 'FAILED';
            this.state.pending[id].lastError = reason;
            this.state.pending[id].failedAt = Date.now();
        }
        this._saveToDisk();
    }

    getPendingItems() {
        return Object.values(this.state.pending || {});
    }

    clear() {
        this.state = { pending: {}, completed: [] };
        this._saveToDisk();
    }
}

module.exports = DiskQueuePersistence;
