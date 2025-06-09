import { useState, useEffect } from 'react';
import { socket } from '../services/socket';

export function useWhatsAppConnection() {
  // 1. O estado inicial agora é 'loading'. Isso indica que estamos buscando o status real
  // e resolve a "piscada" de 'Conectado' para 'Desconectado' no reload.
  const [status, setStatus] = useState('loading');
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    // --- Handlers para os eventos que o SEU backend já envia ---

    // Este handler ouve o evento 'status' que seu backend manda para 'ready', 'disconnected', etc.
    const handleStatus = (newStatus) => {
      console.log(`Evento 'status' recebido do backend: ${newStatus}`);
      setStatus(newStatus);
      // Se o novo status não for 'qr', limpamos a URL do QR code para garantir.
      if (newStatus !== 'qr') {
        setQrCodeUrl('');
      }
    };

    // Este handler ouve o evento 'qr' que seu backend manda com a string do código.
    const handleQr = (qr) => {
      console.log("Evento 'qr' recebido do backend.");
      setStatus('qr'); // Força o status para 'qr' quando o código chega.
      setQrCodeUrl(qr);
    };

    // Este handler é um fallback para o caso de a conexão do socket cair.
    const handleSocketDisconnect = () => {
      console.log("Socket.IO desconectado. Forçando status para 'disconnected'.");
      setStatus('disconnected');
      setQrCodeUrl('');
    };

    // --- Configuração dos Listeners ---

    // 2. Pede o status inicial ao se conectar (isso resolve o problema de não saber o status no carregamento)
    socket.on('connect', () => {
      console.log('Socket.IO conectado! Pedindo status inicial do backend...');
      socket.emit('request_initial_status');
    });

    // 3. Ouve os eventos que seu backend JÁ EMITE
    socket.on('status', handleStatus);
    socket.on('qr', handleQr);
    socket.on('disconnect', handleSocketDisconnect);
    
    // Função de limpeza para evitar listeners duplicados em re-renderizações de desenvolvimento
    return () => {
      socket.off('status', handleStatus);
      socket.off('qr', handleQr);
      socket.off('disconnect', handleSocketDisconnect);
      socket.off('connect');
    };
  }, []); // O array de dependências vazio garante que esta lógica rode apenas uma vez.

  return { status, qrCodeUrl };
}