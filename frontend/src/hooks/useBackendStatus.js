import { useState, useEffect } from 'react';

export function useBackendStatus() {
  const [backendStatus, setBackendStatus] = useState(null);
  const [restartAttempt, setRestartAttempt] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [nextRetryIn, setNextRetryIn] = useState(0);

  useEffect(() => {
    const electronAPI = window.electronAPI;
    
    if (!electronAPI) {
      console.log('[useBackendStatus] Não rodando em Electron, desabilitando monitoramento.');
      return;
    }

    // Listener para atualizações de status do backend
    const handleBackendStatus = (event, data) => {
      console.log('[useBackendStatus] Recebido update de status:', data);
      
      setBackendStatus(data.status); // 'restarting', 'failed', ou outros
      
      if (data.restartAttempt) {
        setRestartAttempt(data.restartAttempt);
      }
      if (data.maxAttempts) {
        setMaxAttempts(data.maxAttempts);
      }
      if (data.nextRetryIn !== undefined) {
        setNextRetryIn(data.nextRetryIn);
      }
    };

    // Listener para confirmação de restart manual iniciado
    const handleRestartInitiated = (event, data) => {
      console.log('[useBackendStatus] Restart manual iniciado:', data);
      setBackendStatus('restarting');
      setRestartAttempt(0);
      setNextRetryIn(0);
    };

    // Registra listeners
    electronAPI.onBackendStatus(handleBackendStatus);
    electronAPI.onBackendRestartInitiated(handleRestartInitiated);

    // Cleanup
    return () => {
      // Se o electronAPI não tiver método de remover listeners, 
      // a limpeza será automática quando o componente desmontar
    };
  }, []);

  // Função para forçar restart manual
  const forceBackendRestart = () => {
    const electronAPI = window.electronAPI;
    if (electronAPI && electronAPI.restartBackend) {
      electronAPI.restartBackend();
    }
  };

  return {
    backendStatus,      // null, 'restarting', ou 'failed'
    restartAttempt,     // número da tentativa atual (0-5)
    maxAttempts,        // máximo de tentativas (5)
    nextRetryIn,        // segundos até próxima tentativa
    forceBackendRestart // função para forçar restart manual
  };
}
