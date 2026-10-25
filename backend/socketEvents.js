const { ts } = require('./utils/logger');

module.exports = function configurarSocketEvents(io, {
  getWaClientState,
  getLastQrCode,
  getLoadingProgress,
  inicializarClienteWhatsApp,
  executarReinicializacaoWhatsApp
}) {
  io.on('connection', (socket) => {
    const timestamp = ts();
    console.log(`[${timestamp}] Frontend conectado via Socket.IO: ${socket.id}`);

    socket.on('request_initial_status', () => {
      const currentTimestamp = ts();
      const waClientState = getWaClientState();
      const lastQrCode = getLastQrCode();
      const loadingProgress = typeof getLoadingProgress === 'function' ? getLoadingProgress() : 0;

      console.log(`[${currentTimestamp}] Frontend ${socket.id} solicitou status inicial. Estado atual do backend: ${waClientState} (Progresso: ${loadingProgress}%)`);

      if (waClientState === 'QR_PENDING' && lastQrCode) {
        socket.emit('qr', lastQrCode); 
        socket.emit('status', 'qr');  
      } else if (waClientState === 'READY') {
        socket.emit('status', 'ready');
        socket.emit('loading-progress', 100);
      } else if (waClientState === 'LOADING') {
        socket.emit('status', 'loading');
        if (loadingProgress > 0) {
          socket.emit('loading-progress', loadingProgress);
        }
      } else if (waClientState === 'AUTH_FAILURE') {
        socket.emit('status', 'auth_failure');
      } else if (waClientState === 'NO_INTERNET') {
        socket.emit('status', 'no_internet');
      } else if (waClientState === 'FATAL_ERROR') {
        socket.emit('status', 'fatal_error');
      } else { 
        socket.emit('status', 'disconnected');
      }
    });

    socket.on('connect-whatsapp', () => {
      inicializarClienteWhatsApp(`socket ${socket.id}`);
    });

    socket.on('disconnect-whatsapp', () => {
      executarReinicializacaoWhatsApp(`socket ${socket.id}`);
    });

    socket.on('disconnect', () => {
      console.log(`[${ts()}] Frontend desconectado: ${socket.id}`);
    });
  });
};
