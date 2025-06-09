// src/components/NewFlowForm.jsx
import React, { useState, useRef } from 'react';
import { addFlow, uploadImage } from '../services/api';
import { useNotifier } from '../context/Notifier'; // depois dos outros imports

function NewFlowForm({ onAddFlow }) {
  const notify = useNotifier();
  const [newTrigger, setNewTrigger] = useState('');
  const [newResponse, setNewResponse] = useState('');
  const [newImage, setNewImage] = useState('');
  const fileInputRef = useRef(null);
  const [matchType, setMatchType] = useState('equals'); // default = igual 
  

  // Dentro de NewFlowForm.jsx

const handleSubmit = async () => {
    let imageUrl = '';
  
    if (!newTrigger || !newResponse) {
      notify('⚠️ Preencha todos os campos obrigatórios!', 'error');
      return;
    }
  
    if (newImage) {
      // Sua lógica de upload de imagem está ótima, permanece igual
      try {
        const uploadData = await uploadImage(newImage);
        imageUrl = uploadData.imageUrl;
      } catch (error) {
        notify('❌ Erro ao enviar imagem', 'error');
        return;
      }
    }
  
    const respostas = newResponse.includes('||')
      ? newResponse.split('||').map(res => res.trim())
      : [newResponse.trim()];
  
    // ===== CORREÇÃO 1: Criamos o objeto SEM o ID. =====
    // Deixamos o backend cuidar da criação do ID.
    const flowParaEnviar = {
      trigger: newTrigger,
      response: respostas,
      imageUrl: imageUrl || '',
      matchType: matchType
    };
  
    try {
      // Supondo que addFlow faz o POST para /api/adicionar-fluxo e retorna o JSON da resposta
      const result = await addFlow(flowParaEnviar); 
      console.log("🔁 Retorno da API ao adicionar:", result);

      if (result.success) {
        // ===== CORREÇÃO 2: Pegamos o fluxo COM O ID OFICIAL de volta da resposta da API =====
        // O backend retorna a lista completa em `result.flows`. O novo é o último.
        const flowOficialComId = result.flows[result.flows.length - 1];

        // ===== CORREÇÃO 3: Usamos ESSE objeto para atualizar o estado do React =====
        onAddFlow(flowOficialComId);
        
        notify(result.message || '✅ Novo fluxo salvo com sucesso!', 'success');
  
        // O resto do código para limpar o formulário permanece igual
        setNewTrigger('');
        setNewResponse('');
        setNewImage('');
        if (fileInputRef.current) {
          fileInputRef.current.value = null;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });

      } else {
        notify(result.message || 'Falha ao adicionar fluxo no servidor.', 'error');
      }

    } catch (err) {
      notify('❌ Erro ao adicionar fluxo.', 'error');
      console.error(err);
    }
};

  return (
    <div
      style={{
        borderLeft: '0px solid #4a90e2',
        borderRadius: '5px',
        paddingLeft: '20px',
        paddingBottom: '15px',
        paddingTop: '10px',
        paddingRight:'20px',
        alignItems: 'flex-start',
        boxShadow: '0 1px 6px rgba(0, 0, 0, 0.05)',
        flexWrap: 'wrap'
      }}
    >
     
      <div style={{ flex: 1 }}>
        <h3 style={{ marginTop: 0 }}>💬 Novo Fluxo</h3>
  
        <div className="card">
        {/*<div style={{ fontSize: '24px', color: '#4a90e2' }}>💬​</div>*/}
          <input
            type="text"
            value={newTrigger}
            onChange={(e) => setNewTrigger(e.target.value)}
            placeholder="Novo gatilho"
            style={{ marginBottom: '10px' }}
          />

               <div style={{ marginBottom: '15px' }}>
  <label style={{ fontWeight: '500', display: 'block', marginBottom: '5px' }}>
    🎯 Correspondência do gatilho:
  </label>
  <select
    value={matchType}
    onChange={(e) => setMatchType(e.target.value)}
    style={{ padding: '6px 10px', borderRadius: '5px' }}
  >
    <option value="equals">Exatamente igual (recomendado)</option>
    <option value="includes">Contém (menos preciso)</option>
  </select>
</div>
  
          <textarea
            value={newResponse}
            onChange={(e) => setNewResponse(e.target.value)}
            placeholder="Separe variações de sua resposta com || (duplo pipe). Ex: Olá || Seja bem-vindo || Como posso te ajudar?"
            rows={5}
            style={{ marginBottom: '15px' }}
          />
  
  <label
  style={{
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    fontWeight: 'normal',
    fontSize: '14px',
    color: '#444',
    marginBottom: '15px'
  }}
>
  <span style={{ fontWeight: '500' }}>📁 Selecionar imagem (opcional)</span>

  <input
    type="file"
    accept="image/*"
    onChange={(e) => {
      const file = e.target.files[0];
      if (file) {
        setNewImage(file);
      } else {
        setNewImage('');
        if (fileInputRef.current) fileInputRef.current.value = null;
      }
    }}
    ref={fileInputRef}
    style={{ display: 'none' }}
  />

  <button
    type="button"
    onClick={() => fileInputRef.current?.click()}
    style={{
      backgroundColor: '#4a90e2',
      color: '#fff',
      border: 'none',
      borderRadius: '5px',
      padding: '6px 12px',
      cursor: 'pointer',
      width: 'fit-content',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    }}
  >
    📎 Escolher arquivo
  </button>

  <span style={{ fontStyle: 'italic', color: '#666' }}>
    {newImage ? newImage.name : 'Nenhum arquivo selecionado'}
  </span>
</label>

        </div>
  
        <button className="btn blue" onClick={handleSubmit}>
        💾​ Salvar Novo Fluxo
        </button>
      </div>
    </div>
  );
  
  
}

export default NewFlowForm;
