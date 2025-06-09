/**
 * Aguarda a quantidade de milissegundos especificada.
 * Pode ser usado com await para criar pausas controladas.
 *
 * @param {number} ms - Tempo de espera em milissegundos
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = delay;
