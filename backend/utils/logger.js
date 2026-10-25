/**
 * Retorna o horário local atual formatado como HH:MM:SS
 * para uso em logs do terminal (mais legível que ISO 8601).
 * @returns {string} ex: "11:53:52"
 */
function ts() {
  return new Date().toLocaleTimeString('pt-BR', { hour12: false });
}

/**
 * Converte um JID do WhatsApp no formato legível de telefone.
 * Exemplos:
 *   5511998310751@c.us  →  +55 (11) 99831-0751
 *   5511998310751@lid   →  +55 (11) 99831-0751
 *   5521987654321@c.us  →  +55 (21) 98765-4321
 * @param {string} jid  - identificador bruto do WhatsApp
 * @returns {string}    - número formatado ou o jid original se não reconhecido
 */
function formatPhoneNumber(jid) {
  // Remove qualquer sufixo (@c.us, @lid, @s.whatsapp.net, etc.) e caracteres não numéricos
  const digits = String(jid || '').replace(/@.*$/, '').replace(/\D/g, '');

  if (!digits) return String(jid || '');

  // Número brasileiro: código de país 55 + DDD (2) + número (8 ou 9 dígitos)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    const ddd = digits.slice(2, 4);
    const num = digits.slice(4);

    if (num.length === 9) {
      // Celular: 9XXXX-XXXX
      return `+55 (${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
    }
    if (num.length === 8) {
      // Fixo: XXXX-XXXX
      return `+55 (${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
    }
  }

  // Para outros países ou formatos não reconhecidos, retorna com "+" e sem sufixo
  return `+${digits}`;
}

module.exports = { ts, formatPhoneNumber };
