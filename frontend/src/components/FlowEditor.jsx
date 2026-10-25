// src/components/FlowEditor.jsx
import React, { useState, useEffect } from 'react';
import socket from '../socket/socket'; // Correção do import apontando para a pasta socket correta

const FlowEditor = () => {
  const [flows, setFlows] = useState([]);
  const [newFlow, setNewFlow] = useState('');

  useEffect(() => {
    // Quando o frontend recebe fluxos atualizados
    socket.on('loadedFlows', (updatedFlows) => {
      setFlows(updatedFlows);
    });

    // Quando o frontend recebe o status de uma mudança nos fluxos
    return () => {
      socket.off('loadedFlows');
    };
  }, []);

  const handleFlowChange = (e) => {
    setNewFlow(e.target.value);
  };

  const addFlow = () => {
    if (newFlow.trim() !== '') {
      const newFlowObj = {
        id: Date.now().toString(),
        content: newFlow,
      };

      // Envia o novo fluxo para o backend
      socket.emit('updateFlow', newFlowObj);

      // Limpa o campo
      setNewFlow('');
    }
  };

  const handleDeleteFlow = (id) => {
    // Filtra e remove o fluxo com o id passado
    const updatedFlows = flows.filter((flow) => flow.id !== id);
    setFlows(updatedFlows);

    // Envia a atualização de fluxos para o backend
    socket.emit('updateFlows', updatedFlows);
  };

  return (
    <div>
      <h2>Editor de Fluxos</h2>
      <input
        type="text"
        value={newFlow}
        onChange={handleFlowChange}
        placeholder="Adicione um novo fluxo"
      />
      <button onClick={addFlow}>Adicionar Fluxo</button>

      <ul>
        {flows.map((flow) => (
          <li key={flow.id}>
            {flow.content}{' '}
            <button onClick={() => handleDeleteFlow(flow.id)}>Excluir</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FlowEditor;
