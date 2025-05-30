import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import './App.css';
import { Drawer, IconButton, Accordion, AccordionSummary, AccordionDetails, Typography, Button } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChatIcon from '@mui/icons-material/Chat';

const socket = io('http://localhost:5001'); // Configurado para a porta correta

function App() {
  const [flows, setFlows] = useState([]); // Armazena fluxos carregados
  const [status, setStatus] = useState(''); // Status do bot
  const [qrCode, setQrCode] = useState(''); // QR Code para conexão
  const [newTrigger, setNewTrigger] = useState(''); // Gatilho para novo fluxo
  const [newResponse, setNewResponse] = useState(''); // Respostas para novo fluxo
  const [menuAberto, setMenuAberto] = useState(localStorage.getItem('menuAberto') === 'true'); // Estado do menu lateral

  const toggleMenu = async (status) => {
    setMenuAberto(status);
    localStorage.setItem('menuAberto', status); // Salva o estado do menu no navegador

    if (status) { // Se o menu estiver sendo aberto
      await carregarFluxos(); // Carrega os fluxos do backend
    }
  };

  const conectarServidor = async () => {
    try {
      const res = await fetch('/api/status'); // Proxy resolve automaticamente a porta
      const data = await res.json();
      if (data.success) {
        setStatus("online");
        alert("Servidor conectado com sucesso!");
      } else {
        setStatus("offline");
        alert("Erro ao conectar ao servidor.");
      }
    } catch (err) {
      setStatus("offline");
      alert("Erro: Não foi possível conectar ao servidor.");
      console.error('Erro ao conectar ao servidor:', err);
    }
  };

  useEffect(() => {
    carregarFluxos(); // Carrega os fluxos ao iniciar o frontend

    // Escuta o status do dispositivo
    socket.on('status', (newStatus) => {
      setStatus(newStatus); // Atualiza o status

      // Se o status for "disconnected", solicita o QR Code automaticamente
      if (newStatus === 'disconnected') {
        socket.emit('request-qr'); // Solicita o QR Code ao backend
      }
    });

    // Escuta o evento do QR Code
    socket.on('qr', (qr) => {
      setQrCode(`data:image/png;base64,${qr}`); // Formata como imagem Base64 para renderização
      console.log('QR Code recebido:', qr); // Log para depuração
    });

    // Limpa os eventos ao desmontar o componente
    return () => {
      socket.off('loadedFlows');
      socket.off('status');
      socket.off('qr');
    };
  }, []);

  const addFlow = async () => {
    if (!newTrigger || !newResponse) {
      alert('Preencha todos os campos!');
      return;
    }

    // Processa múltiplas respostas separadas por vírgulas
    const respostas = newResponse.split(',').map(res => res.trim());
    const novoFluxo = { id: Date.now().toString(), trigger: newTrigger, response: respostas };

    try {
      const res = await fetch('http://localhost:5001/api/adicionar-fluxo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fluxo: novoFluxo }),
      });
      const data = await res.json();
      alert(data.message || 'Novo fluxo salvo!');
      setFlows(data.flows); // Atualiza os fluxos
      setNewTrigger(''); // Limpa o campo gatilho
      setNewResponse(''); // Limpa o campo resposta
      window.scrollTo({ top: 0, behavior: 'smooth' }); // Voltar ao topo ao salvar novo fluxo
    } catch (err) {
      alert('Erro ao adicionar fluxo');
      console.error(err);
    }
  };

  const excluirFluxo = async (id) => {
    try {
      await fetch(`http://localhost:5001/api/fluxos/${id}`, { method: 'DELETE' });
      setFlows(flows.filter((fluxo) => fluxo.id !== id)); // Remove o fluxo da lista
    } catch (err) {
      alert('Erro ao excluir fluxo');
      console.error(err);
    }
  };

  const carregarFluxos = async () => {
    try {
      const res = await fetch('http://localhost:5001/api/fluxos'); // Rota para buscar fluxos
      const data = await res.json();

      if (data.success) {
        setFlows(data.flows); // Atualiza a lista de fluxos no estado
      }
    } catch (err) {
      console.error('Erro ao carregar fluxos:', err);
    }
  };

  return (
    <div className="container">
      <h1>🤖 Editor de Fluxos - WhatsApp Bot</h1>
      <p>Status: <strong style={{ color: 'green' }}>🟢 {status === "ready" ? "online" : status}</strong></p>

      <button
        className="btn green"
        onClick={() => conectarServidor()}
      >
        🔗 Conectar ao Servidor
      </button>

      {/* Ícone de hambúrguer para abrir o menu lateral */}
      <IconButton
        style={{ position: 'absolute', top: 20, right: 20 }}
        onClick={() => toggleMenu(true)}
      >
        <MenuIcon fontSize="large" />
      </IconButton>

      {/* Menu lateral */}
      <Drawer anchor="right" open={menuAberto} onClose={() => toggleMenu(false)}>
        <div style={{ width: 400, padding: 20, overflowY: 'auto' }}>
          <Typography variant="h6">Fluxos Criados</Typography>
          {flows.map((flow) => (
            <Accordion key={flow.id}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <ChatIcon style={{ color: 'darkgray', marginRight: '8px' }} />
                  <strong>{flow.trigger}</strong>
                </div>
              </AccordionSummary>
              <AccordionDetails>
                <Typography>
                  {Array.isArray(flow.response)
                    ? flow.response.join(' | ') // Mostra múltiplas respostas separadas por " | "
                    : flow.response}
                </Typography>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={() => alert(`Editar fluxo: ${flow.trigger}`)}
                >
                  Editar
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={() => excluirFluxo(flow.id)}
                  style={{ marginLeft: '10px' }}
                >
                  Excluir
                </Button>
              </AccordionDetails>
            </Accordion>
          ))}
        </div>
      </Drawer>

      {status === 'disconnected' && (
        <div className="qr-area">
          <h3>📲 Escaneie o QR Code abaixo para reconectar:</h3>
          {qrCode ? (
            <img src={qrCode} alt="QR Code" />
          ) : (
            <p>Gerando QR Code...</p>
          )}
        </div>
      )}

      <h2>➕ Novo Fluxo</h2>
      <div className="card">
        <ChatIcon style={{ color: 'darkgray', marginRight: '8px' }} />
        <input
          type="text"
          value={newTrigger}
          onChange={(e) => setNewTrigger(e.target.value)}
          placeholder="Novo gatilho"
        />
        <textarea
          value={newResponse}
          onChange={(e) => setNewResponse(e.target.value)}
          placeholder="Adicione respostas separadas por vírgulas"
          rows={3}
        />
      </div>
      <button className="btn blue" onClick={addFlow}>➕ Salvar Novo Fluxo</button>
    </div>
  );
}

export default App;