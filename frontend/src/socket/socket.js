// src/socket/socket.js
import { io } from 'socket.io-client';

// Criamos a instância apenas se ela não existir
const socket = io('http://localhost:5005', {
  transports: ['websocket'], // Força apenas WebSocket (mais estável para automação)
  reconnection: true,
  reconnectionAttempts: 99999, // Tenta reconectar para sempre se cair
  reconnectionDelay: 2000,    // Espera 2 segundos para tentar de novo
  timeout: 60000,             // Dá 60 segundos de folga para o backend processar (IA/Varredura)
  autoConnect: true,
});

// Logs para você diagnosticar no console do Navegador (F12)
socket.on('connect', () => {
  console.log('%c[Socket] ✅ Conectado ao Backend!', 'color: green; font-weight: bold');
});

socket.on('disconnect', (reason) => {
  console.warn(`[Socket] ❌ Desconectado: ${reason}`);
  if (reason === 'io server disconnect') {
    // Se o servidor forçou a desconexão, reconectamos manualmente
    socket.connect();
  }
});

export const whatsAppActions = {
  connect: () => socket.emit('connect-whatsapp'),
  disconnect: () => socket.emit('disconnect-whatsapp'),
};

export default socket;