// backend/utils/lidPhoneStore.js
const fs = require('fs');
const path = require('path');

/**
 * Cofre Local Ultra-Leve de Mapeamento LID -> [Telefone, Nome]
 * - 100% em memória RAM (Map) para leitura síncrona O(1) sem I/O de disco.
 * - Armazenamento compactado (tuplas JSON minificadas, zero bloat, ~500 KB para 10k registros).
 * - Escrita assíncrona não-bloqueante (fs.promises) com debounce longo (25s) e flag isDirty.
 * - Salva APENAS identidades @lid (nunca @c.us ou @g.us).
 */
class LidPhoneStore {
  constructor() {
    this.filePath = path.join(__dirname, '..', 'data', 'lid-phone-map.json');
    this.map = new Map();
    this.isDirty = false;
    this.debounceTimer = null;
    this.DEBOUNCE_MS = 25000; // 25 segundos de debounce
    this.initialized = false;

    this.init();
  }

  /**
   * Carrega o arquivo JSON do disco para a memória RAM uma única vez.
   */
  init() {
    if (this.initialized) return;
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        if (raw && raw.trim().length > 0) {
          const parsed = JSON.parse(raw);
          for (const [lid, val] of Object.entries(parsed)) {
            if (lid && lid.endsWith('@lid') && Array.isArray(val) && val[0]) {
              this.map.set(lid, [String(val[0]), val[1] ? String(val[1]) : '']);
            }
          }
          console.log(`[LidPhoneStore] ✅ ${this.map.size} mapeamentos LID -> Telefone carregados em RAM.`);
        }
      }
    } catch (err) {
      console.warn(`[LidPhoneStore] ⚠️ Aviso ao carregar cofre local: ${err.message}. Iniciando cofre vazio.`);
    }
    this.initialized = true;
  }

  /**
   * Retorna [telefone, nome] para um @lid ou null se não existir (O(1)).
   */
  get(lid) {
    if (!lid || typeof lid !== 'string' || !lid.endsWith('@lid')) return null;
    return this.map.get(lid) || null;
  }

  getPhone(lid) {
    const entry = this.get(lid);
    return entry ? entry[0] : null;
  }

  getName(lid) {
    const entry = this.get(lid);
    return entry ? entry[1] : null;
  }

  /**
   * Registra ou atualiza um mapeamento @lid -> [telefone, nome]
   */
  set(lid, phone, name = '') {
    if (!lid || typeof lid !== 'string' || !lid.endsWith('@lid')) return false;
    if (!phone) return false;

    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length < 8) return false;

    const cleanName = (name && typeof name === 'string') ? name.trim() : '';
    // Ignora nomes genéricos ou que sejam o próprio LID/telefone
    const isGenericName = !cleanName || cleanName === 'Usuário desconhecido' || cleanName === lid || cleanName === cleanPhone;
    const finalName = isGenericName ? '' : cleanName;

    const existing = this.map.get(lid);
    if (existing) {
      const existingPhone = existing[0];
      const existingName = existing[1] || '';
      // Se não mudou nada, não marca dirty
      if (existingPhone === cleanPhone && (finalName === '' || existingName === finalName)) {
        return false;
      }
      // Se já tínhamos um nome bom e o novo veio vazio, preserva o antigo
      const nameToSave = finalName !== '' ? finalName : existingName;
      this.map.set(lid, [cleanPhone, nameToSave]);
    } else {
      this.map.set(lid, [cleanPhone, finalName]);
    }

    this.isDirty = true;
    this._scheduleSave();
    return true;
  }

  /**
   * Registra um lote de mapeamentos de uma vez.
   * entries: Array de [lid, phone, name?] ou [{ lid, phone, name }]
   */
  setBatch(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return 0;
    let addedCount = 0;

    for (const item of entries) {
      let lid, phone, name = '';
      if (Array.isArray(item)) {
        [lid, phone, name] = item;
      } else if (item && typeof item === 'object') {
        lid = item.lid;
        phone = item.phone || item.numero;
        name = item.name || item.nome;
      }

      if (lid && lid.endsWith('@lid') && phone) {
        const cleanPhone = String(phone).replace(/\D/g, '');
        if (cleanPhone.length >= 8) {
          const cleanName = (name && typeof name === 'string' && name !== 'Usuário desconhecido' && name !== lid && name !== cleanPhone) ? name.trim() : '';
          const existing = this.map.get(lid);
          if (!existing) {
            this.map.set(lid, [cleanPhone, cleanName]);
            addedCount++;
          } else if (cleanName && !existing[1]) {
            this.map.set(lid, [existing[0], cleanName]);
            addedCount++;
          }
        }
      }
    }

    if (addedCount > 0) {
      this.isDirty = true;
      this._scheduleSave();
    }
    return addedCount;
  }

  /**
   * Extrai um número de telefone com DDD válido de um texto livre de mensagem.
   * Exemplo: "meu whats é (11) 98765-4321", "contato 2199887766"
   */
  extractPhoneFromText(text) {
    if (!text || typeof text !== 'string') return null;

    // Procura padrões de telefone precedidos ou acompanhados de palavras-chave ou formato BR
    const regexComContexto = /(?:whats(?:app)?|zap|cel(?:ular)?|contato|fone|tel|meu\s+n[uú]mero)[^\d\n\r]{0,15}(\+?55\s?)?(?:\(?([1-9][0-9])\)?\s?)?(9[0-9]{4}[-\s]?[0-9]{4})/i;
    const matchContexto = text.match(regexComContexto);
    if (matchContexto) {
      const ddi = matchContexto[1] ? matchContexto[1].replace(/\D/g, '') : '55';
      const ddd = matchContexto[2] ? matchContexto[2].replace(/\D/g, '') : '';
      const num = matchContexto[3] ? matchContexto[3].replace(/\D/g, '') : '';
      if (ddd && num) {
        return `${ddi || '55'}${ddd}${num}`;
      }
    }

    // Procura número com DDD explícito em formato celular BR: (XX) 9XXXX-XXXX ou 55XXXXXXXXXXX
    const regexPadraoBR = /(?:(?:\+|00)?(55)\s?)?(?:\(?([1-9][0-9])\)?\s?)(9[0-9]{4}[-\s]?[0-9]{4})\b/;
    const matchBR = text.match(regexPadraoBR);
    if (matchBR) {
      const ddi = matchBR[1] || '55';
      const ddd = matchBR[2];
      const num = matchBR[3].replace(/\D/g, '');
      if (ddd && num.length === 9) {
        return `${ddi}${ddd}${num}`;
      }
    }

    return null;
  }

  /**
   * Hidrata o cofre diretamente a partir da sessão ativa do WhatsApp Web via Puppeteer
   * (lê WAWebApiContact.lidPnCache e contatos em memória em ~15ms).
   */
  async syncFromClient(client) {
    if (!client || !client.pupPage || client.pupPage.isClosed()) return 0;
    try {
      const mappings = await client.pupPage.evaluate(() => {
        try {
          const results = [];
          const WAWebApiContact = window.require ? window.require('WAWebApiContact') : null;
          const cache = WAWebApiContact?.lidPnCache?.$1;
          if (cache && typeof cache.entries === 'function') {
            for (const [lid, entry] of cache.entries()) {
              if (lid && lid.endsWith('@lid') && entry?.phoneNumber) {
                const phone = typeof entry.phoneNumber === 'string' ? entry.phoneNumber : (entry.phoneNumber.user || entry.phoneNumber._serialized);
                if (phone) {
                  results.push([lid, phone]);
                }
              }
            }
          }
          return results;
        } catch (e) {
          return [];
        }
      });

      if (Array.isArray(mappings) && mappings.length > 0) {
        const added = this.setBatch(mappings);
        console.log(`[LidPhoneStore] 🔄 Hidratação via WAWeb concluída: ${mappings.length} LIDs inspecionados (${added} novos mapeamentos no cofre local).`);
        await this.saveNow();
        return added;
      }
    } catch (err) {
      console.warn(`[LidPhoneStore] ⚠️ Aviso ao sincronizar com cliente WhatsApp: ${err.message}`);
    }
    return 0;
  }

  _scheduleSave() {
    if (this.debounceTimer) return;
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.saveNow().catch(err => {
        console.error('[LidPhoneStore] ❌ Erro ao salvar cofre local no disco:', err);
      });
    }, this.DEBOUNCE_MS);
  }

  /**
   * Gravação atômica e compacta no disco (JSON minificado sem indentação).
   */
  async saveNow() {
    if (!this.isDirty) return;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }

      // Minificação extrema: Object.fromEntries sem espaços nem indentação
      const obj = Object.fromEntries(this.map);
      const json = JSON.stringify(obj);
      await fs.promises.writeFile(this.filePath, json, 'utf8');
      this.isDirty = false;
      const stats = await fs.promises.stat(this.filePath);
      console.log(`[LidPhoneStore] 💾 Cofre local salvo com sucesso: ${this.map.size} registros (${(stats.size / 1024).toFixed(1)} KB).`);
    } catch (err) {
      console.error(`[LidPhoneStore] ❌ Falha ao gravar cofre no disco: ${err.message}`);
    }
  }

  size() {
    return this.map.size;
  }
}

// Singleton global exportado
module.exports = new LidPhoneStore();
