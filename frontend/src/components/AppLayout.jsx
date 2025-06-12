// src/components/AppLayout.jsx
import React from 'react';
import { Button, Typography, Box, CircularProgress } from '@mui/material';
import { QRCodeCanvas } from 'qrcode.react';

import Header from './Header';
import Footer from './Footer';
import ActivationModal from './ActivationModal';
import NewFlowForm from './NewFlowForm';
import FlowsGridList from './FlowsGridList';
import GreetingMessageManager from './GreetingMessageManager';
import ExportarEtiquetasModal from './ExportarEtiquetasModal';
import ExportarGruposModal from './ExportarGruposModal';
import BulkSenderModal from './BulkSenderModal';
import QRCodeDisplay from './QRCodeDisplay';
import { FADE_OUT_DURATION } from '../hooks/useAppLoading';

const electronAPI = window.electronAPI;

export function AppLayout({ appState }) {
  // A desestruturação das props está correta
  const {
    waClientStatus, handleWhatsAppAction, abrirModalMass, setAbrirModalMass,
    isLoadingActivation,  loadingMessage,  isFadingOut, showActivationModal, 
    isAppActivated, handleActivationSuccess,
    qrCodeUrl,
    saudacaoAtiva, // Apenas o valor, o setSaudacaoAtiva é usado em uma função que não está aqui
    setSaudacaoAtiva,
    greetings, addGreeting, deleteGreeting, editGreeting,
    openExportModal, setOpenExportModal,
    openExportGroupsModal, setOpenExportGroupsModal,
    tempoMinutos, setTempoMinutos, atualizarTempo,
    flows, handleAddFlow, handleDeleteFlow, handleUpdateFlow,
    respostasAtivas, toggleRespostas, notify
  } = appState;

  if ((isLoadingActivation || isFadingOut) && electronAPI) {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        backgroundColor: '#242424', // <-- 3. GARANTA O FUNDO ESCURO
        transition: `opacity ${FADE_OUT_DURATION}ms ease-out`, // 4. APLIQUE A TRANSIÇÃO
        opacity: isFadingOut ? 0 : 1, // 5. CONTROLE A OPACIDADE COM O ESTADO
      }}>
        <CircularProgress />
        <Typography sx={{
          mt: 2,
          color: 'white', // <-- 6. GARANTA A COR BRANCA DO TEXTO
        }}>
          {loadingMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <div className="app-container">
      <Header
        status={waClientStatus} 
        onConnect={handleWhatsAppAction} 
        onAbrirMass={() => setAbrirModalMass(true)} 
      />

      {/* MODAL DE ATIVAÇÃO: Renderizado no topo, se necessário */}
      {electronAPI && showActivationModal && !isAppActivated && (
        <ActivationModal 
          open={showActivationModal} 
          onClose={() => notify("A ativação é necessária para usar todas as funcionalidades.", "warning")} 
          onSuccess={handleActivationSuccess} 
        />
      )}
      
     {/* EXIBIÇÃO DO QR CODE: Renderizado condicionalmente, fora do fluxo principal */}
     {waClientStatus === 'qr' && (
  <QRCodeDisplay url={qrCodeUrl} />
)}
    
      {/* CONTEÚDO PRINCIPAL: Só é renderizado se o app estiver ativado OU não estiver no Electron */}
      {(isAppActivated || !electronAPI) && (
        <div className="main-flex">
          {/* Coluna 1: Saudações */}
          <div className="main-column greeting-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <strong>🗨️ Saudações:</strong>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={saudacaoAtiva}
                  onChange={async (e) => {
                      const novoStatus = e.target.checked;
                      // A lógica de fetch para /api/saudacao-ativa permanece no useAppState
                      // Aqui, apenas chamamos uma função que viria das props se necessário
                      // ou mantemos a lógica aqui se for simples.
                      // Por simplicidade na refatoração, manter a lógica aqui é aceitável por enquanto.
                      try {
                        const res = await fetch("http://localhost:5001/api/saudacao-ativa", {
                          method: "POST",
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ ativo: novoStatus })
                        });
                        const json = await res.json();
                        if (json.success) {
                          setSaudacaoAtiva(novoStatus); // setSaudacaoAtiva vem do appState
                          notify(novoStatus ? 'Saudações ativadas' : 'Saudações desativadas', 'success');
                        } else {
                          notify(json.message || 'Erro ao mudar status da saudação.', 'error');
                        }
                      } catch (err) {
                        notify('Erro ao alterar estado da saudação', 'error');
                        console.error(err);
                      }
                  }}
                  style={{ transform: 'scale(1.4)' }}
                />
                <span style={{ fontWeight: 'bold', color: saudacaoAtiva ? 'green' : 'red' }}>
                  {saudacaoAtiva ? 'Ligado' : 'Desligado'}
                </span>
              </label>
            </div>
            <GreetingMessageManager
              greetings={greetings}
              onAddGreeting={addGreeting}
              onDeleteGreeting={deleteGreeting}
              onEditGreeting={editGreeting} 
            />
          </div>

          {/* Coluna 2: Ações */}
          <div className="main-column" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Button variant="outlined" onClick={() => setOpenExportModal(true)}>Exportar por Etiqueta</Button>
            <Button variant="outlined" color="success" onClick={() => setAbrirModalMass(true)}>Enviar mensagem em massa</Button>
            <Button variant="outlined" color="primary" onClick={() => setOpenExportGroupsModal(true)}>Exportar Contatos de Grupos</Button>
           
 </div>

          {/* Coluna 3: Novo Fluxo */}
          <div className="main-column flow-box">
            <div className="box-tempo-expiracao">
              <div className="icon">⏱️​</div>
              <div style={{ flex: '1' }}>
                <div className="tempo-label">Tempo de expiração por gatilho (em minutos):</div>
                <input
                  type="number"
                  min={1}
                  value={tempoMinutos}
                  onChange={(e) => setTempoMinutos(e.target.value)}
                  className="tempo-input"
                />
                <button className="tempo-btn" onClick={atualizarTempo}>Atualizar</button>
              </div>
            </div>
            <NewFlowForm onAddFlow={handleAddFlow} />
          </div>

          {/* Coluna 4: Lista de Fluxos */}
          <div className="main-column flow-box" style={{ maxWidth: '400px' }}>
            <FlowsGridList
              flows={flows}
              onDeleteFlow={handleDeleteFlow}
              onUpdateFlow={handleUpdateFlow}
              respostasAtivas={respostasAtivas}
              toggleRespostas={toggleRespostas}
            />
          </div>
        </div>
      )}
      
      {/* Modais são renderizados fora do fluxo principal para evitar problemas de layout */}
      <ExportarEtiquetasModal open={openExportModal} onClose={() => setOpenExportModal(false)} />
      <ExportarGruposModal open={openExportGroupsModal} onClose={() => setOpenExportGroupsModal(false)} />
      {abrirModalMass && (<BulkSenderModal open={abrirModalMass} onClose={() => setAbrirModalMass(false)} />)}

      <Footer />
    </div>
  );
}