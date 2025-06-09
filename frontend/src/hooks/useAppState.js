import { useState, useEffect, useCallback } from 'react';
import { useNotifier } from '../context/Notifier';
import { useWhatsAppConnection } from './useWhatsAppConnection';
import { whatsAppActions } from '../services/socket';

const electronAPI = window.electronAPI;

export function useAppState() {
  const [openExportModal, setOpenExportModal] = useState(false);
  const [openExportGroupsModal, setOpenExportGroupsModal] = useState(false);
  const [respostasAtivas, setRespostasAtivas] = useState(true);
  const [flows, setFlows] = useState([]);
  const [greetings, setGreetings] = useState([]);
  const [abrirModalMass, setAbrirModalMass] = useState(false);
  const [saudacaoAtiva, setSaudacaoAtiva] = useState(true);
  const [tempoMinutos, setTempoMinutos] = useState(3);
  const [isAppActivated, setIsAppActivated] = useState(!electronAPI);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [isLoadingActivation, setIsLoadingActivation] = useState(!!electronAPI);
  const notify = useNotifier();
  
  const { status: waClientStatus, qrCodeUrl } = useWhatsAppConnection();

  const handleAddFlow = useCallback((newFlow) => {
    setFlows((prev) => [...prev, newFlow]);
  }, []);

  const handleDeleteFlow = useCallback((id) => {
    setFlows((prev) => prev.filter(flow => flow.id !== id));
  }, []);

  const handleUpdateFlow = useCallback((updatedFlow) => {
    setFlows((prev) => prev.map((flow) => (flow.id === updatedFlow.id ? updatedFlow : flow)));
    notify('✅ Fluxo atualizado com sucesso!', 'success');
}, [notify]);

  

  const addGreeting = useCallback(async (greeting) => {
    try {
      const response = await fetch('http://localhost:5001/api/greetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: greeting.message }),
      });
      if (!response.ok) throw new Error('Falha ao adicionar saudação');
      const newGreetingSaved = await response.json(); 
      setGreetings((prev) => {
          const exists = prev.find(g => g.id === newGreetingSaved.id);
          if (exists) return prev.map(g => g.id === newGreetingSaved.id ? newGreetingSaved : g);
          return [...prev, newGreetingSaved];
      });
      notify('✅ Saudação adicionada!', 'success');
    } catch (err) {
      console.error("Erro ao salvar saudação:", err);
      notify('❌ Erro ao salvar saudação.', 'error');
    }
  }, [notify]);

  const deleteGreeting = useCallback(async (id) => {
    try {
      await fetch(`http://localhost:5001/api/greetings/${id}`, { method: 'DELETE' });
      setGreetings((prev) => prev.filter((g) => g.id !== id));
      notify('🗑️ Saudação removida!', 'success');
    } catch (err) {
      console.error("Erro ao deletar saudação:", err);
      notify('❌ Erro ao deletar saudação.', 'error');
    }
  }, [notify]);
  
  const editGreeting = useCallback(async (id, newMessage) => {
    setGreetings((prev) => prev.map((g) => (g.id === id ? { ...g, message: newMessage } : g)));
    notify('ℹ️ Saudação atualizada localmente. Lembre-se de implementar a API de edição.', 'info');
  }, [notify]);

  const atualizarTempo = useCallback(async () => { // <-- 1. REMOVIDO o argumento 'newTime'
  try {
    const res = await fetch("http://localhost:5001/api/tempo-expiracao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // 2. USA a variável 'tempoMinutos' do estado, que é a fonte da verdade
      body: JSON.stringify({ minutos: parseInt(tempoMinutos, 10) }),
    });
    const responseData = await res.json();
    if (responseData.success) {
      // Não é necessário fazer setTempoMinutos aqui, pois o valor já está correto no estado.
      notify(`⏳ Tempo atualizado para ${tempoMinutos} min`, 'success');
    } else {
      notify(`❌ Erro ao atualizar tempo: ${responseData.message}`, 'error');
    }
  } catch (err) {
    notify('❌ Erro na conexão com o servidor.', 'error');
    console.error(err);
  }
}, [tempoMinutos, notify]); // <-- 3. ADICIONADO 'tempoMinutos' ao array de dependências

  const toggleRespostas = useCallback(async () => {
    setRespostasAtivas(current => {
      const novoEstado = !current;
      (async () => {
        try {
          const response = await fetch('http://localhost:5001/api/respostas-ativas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ativo: novoEstado })
          });
          const responseData = await response.json();
          notify(responseData.ativo ? '✅ Respostas ativadas' : '⛔ Respostas desativadas', 'info');
        } catch (error) {
          notify('Erro ao atualizar respostas automáticas', 'error');
          setRespostasAtivas(current);
        }
      })();
      return novoEstado;
    });
  }, [notify]);

  const handleWhatsAppAction = () => {
    if (waClientStatus === 'connected') {
      whatsAppActions.disconnect();
      notify('🔌 Desconectando...', 'info');
    } else {
      whatsAppActions.connect();
      notify('⏳ Iniciando conexão...', 'info');
    }
  };

  const handleActivationSuccess = useCallback(() => {
    setIsAppActivated(true);
    setShowActivationModal(false);
    notify('🎉 Aplicação ativada com sucesso!', 'success');
  }, [notify]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [configRes, flowsRes, greetingsRes] = await Promise.all([
          fetch('http://localhost:5001/api/data'),
          fetch('http://localhost:5001/api/fluxos'),
          fetch('http://localhost:5001/api/greetings')
        ]);

        if (!configRes.ok || !flowsRes.ok || !greetingsRes.ok) {
          throw new Error('Falha ao carregar dados do servidor.');
        }

        const configData = await configRes.json();
        const flowsData = await flowsRes.json();
        const greetingsData = await greetingsRes.json();

       if (configData && typeof configData.tempoExpiracaoMinutos === 'number' && !isNaN(configData.tempoExpiracaoMinutos)) {
  setTempoMinutos(configData.tempoExpiracaoMinutos);
} else {
  // Se o valor vindo do backend for inválido (nulo, indefinido, texto, etc.),
  // garantimos que o estado seja definido para o valor padrão seguro.
  setTempoMinutos(3); 
  console.warn('Valor de tempoExpiracaoMinutos recebido do backend é inválido ou nulo. Usando valor padrão (3).');
}
        if (flowsData.success) setFlows(flowsData.flows);
        setGreetings(greetingsData);

      } catch (error) {
        console.error("Erro ao buscar dados iniciais:", error);
        notify("Não foi possível carregar as configurações do servidor.", "error");
      }
    };

    const listenToActivation = () => {
      if (!electronAPI) return;

      const handleInitialActivation = (activated) => {
        setIsAppActivated(activated);
        setShowActivationModal(!activated);
        setIsLoadingActivation(false);
      };
      
      electronAPI.send('get-initial-activation-status');
      const unsubscribe = electronAPI.on('initial-activation-status', handleInitialActivation);
      return unsubscribe;
    };

    fetchInitialData();
    const unsubscribeActivation = listenToActivation();

    return () => {
      if (unsubscribeActivation) unsubscribeActivation();
    };
  }, [notify]);

  return {
    openExportModal, setOpenExportModal,
    openExportGroupsModal, setOpenExportGroupsModal,
    abrirModalMass, setAbrirModalMass,
    isAppActivated,
    showActivationModal,
    isLoadingActivation,
    handleActivationSuccess,
    waClientStatus,
    qrCodeUrl,
    handleWhatsAppAction,
    flows,
    handleAddFlow,
    handleDeleteFlow,
    handleUpdateFlow,
    respostasAtivas, 
    toggleRespostas,
    greetings,
    addGreeting,
    deleteGreeting,
    editGreeting,
    saudacaoAtiva, 
    setSaudacaoAtiva,
    tempoMinutos, 
    setTempoMinutos,
    atualizarTempo,
    notify
  };
}