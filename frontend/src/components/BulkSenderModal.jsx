// src/components/BulkSenderModal.jsx
import React, { useEffect, useState } from 'react';
import { Modal, TextField, Checkbox, FormControlLabel, Typography } from '@mui/material';
import * as XLSX from 'xlsx';
import io from 'socket.io-client';
import './BulkSenderModal.css';
import { useNotifier } from '../context/Notifier';

import {
  enviarMensagemEmMassa,
  pausarEnvio,
  retomarEnvio,
  pararEnvio
} from '../services/massSenderAPI';

const socket = io('http://localhost:5001');

function BulkSenderModal({ open, onClose }) {
  const notify = useNotifier();
  const [contacts, setContacts] = useState([]);
  const [message, setMessage] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [progresso, setProgresso] = useState(0);
  const [ultimoEnviado, setUltimoEnviado] = useState('');
  const [velocidade, setVelocidade] = useState(3); 
  const [pausaAposEnvios, setPausaAposEnvios] = useState(20); 
  const [duracaoPausaSegundos, setDuracaoPausaSegundos] = useState(60); 
  const [removerDuplicados, setRemoverDuplicados] = useState(false);
  const [modoAmigavel, setModoAmigavel] = useState(false);
  const [modoEscuro, setModoEscuro] = useState(false);
  // const [isLoading, setIsLoading] = useState(false); // Se você reintroduzir, descomente

  useEffect(() => {
    socket.on('massProgress', ({ progressoAtual, enviado, total, sucesso, erro }) => { // Agora desestrutura 'progressoAtual' e os outros campos
  setProgresso(progressoAtual); // Usa 'progressoAtual' para atualizar o estado
  if (enviado) { // Verifica se 'enviado' existe
    setUltimoEnviado(sucesso ? `✅ ${enviado}` : `❌ ${enviado} (Falha: ${erro || 'Erro desconhecido'})`);
  }
  // Você também tem 'total' aqui, que pode ser usado para calcular uma porcentagem se desejar
  // const percentual = total > 0 ? Math.round((progressoAtual / total) * 100) : 0;
  // console.log(`Progresso: ${percentual}%`);
});

    const handleMassNotification = ({ message: msg, type }) => { // Renomeei 'message' para 'msg' para evitar conflito de escopo
        if (msg && type) {
            notify(msg, type);
        }
    };
    socket.on('massNotification', handleMassNotification);

    // Adicione o listener para massComplete se o backend for emitir e você quiser tratar aqui
    // const handleMassComplete = (data) => { ... notify com resumo ... };
    // socket.on('massComplete', handleMassComplete);

    return () => {
      socket.off('massProgress');
      socket.off('massNotification', handleMassNotification);
      // socket.off('massComplete', handleMassComplete);
    };
  }, [notify]);
  

  const limparSomenteEnvio = () => {
    setContacts([]);
    setProgresso(0);
    setUltimoEnviado('');
  };

  const resetarTudo = async () => {
    try {
        await pararEnvio(); 
    } catch(err) {
        console.error("Erro ao tentar parar envio durante reset:", err);
        notify('⚠️ Erro ao tentar parar envio pendente durante o reset.', 'warning');
    }
    setContacts([]);
    setMessage('');
    setImage(null);
    setImagePreview(null);
    setProgresso(0);
    setUltimoEnviado('');
    setVelocidade(3);
    setPausaAposEnvios(20);
    setDuracaoPausaSegundos(60); 
    setRemoverDuplicados(false);
    setModoAmigavel(false);
    setModoEscuro(false);
    // setIsLoading(false); // Se usar isLoading
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);

        const newContacts = json
          .map((row) => {
            const numero = String(
              row.numero || row.número || row['Número com DDD'] ||
              row.telefone || row['Telefone'] || ''
            ).replace(/[^\d]/g, '');
            const nome = row.nome || row.Nome || row['Contato'] || '';
            if (!numero) return null; 
            return { numero, nome: nome.trim() };
          })
          .filter(Boolean); 

        const todos = removerDuplicados
          ? Array.from(new Map(newContacts.map(c => [c.numero, c])).values())
          : newContacts; 

        setContacts(todos);
        if (todos.length > 0) {
            notify(`👍 ${todos.length} contatos carregados da planilha.`, 'success');
        } else {
            notify('ℹ️ Nenhum contato válido encontrado na planilha.', 'info');
        }
        console.log('📥 Contatos carregados:', todos);
      } catch (error) {
          console.error("Erro ao processar planilha:", error);
          notify('❌ Erro ao processar a planilha. Verifique o formato.', 'error');
      }
    };
    reader.onerror = () => {
        notify('❌ Erro ao ler o arquivo da planilha.', 'error');
    }
    reader.readAsBinaryString(file);
    e.target.value = null;
  };


  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        notify('⚠️ Por favor, selecione um arquivo de imagem.', 'warning');
        e.target.value = null;
        return;
    }
    setImage(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
    notify(`📷 Imagem "${file.name}" selecionada.`, 'info');
    e.target.value = null;
  };

  const handleEnviar = async () => {
    if (contacts.length === 0) {
        notify('⚠️ Adicione contatos da planilha antes de enviar.', 'warning');
        return;
    }
    if (!message.trim() && !image) {
        notify('⚠️ Escreva uma mensagem ou selecione uma imagem para enviar.', 'warning');
        return;
    }
    if (pausaAposEnvios > 0 && duracaoPausaSegundos <= 0) {
        notify('⚠️ Se "Pausa a cada" for maior que 0, a "Duração da Pausa" também deve ser maior que 0.', 'warning');
        return;
    }

    const formData = new FormData();
    formData.append('contacts', JSON.stringify(contacts));
    formData.append('message', message);
    formData.append('velocidade', velocidade);
    formData.append('pausaCada', pausaAposEnvios); 
    formData.append('duracaoPausaSegundos', duracaoPausaSegundos); 
    formData.append('modoAmigavel', modoAmigavel);
    formData.append('modoEscuro', modoEscuro);
    formData.append('removerDuplicados', removerDuplicados); 
    if (image) formData.append('image', image);

    notify('🚀 Iniciando processo de envio...', 'info'); 
    try {
      const res = await enviarMensagemEmMassa(formData); 
      if (res && res.success) { 
        notify(res.message || '✅ Solicitação de envio em massa recebida pelo servidor.', 'success');
      } else {
        notify(res.message || '⚠️ Falha ao iniciar o envio no servidor.', 'warning');
      }
    } catch (err) {
      console.error("Erro em handleEnviar:", err);
      notify(err.message || '❌ Erro crítico ao tentar iniciar o envio.', 'error');
    }
  };

  const handlePausar = async () => {
    try {
      const res = await pausarEnvio();
      if (res && res.success !== undefined) {
        notify(res.message || '⏸️ Solicitação de pausa enviada.', res.success ? 'info' : 'warning');
      } else {
        notify('⚠️ Resposta inesperada do servidor ao pausar.', 'warning');
      }
    } catch (err) {
      console.error("Erro em handlePausar:", err);
      notify(err.message || '❌ Erro ao solicitar pausa.', 'error');
    }
  };

  const handleRetomar = async () => {
    try {
      const res = await retomarEnvio();
      if (res && res.success !== undefined) {
        notify(res.message || '▶️ Solicitação para retomar envio enviada.', res.success ? 'info' : 'warning');
      } else {
        notify('⚠️ Resposta inesperada do servidor ao retomar.', 'warning');
      }
    } catch (err) {
      console.error("Erro em handleRetomar:", err);
      notify(err.message || '❌ Erro ao solicitar retomada.', 'error');
    }
  };

  const handleParar = async () => {
    try {
      const res = await pararEnvio();
      if (res && res.success !== undefined) {
        notify(res.message || '🛑 Solicitação para parar envio enviada.', res.success ? 'info' : 'warning');
      } else {
        notify('⚠️ Resposta inesperada do servidor ao parar.', 'warning');
      }
      limparSomenteEnvio(); 
      setProgresso(0);
      setUltimoEnviado('');
    } catch (err) {
      console.error("Erro em handleParar:", err);
      notify(err.message || '❌ Erro ao parar envio.', 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={(_, reason) => {
        // Se um envio estiver em progresso (isLoading=true), talvez impedir o fechar pelo backdrop/esc
        // if (isLoading && (reason === 'backdropClick' || reason === 'escapeKeyDown')) return; 
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return; // Mantendo sua lógica original
        resetarTudo(); 
        onClose();
      }}
    >
      <div className="modal-mass-container"> {/* Este div controla o tamanho geral via CSS */}
        <button className="modal-close-btn" onClick={() => {resetarTudo(); onClose();}}>×</button>
        <div className="modal-columns">

          {/* COLUNA 1 (Permanece como no seu original) */}
          <div className="modal-column">
            <div className="modal-title">📁 Contatos</div>
            <input type="file" accept=".xls,.xlsx,.csv" onChange={handleFileUpload} />
            <textarea
              className="contact-list"
              readOnly
              value={
                contacts.length > 0
                  ? contacts.map(c => `${c.numero}${c.nome ? ' - ' + c.nome : ''}`).join('\n')
                  : 'Nenhum contato carregado...'
              }
            />
            <FormControlLabel
              control={<Checkbox checked={removerDuplicados} onChange={e => setRemoverDuplicados(e.target.checked)} />}
              label="Remover duplicados ao carregar"
            />
            <FormControlLabel
              control={<Checkbox checked={modoAmigavel} onChange={e => setModoAmigavel(e.target.checked)} />}
              label="Modo amigável (Olá Nome...)"
            />
            <FormControlLabel
              control={<Checkbox checked={modoEscuro} onChange={e => setModoEscuro(e.target.checked)} />}
              label="Modo escuro (ATENÇÃO...)"
            />
          </div>

          {/* COLUNA 2 (Com o ajuste de layout solicitado) */}
          <div className="modal-column">
            <div className="modal-title">✏️ Mensagem</div>
            <TextField
              fullWidth
              multiline
              minRows={5} 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite a mensagem a ser enviada"
              variant="outlined" // Mantido como no seu último código enviado
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, width: '100%', marginTop: '8px' }}>
              <span>{progresso} / {contacts.length} carregados</span>
              {ultimoEnviado && (
                <span style={{ color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>
                  Último: <strong>{ultimoEnviado}</strong>
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: '10px', marginBottom: '10px' }}>
              <button className="enviar-btn" onClick={handleEnviar}>Enviar</button>
              <button className="pausar-btn" onClick={handlePausar}>Pausar</button>
              <button className="pausar-btn" onClick={handleRetomar}>Retomar</button> {/* Considerar classe css diferente para "Retomar" se o estilo for diferente */}
              <button className="parar-btn" onClick={handleParar}>Parar</button>
            </div>

            {/* Campo Velocidade (agora em sua própria linha) */}
            <TextField
              className="modal-input" // Mantendo sua classe original
              label="Velocidade (segundos / msg)" 
              type="number"
              value={velocidade}
              onChange={(e) => setVelocidade(Math.max(1, parseInt(e.target.value) || 1))}
              InputProps={{ inputProps: { min: 1 } }}
              variant="outlined"
              size="small"
              style={{marginBottom: '10px', width: '100%'}} // Ocupa a largura toda
            />
            
            {/* Novo div para agrupar "Pausa a cada" e "Duração da Pausa" horizontalmente */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <TextField
                className="modal-input" // Mantendo sua classe original
                label="Pausa a CADA X envios" 
                type="number"
                value={pausaAposEnvios} 
                onChange={(e) => setPausaAposEnvios(Math.max(0, parseInt(e.target.value) || 0))}
                InputProps={{ inputProps: { min: 0 } }}
                helperText="0 para sem pausa" // Simplificado
                variant="outlined"
                size="small"
                style={{ flex: 1 }} // Para dividir o espaço
              />
              <TextField
                className="modal-input" // Mantendo sua classe original
                label="Duração da Pausa (s)"
                type="number"
                value={duracaoPausaSegundos}
                onChange={(e) => setDuracaoPausaSegundos(Math.max(0, parseInt(e.target.value) || 0))}
                InputProps={{ inputProps: { min: 0 } }}
                helperText="Tempo da pausa" // Simplificado
                variant="outlined"
                size="small"
                disabled={pausaAposEnvios <= 0} 
                style={{ flex: 1 }} // Para dividir o espaço
              />
            </div>
          </div>

          {/* COLUNA 3 (Permanece como no seu original) */}
          <div className="modal-column">
            <div className="modal-title">🌅 Imagem (opcional)</div>
            <input type="file" accept="image/*" onChange={handleImageUpload} />
            <div className="preview-image" style={{border: '1px dashed #ccc', marginTop: '5px', height: '180px', display: 'flex', alignItems:'center', justifyContent:'center'}}>
              {imagePreview ? (
                <img src={imagePreview} alt="preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : <Typography variant="caption" color="textSecondary">Preview da imagem aqui...</Typography>} 
              {/* ^ Mantive Typography aqui como estava no seu último envio. Se isso causa erro de Typography not defined, precisa importar. */}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default BulkSenderModal;