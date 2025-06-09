/**
 * Módulo reservado para controle externo.
 * No momento, a pausa é controlada pela flag booleana 'paused',
 * passada por referência no startSending.
 * 
 * Esse arquivo pode futuramente conter logs, persistência de estado ou monitoramento.
 */

function pauseSending(envio) {
  console.log('⏸️ Envio em massa pausado...');
  // No momento, nenhuma ação direta é necessária aqui
}

module.exports = pauseSending;
