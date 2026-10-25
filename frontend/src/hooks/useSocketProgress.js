// frontend/src/hooks/useSocketProgress.js

import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

// MUDANÇA 1: A conexão do socket é criada UMA ÚNICA VEZ e compartilhada.
// Isso impede que o app se reconecte a cada mudança de estado.
const socket = io("http://localhost:5005");

export function useSocketProgress(waClientStatus) {
  const [loadingProgress, setLoadingProgress] = useState(0);

  // MUDANÇA 2: O useEffect agora gerencia o ciclo de vida do listener de forma correta.
  useEffect(() => {
    // 1. Reseta o progresso para 0 sempre que um novo ciclo de conexão começa.
    // Isso garante que a barra de progresso não comece com valores antigos.
    if (waClientStatus === 'loading' || waClientStatus === 'disconnected' || waClientStatus === 'qr') {
      setLoadingProgress(0);
    }

    // 2. Define o que fazer quando o evento 'loading-progress' chegar.
    const handleLoadingProgress = (percent) => {
      // A verificação impede que um evento de 99% "atrasado" sobrescreva o status 'ready'.
      if (waClientStatus !== 'ready') {
        setLoadingProgress(percent);
      }
    };

    // 3. Registra o listener na nossa conexão única e persistente.
    socket.on('loading-progress', handleLoadingProgress);

    // 4. Limpa o listener quando o estado muda, para evitar registrar múltiplos listeners.
    return () => {
      socket.off('loading-progress', handleLoadingProgress);
    };
  }, [waClientStatus]); // <-- A dependência em waClientStatus é a chave para a reatividade correta.

  return loadingProgress;
}