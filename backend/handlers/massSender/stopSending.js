/**
 * Função para registrar interrupção do envio em massa.
 * O controle de parada é feito através da flag 'stopped' no startSending.js.
 * 
 * Este módulo pode ser usado para logs ou ações futuras como
 * persistir o ponto de parada ou enviar alertas para o frontend.
 */

function stopSending(envio) {
  console.log('🛑 Envio em massa interrompido...');
  // Aqui você pode adicionar lógica adicional no futuro, se necessário.
  // Ex: envio?.limparRecursosTemporarios?.();
}

module.exports = stopSending;
