// hooks/useAppLoading.js
import { useState, useEffect, useCallback } from 'react';

const electronAPI = window.electronAPI;

// =======================================================================
// NOVAS CONSTANTES DE TEMPO - AQUI VOCÊ TEM O CONTROLE TOTAL
// =======================================================================
// Tempo MÍNIMO que o PRIMEIRO texto ("Verificando...") deve ficar na tela.
const MIN_FIRST_TEXT_TIME = 3000; // Ex: 3 segundos

// Tempo EXATO que o SEGUNDO texto ("Licença Ativa") deve ficar na tela.
const SECOND_TEXT_DURATION = 1500; // Ex: 1.5 segundos

// Duração da animação de fade.
export const FADE_OUT_DURATION = 50;
// =======================================================================


export function useAppLoading() {
  const [isAppActivated, setIsAppActivated] = useState(!electronAPI);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [isLoadingActivation, setIsLoadingActivation] = useState(!!electronAPI);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Verificando licenças...');

  useEffect(() => {
    if (!electronAPI) {
      setIsAppActivated(true);
      setIsLoadingActivation(false);
      return;
    }

    // Lógica redesenhada para ser sequencial e clara.
    const runLoadingSequence = async () => {
      try {
        // --- ETAPA 1: CONTROLA O TEMPO DO PRIMEIRO TEXTO ---
        const activationPromise = new Promise((resolve, reject) => {
          const callback = (status) => {
            electronAPI.removeListener('initial-activation-status', callback);
            resolve({ activated: status });
          };
          electronAPI.on('initial-activation-status', callback);
          electronAPI.send('get-initial-activation-status');
          setTimeout(() => reject(new Error("Timeout")), 10000);
        });

        const minTimePromise = new Promise(resolve => setTimeout(resolve, MIN_FIRST_TEXT_TIME));
        
        // Espera tanto pela verificação real QUANTO pelo tempo mínimo definido.
        const [{ activated }] = await Promise.all([activationPromise, minTimePromise]);

        // --- ETAPA 2: MUDA PARA O SEGUNDO TEXTO E CONTROLA SEU TEMPO ---
        setIsAppActivated(activated);
        if (activated) {
          setLoadingMessage('Licença Ativa');
          // Espera a duração exata definida para o segundo texto.
          await new Promise(resolve => setTimeout(resolve, SECOND_TEXT_DURATION));
        } else {
          setLoadingMessage('Ativação necessária');
          setShowActivationModal(true);
          // Se não estiver ativado, não precisa esperar, já pode iniciar o fade.
        }
      } catch (error) {
        console.error("Falha na verificação de ativação:", error);
        setLoadingMessage('Erro na verificação');
        setShowActivationModal(true);
      }

      // --- ETAPA 3: INICIA O FADE OUT E FINALIZA ---
      // Esta parte só roda depois que as etapas 1 e 2 terminarem.
      setIsFadingOut(true);
      await new Promise(resolve => setTimeout(resolve, FADE_OUT_DURATION));
      
      setIsLoadingActivation(false);
      setIsFadingOut(false);
    };

    runLoadingSequence();

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