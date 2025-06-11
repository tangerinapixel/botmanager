// hooks/useAppLoading.js
import { useState, useEffect } from 'react';

const electronAPI = window.electronAPI;
const MIN_LOADING_TIME = 3500;
const POST_VERIFICATION_MESSAGE_DURATION = 1000;
export const FADE_OUT_DURATION = 100; // Ex: 0.5 segundos para a transição suave


export function useAppLoading() {
  const [isAppActivated, setIsAppActivated] = useState(!electronAPI);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [isLoadingActivation, setIsLoadingActivation] = useState(!!electronAPI);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Verificando licenças...');


  useEffect(() => {
    if (!electronAPI) {
      setIsAppActivated(true);
      setShowActivationModal(false);
      setIsLoadingActivation(false);
      setIsFadingOut(false);
      setLoadingMessage('Licença ativa');
      return;
    }

    setIsLoadingActivation(true);
    setIsFadingOut(false);

    const activationCheckPromise = new Promise(resolve => {
      const electronActivationCallback = (activated) => {
        electronAPI.removeListener('initial-activation-status', electronActivationCallback);
        resolve({ activated: activated });
      };

      electronAPI.on('initial-activation-status', electronActivationCallback);
      electronAPI.send('get-initial-activation-status');
    });

    const minTimePromise = new Promise(resolve => {
      setTimeout(() => {
        resolve('min_time_elapsed');
      }, MIN_LOADING_TIME);
    });

    Promise.all([activationCheckPromise, minTimePromise])
      .then(([activationResult]) => {
        setIsAppActivated(activationResult.activated);
        setShowActivationModal(!activationResult.activated);

if (activationResult.activated) {
          setLoadingMessage('Licença ativa');

          setTimeout(() => {
            setIsFadingOut(true); // Inicia o fade out
            setTimeout(() => {
              setIsLoadingActivation(false); // Remove do DOM após fade
              setIsFadingOut(false);
            }, FADE_OUT_DURATION);
          }, POST_VERIFICATION_MESSAGE_DURATION); // Atraso para exibir "Licença ativa"
          
        } else {
         setLoadingMessage('Erro na verificação!');
          setIsFadingOut(true);
          setTimeout(() => {
            setIsLoadingActivation(false);
            setIsFadingOut(false);
          }, FADE_OUT_DURATION);
        }
      })
      .catch(error => {
        console.error("Erro na verificação de ativação da aplicação:", error);
        setIsAppActivated(false);
        setShowActivationModal(true);
        setIsLoadingActivation(false);
        setIsFadingOut(false);
        setLoadingMessage('Erro na verificação!');
      });

    return () => {
    };
  }, []);

  // Função para ser chamada quando a ativação for bem-sucedida (ex: após o usuário inserir a licença)
  const handleActivationSuccess = () => {
    setIsAppActivated(true);
    setShowActivationModal(false);
    setIsFadingOut(false);
    setLoadingMessage('Licença ativa');
  };

  return {
    isAppActivated,
    showActivationModal,
    isLoadingActivation,
    handleActivationSuccess,
    setIsAppActivated, // Expor setIsAppActivated caso precise ser alterado de fora (ex: se o backend confirmar a licença)
    isFadingOut,
    loadingMessage
  };
}