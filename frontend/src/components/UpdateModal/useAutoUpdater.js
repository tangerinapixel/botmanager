// frontend/src/components/UpdateModal/useAutoUpdater.js
// Hook React para gerenciar o estado e ciclo de vida do Auto-Updater

import { useState, useEffect, useCallback } from 'react';

export function useAutoUpdater() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState('available'); // 'available' | 'downloading' | 'downloaded' | 'error'
  const [updateInfo, setUpdateInfo] = useState(null);
  const [progress, setProgress] = useState({ percent: 0, transferredMb: '0', totalMb: '0', speedMb: '0' });
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    const api = window.electronAPI?.updater;
    if (!api) return;

    // 1. Nova versão disponível
    const unsubAvailable = api.onUpdateAvailable((info) => {
      setUpdateInfo(info);
      setStep('available');
      setIsOpen(true);
    });

    // 2. Progresso de download
    const unsubProgress = api.onDownloadProgress((prog) => {
      setStep('downloading');
      const percent = Math.min(100, Math.max(0, prog.percent || 0));
      const transferredMb = ((prog.transferred || 0) / 1024 / 1024).toFixed(1);
      const totalMb = ((prog.total || 0) / 1024 / 1024).toFixed(1);
      const speedMb = ((prog.bytesPerSecond || 0) / 1024 / 1024).toFixed(1);
      setProgress({ percent, transferredMb, totalMb, speedMb });
    });

    // 3. Download concluído
    const unsubDownloaded = api.onUpdateDownloaded((info) => {
      setStep('downloaded');
      setIsOpen(true);
    });

    // 4. Erro
    const unsubError = api.onError((err) => {
      setErrorMessage(err?.message || 'Falha na comunicação com o servidor de atualizações.');
      // Não abre o modal se for erro de checagem em background para não incomodar o usuário
    });

    return () => {
      if (typeof unsubAvailable === 'function') unsubAvailable();
      if (typeof unsubProgress === 'function') unsubProgress();
      if (typeof unsubDownloaded === 'function') unsubDownloaded();
      if (typeof unsubError === 'function') unsubError();
    };
  }, []);

  const startDownload = useCallback(async () => {
    setStep('downloading');
    setErrorMessage(null);
    const api = window.electronAPI?.updater;
    if (api && typeof api.startDownload === 'function') {
      try {
        await api.startDownload();
      } catch (err) {
        setStep('error');
        setErrorMessage(err.message);
      }
    }
  }, []);

  const quitAndInstall = useCallback(async () => {
    const api = window.electronAPI?.updater;
    if (api && typeof api.quitAndInstall === 'function') {
      await api.quitAndInstall();
    }
  }, []);

  const closeModal = useCallback(() => {
    // Se estiver baixando, apenas fecha o modal visualmente mas o download continua em background
    setIsOpen(false);
  }, []);

  const checkForUpdates = useCallback(async () => {
    const api = window.electronAPI?.updater;
    if (api && typeof api.checkForUpdates === 'function') {
      return await api.checkForUpdates();
    }
  }, []);

  const simulateUpdate = useCallback(async () => {
    const api = window.electronAPI?.updater;
    if (api && typeof api.simulateUpdate === 'function') {
      return await api.simulateUpdate();
    }
  }, []);

  return {
    isOpen,
    setIsOpen,
    step,
    updateInfo,
    progress,
    errorMessage,
    startDownload,
    quitAndInstall,
    closeModal,
    checkForUpdates,
    simulateUpdate
  };
}
