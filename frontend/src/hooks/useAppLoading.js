// hooks/useAppLoading.js
import { useState, useEffect, useCallback } from 'react';

const electronAPI = window.electronAPI;

export const FADE_OUT_DURATION = 0;

export function useAppLoading() {
  const [isAppActivated, setIsAppActivated] = useState(!electronAPI);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [isLoadingActivation, setIsLoadingActivation] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  useEffect(() => {
    if (!electronAPI) {
      setIsAppActivated(true);
      setShowActivationModal(false);
      return;
    }

    const handleActivationStatus = (status) => {
      const isObject = typeof status === 'object' && status !== null;
      const realActivated = isObject ? status.activated === true : status === true;

      setIsAppActivated(realActivated);
      if (!realActivated) {
        setShowActivationModal(true);
      } else {
        setShowActivationModal(false);
      }
    };

    const unsubscribe = electronAPI.on('initial-activation-status', handleActivationStatus);
    electronAPI.send('get-initial-activation-status');

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      } else if (electronAPI.removeListener) {
        electronAPI.removeListener('initial-activation-status', handleActivationStatus);
      }
    };
  }, []);

  const handleActivationSuccess = useCallback(() => {
    setIsAppActivated(true);
    setShowActivationModal(false);
  }, []);

  return {
    isAppActivated,
    showActivationModal,
    isLoadingActivation,
    isFadingOut,
    loadingMessage,
    handleActivationSuccess,
    setIsAppActivated,
  };
}