/**
 * Processa e sanitiza os contatos importados do Excel.
 * Remove duplicados (se solicitado), limpa o número e preserva nome.
 *
 * @param {Array} contatosBrutos - Lista de objetos importados do Excel.
 * @param {boolean} removerDuplicados - Se deve remover números repetidos.
 * @returns {Array} - Lista de contatos normalizados.
 */
function processContacts(contatosBrutos, removerDuplicados = false) {
  const contatosFiltrados = contatosBrutos
    .map((c) => ({
      numero: String(c.numero || c.telefone || c.número || '').replace(/[^\d]/g, ''),
      nome: c.nome || ''
    }))
    .filter(c => c.numero.length > 0);

  if (!removerDuplicados) return contatosFiltrados;

  // Remove duplicados com base no número
  const mapa = new Map();
  contatosFiltrados.forEach(c => {
    if (!mapa.has(c.numero)) {
      mapa.set(c.numero, c);
    }
  });

  return Array.from(mapa.values());
}

module.exports = processContacts;
