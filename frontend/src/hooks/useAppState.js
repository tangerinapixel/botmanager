import { useState, useEffect, useCallback } from 'react';
import { useNotifier } from '../context/Notifier';
import { useWhatsAppConnection } from './useWhatsAppConnection';
import { useBackendStatus } from './useBackendStatus';
import { whatsAppActions } from '../socket/socket';
import socket from '../socket/socket';
import { useAppLoading } from './useAppLoading';

export function useAppState() {
    const {
        isAppActivated,
        showActivationModal,
        isLoadingActivation,
        isFadingOut,
        loadingMessage,
        handleActivationSuccess: handleBaseActivationSuccess,
    } = useAppLoading();

    // --- Status do Backend ---
    const {
        backendStatus,
        restartAttempt,
        maxAttempts,
        nextRetryIn,
        forceBackendRestart
    } = useBackendStatus();

    // --- Estados ---
    const [flows, setFlows] = useState([]);
    const [greetings, setGreetings] = useState([]);
    const [contextoIA, setContextoIA] = useState(null);
    const [respostasAtivas, setRespostasAtivas] = useState(false);
    const [saudacaoAtiva, setSaudacaoAtiva] = useState(false);
    const [tempoMinutos, setTempoMinutos] = useState(3);
    const [activeConfigPage, setActiveConfigPage] = useState(null);
    const [confirmCloseModal, setConfirmCloseModal] = useState(false);
    const [openExportModal, setOpenExportModal] = useState(false);
    const [openExportGroupsModal, setOpenExportGroupsModal] = useState(false);
    const notify = useNotifier();
    const { status: waClientStatus, qrCodeUrl } = useWhatsAppConnection();
    const [iaAtiva, setIaAtiva] = useState(true);

    // --- Estados do Sistema de Observabilidade ---
    const [systemLogs, setSystemLogs] = useState([]);
    const [isLogDrawerOpen, setIsLogDrawerOpen] = useState(false);
    const toggleLogDrawer = useCallback(() => setIsLogDrawerOpen(prev => !prev), []);

    // --- Handlers para Fluxos ---
    const handleAddFlow = useCallback((newFlow) => setFlows((prev) => [...prev, newFlow]), []);
    const handleDeleteFlow = useCallback((id) => setFlows((prev) => prev.filter(flow => flow.id !== id)), []);
    const handleUpdateFlow = useCallback((updatedFlow) => {
        setFlows((prev) => prev.map((flow) => (flow.id === updatedFlow.id ? updatedFlow : flow)));
        notify('Fluxo atualizado com sucesso!', 'success');
    }, [notify]);

    const toggleIaAtiva = async () => {
        const novoStatus = !iaAtiva;
        try {
            const response = await fetch('/api/ia-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ativo: novoStatus })
            });
            const result = await response.json();
            if (result.success) {
                setIaAtiva(novoStatus);
                notify(novoStatus ? 'Fluxos da IA ativados' : 'Fluxos da IA desativados', 'info');
            } else {
                notify('Erro ao atualizar status da IA.', 'error');
            }
        } catch (err) {
            console.error('Erro ao chamar /api/ia-status:', err);
            notify('Erro de comunicação com o servidor.', 'error');
        }
    };

    const addGreeting = useCallback(async (greeting) => {
        try {
            const response = await fetch('http://localhost:5005/api/greetings', {
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
            notify('Saudação adicionada!', 'success');
        } catch (err) {
            console.error("Erro ao salvar saudação:", err);
            notify('Erro ao salvar saudação.', 'error');
        }
    }, [notify]);

    const deleteGreeting = useCallback(async (id) => {
        try {
            await fetch(`http://localhost:5005/api/greetings/${id}`, { method: 'DELETE' });
            setGreetings((prev) => prev.filter((g) => g.id !== id));
            notify('Saudação removida!', 'success');
        } catch (err) {
            console.error("Erro ao deletar saudação:", err);
            notify('Erro ao deletar saudação.', 'error');
        }
    }, [notify]);
    
    const editGreeting = useCallback(async (id, newMessage) => {
        try {
            const response = await fetch(`http://localhost:5005/api/greetings/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: newMessage }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Falha ao editar saudação no servidor.');
            }
            setGreetings((prev) => prev.map((g) => (g.id === id ? { ...g, message: newMessage } : g)));
            notify('Saudação atualizada com sucesso!', 'success');
        } catch (err) {
            console.error("Erro ao editar saudação:", err);
            notify(`Erro ao editar saudação: ${err.message}`, 'error');
        }
    }, [notify]);

    const atualizarTempo = useCallback(async () => {
        try {
            const res = await fetch("http://localhost:5005/api/tempo-expiracao", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ minutos: parseInt(tempoMinutos, 10) }),
            });
            const responseData = await res.json();
            if (responseData.success) {
                notify(`Tempo atualizado para ${tempoMinutos} min`, 'success');
            } else {
                notify(`Erro ao atualizar tempo: ${responseData.message}`, 'error');
            }
        } catch (err) {
            notify('Erro na conexão com o servidor.', 'error');
            console.error(err);
        }
    }, [tempoMinutos, notify]);

    const toggleRespostas = useCallback(async () => {
        setRespostasAtivas(current => {
            const novoEstado = !current;
            (async () => {
                try {
                    const response = await fetch('http://localhost:5005/api/respostas-ativas', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ativo: novoEstado })
                    });
                    const responseData = await response.json();
                    notify(responseData.ativo ? 'Respostas ativadas' : 'Respostas desativadas', 'info');
                } catch (error) {
                    notify('Erro ao atualizar respostas automáticas', 'error');
                    setRespostasAtivas(current);
                }
            })();
            return novoEstado;
        });
    }, [notify]);

    const handleSaveContextoIA = useCallback(async (novoContexto) => {
        try {
            const response = await fetch('/api/contexto-ia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contexto: novoContexto })
            });
            const data = await response.json();
            if (data.success) {
                setContextoIA(novoContexto);
                notify('Contexto da IA salvo com sucesso!', 'success');
            } else { throw new Error(data.message); }
        } catch (error) {
            notify(`Falha ao salvar: ${error.message}`, 'error');
        }
    }, [notify]);

    // --- Handlers de Ações Principais ---
    const handleWhatsAppAction = () => {
        if (waClientStatus === 'ready') {
            whatsAppActions.disconnect();
        } else {
            whatsAppActions.connect();
        }
    };

    const handleActivationSuccess = useCallback(() => {
        handleBaseActivationSuccess();
        notify('🎉 Aplicação ativada com sucesso!', 'success');
    }, [notify, handleBaseActivationSuccess]);

    // --- Efeito para Carregar Todos os Dados Iniciais ---
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [configRes, flowsRes, greetingsRes, iaContextRes] = await Promise.all([
                    fetch('http://localhost:5005/api/data'),
                    fetch('http://localhost:5005/api/fluxos'),
                    fetch('http://localhost:5005/api/greetings'),
                    fetch('http://localhost:5005/api/contexto-ia')
                ]);
                if (!configRes.ok || !flowsRes.ok || !greetingsRes.ok || !iaContextRes.ok) {
                    throw new Error('Falha ao carregar dados do servidor.');
                }
                const configData = await configRes.json();
                const flowsData = await flowsRes.json();
                const greetingsData = await greetingsRes.json();
                const iaContextData = await iaContextRes.json();

                if (iaContextData.success) setContextoIA(iaContextData.contexto);
                
                if (configData) {
                    setTempoMinutos(configData.tempoExpiracaoMinutos ?? 3);
                    setRespostasAtivas(configData.respostasAtivas ?? true);
                    setSaudacaoAtiva(configData.saudacaoAtiva ?? true);
                    // 📍 INÍCIO DA CORREÇÃO 1: Carregando o estado inicial da IA
                    setIaAtiva(configData.iaAtiva ?? true);
                    // 🏁 FIM DA CORREÇÃO 1
                }
                
                if (flowsData.success) setFlows(flowsData.flows);
                setGreetings(greetingsData);

            } catch (error) {
                console.error("Erro ao buscar dados iniciais:", error);
                notify("Não foi possível carregar as configurações do servidor.", "error");
            }
        };
        fetchInitialData();
    }, [notify]);

    // --- Listener de Logs do Sistema via Socket.IO ---
    useEffect(() => {
        const handleSystemLog = (logEntry) => {
            setSystemLogs(prev => [...prev, logEntry].slice(-50));
        };
        socket.on('system-log', handleSystemLog);
        return () => {
            socket.off('system-log', handleSystemLog);
        };
    }, []);

    // --- Objeto de Retorno do Hook ---
    // 📍 INÍCIO DA CORREÇÃO 2: Exportando as novas propriedades
    return {
        isAppActivated,
        showActivationModal,
        isLoadingActivation,
        isFadingOut,
        loadingMessage,
        openExportModal, setOpenExportModal,
        openExportGroupsModal, setOpenExportGroupsModal,
        confirmCloseModal, setConfirmCloseModal,
        waClientStatus,
        qrCodeUrl,
        flows,
        respostasAtivas,
        greetings,
        contextoIA,
        saudacaoAtiva,
        setSaudacaoAtiva,
        tempoMinutos,
        setTempoMinutos,
        activeConfigPage,
        setActiveConfigPage,
        handleActivationSuccess,
        handleWhatsAppAction,
        handleAddFlow,
        handleDeleteFlow,
        handleUpdateFlow,
        toggleRespostas,
        addGreeting,
        deleteGreeting,
        editGreeting,
        atualizarTempo,
        handleSaveContextoIA,
        notify,
        iaAtiva,           // <-- Adicionado
        toggleIaAtiva,     // <-- Adicionado
        backendStatus,
        restartAttempt,
        maxAttempts,
        nextRetryIn,
        forceBackendRestart,
        // --- Observabilidade ---
        systemLogs,
        isLogDrawerOpen,
        toggleLogDrawer,
    };
    // 🏁 FIM DA CORREÇÃO 2
}