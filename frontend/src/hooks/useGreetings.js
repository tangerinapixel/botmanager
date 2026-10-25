// src/hooks/useGreetings.js
import { useState, useEffect, useCallback } from 'react';
import { useNotifier } from '../context/Notifier'; // Importe o Notifier se for usado aqui

export function useGreetings() {
    const [greetings, setGreetings] = useState([]);
    const [saudacaoAtiva, setSaudacaoAtiva] = useState(true); // Se este estado é específico de saudações
    const notify = useNotifier();

    // 1. Lógica para carregar saudações ao montar o componente
    useEffect(() => {
        const fetchGreetings = async () => {
            try {
                const response = await fetch('http://localhost:5005/api/greetings');
                if (!response.ok) throw new Error('Falha ao carregar saudações.');
                const greetingsData = await response.json();
                setGreetings(greetingsData);
            } catch (error) {
                console.error("Erro ao buscar saudações iniciais:", error);
                notify("Não foi possível carregar as saudações.", "error");
            }
        };

        fetchGreetings();
    }, [notify]); // Dependências do useEffect

    // 2. addGreeting (com a lógica de backend)
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

    // 3. deleteGreeting (com a lógica de backend)
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

    // 4. editGreeting (com a lógica de backend - *IMPORTANTE: Você precisará implementar a rota PUT no backend*)
    const editGreeting = useCallback(async (id, newMessage) => {
        try {
            const response = await fetch(`http://localhost:5005/api/greetings/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: newMessage }),
            });

            if (!response.ok) {
                throw new Error('Falha ao atualizar saudação no servidor');
            }

            // Se sua API PUT retorna o objeto atualizado, você pode usar:
            // const updatedGreeting = await response.json();
            // setGreetings((prev) => prev.map((g) => (g.id === id ? updatedGreeting : g)));

            // Caso contrário, atualiza localmente com a nova mensagem
            setGreetings((prev) => prev.map((g) => (g.id === id ? { ...g, message: newMessage } : g)));
            notify('Saudação atualizada!', 'success');
        } catch (err) {
            console.error("Erro ao editar saudação:", err);
            notify('Erro ao atualizar saudação.', 'error');
        }
    }, [notify]);

    // 5. Lógica para ativar/desativar saudação (se 'saudacaoAtiva' é gerenciada aqui)
    const toggleSaudacaoAtiva = useCallback(async (novoStatus) => {
    try {
        // VERIFIQUE ESTA URL E MÉTODO!
        const res = await fetch("http://localhost:5005/api/saudacao-ativa", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ativo: novoStatus })
        });
        const json = await res.json();
        if (json.success) {
            setSaudacaoAtiva(novoStatus);
            notify(novoStatus ? 'Saudações ativadas' : 'Saudações desativadas', 'success');
        } else {
            // Se o backend retornou success: false, mas não um erro HTTP
            notify(json.message || 'Erro ao mudar status da saudação.', 'error');
        }
    } catch (err) {
        // Este é o erro que você está vendo no notify
        notify('Erro ao alterar estado da saudação', 'error');
        console.error("Erro na requisição POST /api/saudacao-ativa:", err); // <-- ADICIONE OU CONFIRME ESTE LOG DETALHADO
    }
}, [notify]);

    // Você precisará de um useEffect para carregar o estado inicial de saudacaoAtiva também
    useEffect(() => {
        const fetchSaudacaoAtivaStatus = async () => {
            try {
                const response = await fetch('http://localhost:5005/api/data'); // ou uma rota específica para status da saudação
                if (!response.ok) throw new Error('Falha ao carregar status da saudação.');
                const data = await response.json();
                if (typeof data.saudacaoAtiva === 'boolean') {
                    setSaudacaoAtiva(data.saudacaoAtiva);
                }
            } catch (error) {
                console.error("Erro ao buscar status inicial da saudação:", error);
            }
        };
        fetchSaudacaoAtivaStatus();
    }, []); // Executa apenas uma vez no carregamento inicial

    return {
        greetings,
        addGreeting,
        deleteGreeting,
        editGreeting,
        saudacaoAtiva,
        setSaudacaoAtiva: toggleSaudacaoAtiva, // Renomeado para maior clareza de propósito
    };
}