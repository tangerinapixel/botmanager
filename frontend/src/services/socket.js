import io from 'socket.io-client';

// Cria e exporta uma ÚNICA instância do socket para toda a aplicação.
export const socket = io('http://localhost:5001', {
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5,
});

// Exporta funções de ação para não espalhar 'socket.emit' por todo o código.
export const whatsAppActions = {
  connect: () => socket.emit('connect-whatsapp'),
  disconnect: () => socket.emit('disconnect-whatsapp'),
};