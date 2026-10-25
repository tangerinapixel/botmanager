// frontend/src/components/AppLayout.jsx — Layout Premium com Sidebar

import React, { useState, useEffect } from 'react';
import { Modal, Button, Typography, Box, CircularProgress } from '@mui/material';
import { MessageSquare, Bot, Wrench, Timer, LayoutDashboard, Settings2, Database, Terminal, Rocket, Activity, X, ChevronRight } from 'lucide-react';

import { useSocketProgress } from '../hooks/useSocketProgress';

import Sidebar from './Sidebar';
import ActivationModal from './ActivationModal';
import NewFlowForm from './NewFlowForm';
import FlowsGridList from './FlowsGridList';
import GreetingMessageManager from './GreetingMessageManager';
import ExportarEtiquetasModal from './ExportarEtiquetasModal';
import ExportarGruposModal from './ExportarGruposModal';
import BulkSenderModal from './BulkSenderModal';
import QRCodeDisplay from './QRCodeDisplay';
import IAConfigForm from './IAConfigForm/IAConfigForm';
import IAContentManager from './IAContentManager/IAContentManager';
import ConfirmDialog from './ConfirmDialog';
import IAPromptConfig from './IAPromptConfig/IAPromptConfig';
import LiveChatHub from './LiveChat/LiveChatHub';

const electronAPI = window.electronAPI;

export function AppLayout({ appState }) {
  const {
    waClientStatus, handleWhatsAppAction,
    isLoadingActivation, loadingMessage, isFadingOut, showActivationModal,
    isAppActivated, handleActivationSuccess,
    qrCodeUrl,
    saudacaoAtiva,
    setSaudacaoAtiva,
    greetings, addGreeting, deleteGreeting, editGreeting,
    openExportModal, setOpenExportModal,
    openExportGroupsModal, setOpenExportGroupsModal,
    activeConfigPage, setActiveConfigPage,
    confirmCloseModal, setConfirmCloseModal,
    tempoMinutos, setTempoMinutos, atualizarTempo,
    flows, handleAddFlow, handleDeleteFlow, handleUpdateFlow,
    respostasAtivas, toggleRespostas, notify,
    contextoIA, handleSaveContextoIA,
    iaAtiva,
    toggleIaAtiva,
    backendStatus,
    restartAttempt,
    maxAttempts,
    nextRetryIn,
    forceBackendRestart,
    systemLogs,
    isLogDrawerOpen,
    toggleLogDrawer,
  } = appState;

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hasVisitedLiveChat, setHasVisitedLiveChat] = useState(false);
  const loadingProgress = useSocketProgress(waClientStatus);

  useEffect(() => {
    if (activeConfigPage === 'liveChat' && !hasVisitedLiveChat) {
      setHasVisitedLiveChat(true);
    }
  }, [activeConfigPage, hasVisitedLiveChat]);

  return (
    <Box
      className="app-container"
      sx={{
        display: 'flex',
        flexDirection: 'row',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-base)',
      }}
    >
      {/* ── SIDEBAR ── */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(prev => !prev)}
        activeConfigPage={activeConfigPage}
        setActiveConfigPage={setActiveConfigPage}
        waClientStatus={waClientStatus}
        loadingProgress={loadingProgress}
        onConnect={handleWhatsAppAction}
      />

      {/* ── ÁREA PRINCIPAL ── */}
      <Box
        component="main"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {/* ── TOPBAR ── */}
        <Box
          component="header"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            height: '52px',
            flexShrink: 0,
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            WebkitAppRegion: 'drag',
            userSelect: 'none',
          }}
        >
          {/* Título dinâmico da página atual */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', WebkitAppRegion: 'no-drag' }}>
            {activeConfigPage === null && (
              <>
                <Box sx={{
                  width: 28, height: 28, borderRadius: '8px',
                  backgroundColor: 'rgba(79,142,247,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <LayoutDashboard size={13} style={{ color: 'var(--accent-primary)' }} />
                </Box>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                  Visão Geral
                </Typography>
              </>
            )}
            {activeConfigPage === 'configIA' && (
              <>
                <Box sx={{
                  width: 28, height: 28, borderRadius: '8px',
                  backgroundColor: 'rgba(79,142,247,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Settings2 size={13} style={{ color: 'var(--accent-primary)' }} />
                </Box>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                  Configuração da IA
                </Typography>
              </>
            )}
            {activeConfigPage === 'contentIA' && (
              <>
                <Box sx={{
                  width: 28, height: 28, borderRadius: '8px',
                  backgroundColor: 'rgba(79,142,247,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Database size={13} style={{ color: 'var(--accent-primary)' }} />
                </Box>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                  Conteúdo da IA
                </Typography>
              </>
            )}
            {activeConfigPage === 'promptIA' && (
              <>
                <Box sx={{
                  width: 28, height: 28, borderRadius: '8px',
                  backgroundColor: 'rgba(79,142,247,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Terminal size={13} style={{ color: 'var(--accent-primary)' }} />
                </Box>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                  Prompt da IA
                </Typography>
              </>
            )}
            {activeConfigPage === 'bulkSender' && (
              <>
                <Box sx={{
                  width: 28, height: 28, borderRadius: '8px',
                  backgroundColor: 'rgba(79,142,247,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Rocket size={13} style={{ color: 'var(--accent-primary)' }} />
                </Box>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                  Envio em Massa
                </Typography>
              </>
            )}
            {activeConfigPage === 'flowsPage' && (
              <>
                <Box sx={{
                  width: 28, height: 28, borderRadius: '8px',
                  backgroundColor: 'rgba(79,142,247,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <MessageSquare size={13} style={{ color: 'var(--accent-primary)' }} />
                </Box>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                  Todos os Fluxos
                </Typography>
              </>
            )}
            {activeConfigPage === 'liveChat' && (
              <>
                <Box sx={{
                  width: 28, height: 28, borderRadius: '8px',
                  backgroundColor: 'rgba(37,211,102,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <MessageSquare size={13} style={{ color: 'var(--accent-success)' }} />
                </Box>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                  Conversas & Atendimento
                </Typography>
              </>
            )}
          </Box>

          {/* Lado direito: QR Code badge + System Pulse + Botões de janela */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
            WebkitAppRegion: 'no-drag',
          }}>
            {/* QR Code badge se estiver aguardando scan */}
            {waClientStatus === 'qr' && (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(79, 142, 247, 0.1)',
                border: '1px solid var(--border-accent)',
                borderRadius: 'var(--radius-md)',
                padding: '4px 12px',
              }}>
                <span style={{ fontSize: '14px' }}>📱</span>
                <Typography sx={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 500 }}>
                  Escaneie o QR Code
                </Typography>
              </Box>
            )}

            {/* Badge de sincronização se estiver conectando */}
            {waClientStatus === 'loading' && (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(79, 142, 247, 0.1)',
                border: '1px solid var(--border-accent)',
                borderRadius: 'var(--radius-md)',
                padding: '4px 12px',
              }}>
                <CircularProgress size={12} sx={{ color: 'var(--accent-primary)' }} />
                <Typography sx={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 500 }}>
                  {loadingProgress > 0 ? `Sincronizando ${loadingProgress}%` : 'Conectando WhatsApp...'}
                </Typography>
              </Box>
            )}

            {/* ── SYSTEM PULSE ── */}
            <Box
              onClick={toggleLogDrawer}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                backgroundColor: isLogDrawerOpen ? 'rgba(79,142,247,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isLogDrawerOpen ? 'var(--border-accent)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '4px 10px 4px 8px',
                cursor: 'pointer',
                transition: 'background-color 0.2s, border-color 0.2s',
                '&:hover': {
                  backgroundColor: 'rgba(79,142,247,0.1)',
                  borderColor: 'var(--border-accent)',
                },
                maxWidth: '220px',
                overflow: 'hidden',
              }}
            >
              {/* Ponto pulsante */}
              {systemLogs.length > 0 ? (
                <Box sx={{
                  '@keyframes sysPulse': {
                    '0%': { boxShadow: '0 0 0 0 rgba(37,211,102,0.55)', transform: 'scale(0.92)' },
                    '70%': { boxShadow: '0 0 0 5px rgba(37,211,102,0)', transform: 'scale(1)' },
                    '100%': { boxShadow: '0 0 0 0 rgba(37,211,102,0)', transform: 'scale(0.92)' },
                  },
                  width: '7px', height: '7px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-success)',
                  animation: 'sysPulse 2s infinite',
                  flexShrink: 0,
                }} />
              ) : (
                <Activity size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              )}
              <Typography noWrap sx={{
                fontSize: '0.72rem',
                color: systemLogs.length > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
                fontWeight: 500,
                letterSpacing: '0.01em',
                flexShrink: 1,
                minWidth: 0,
              }}>
                {systemLogs.length > 0
                  ? systemLogs[systemLogs.length - 1].message.length > 30
                    ? systemLogs[systemLogs.length - 1].message.slice(0, 30) + '…'
                    : systemLogs[systemLogs.length - 1].message
                  : 'Sistema em espera'}
              </Typography>
              <ChevronRight size={11} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: isLogDrawerOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </Box>

            {/* ── BOTÕES DE JANELA CUSTOMIZADOS ── */}
            {electronAPI && (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                marginLeft: '4px',
                gap: 0,
              }}>
                {/* Minimizar */}
                <Box
                  onClick={() => electronAPI.minimizeWindow()}
                  title="Minimizar"
                  sx={{
                    width: 46, height: 40,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontSize: '14px',
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)' },
                    transition: 'background-color 0.15s, color 0.15s',
                    userSelect: 'none',
                  }}
                >
                  —
                </Box>
                {/* Maximizar / Restaurar */}
                <Box
                  onClick={() => electronAPI.maximizeWindow()}
                  title="Maximizar"
                  sx={{
                    width: 46, height: 40,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontSize: '11px',
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)' },
                    transition: 'background-color 0.15s, color 0.15s',
                    userSelect: 'none',
                  }}
                >
                  □
                </Box>
                {/* Fechar */}
                <Box
                  onClick={() => electronAPI.closeWindow()}
                  title="Fechar"
                  sx={{
                    width: 46, height: 40,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontSize: '16px',
                    borderRadius: '0 0 0 0',
                    '&:hover': { backgroundColor: '#c42b1c', color: '#ffffff' },
                    transition: 'background-color 0.15s, color 0.15s',
                    userSelect: 'none',
                  }}
                >
                  ×
                </Box>
              </Box>
            )}
          </Box>
        </Box>

        {/* ── CONTEÚDO SCROLLÁVEL ── */}
        <Box
          className="main-content-area"
          sx={{
            height: 'calc(100vh - 52px)',
            overflow: 'hidden',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxSizing: 'border-box',
          }}
        >
          {/* QR Code display */}
          {waClientStatus === 'qr' && <QRCodeDisplay url={qrCodeUrl} />}

          {/* Conteúdo principal — só aparece se estiver ativado */}
          {(isAppActivated || !electronAPI) && (
            <>
              {/* ── VISÃO GERAL (dashboard home) ── */}
              {!activeConfigPage && (
                <Box
                  className="main-flex"
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
                    gap: '24px',
                    alignItems: 'stretch',
                    width: '100%',
                    height: '100%',
                    minHeight: 0,
                  }}
                >
                  {/* Coluna: Novo Fluxo & Expiração */}
                  <Box className="main-column" sx={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', height: '100%', boxSizing: 'border-box', minHeight: 0 }}>
                    {/* Cabeçalho Expiração */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', mb: '4px' }}>
                      <Box sx={{
                        width: 28, height: 28, borderRadius: '8px',
                        backgroundColor: 'rgba(79,142,247,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Timer size={13} style={{ color: 'var(--accent-primary)' }} />
                      </Box>
                      <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                        Expiração por Gatilho
                      </Typography>
                    </Box>

                    {/* Campo de expiração integrado */}
                    <Box sx={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                      background: 'var(--bg-overlay)',
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                      <input
                        type="number" min={1} value={tempoMinutos}
                        onChange={(e) => setTempoMinutos(e.target.value)}
                        style={{
                          width: '72px', padding: '7px 10px',
                          borderRadius: '10px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(28,35,51,0.7)',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-family)',
                          fontSize: '0.85rem',
                          outline: 'none',
                        }}
                      />
                      <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>minutos</Typography>
                      <Button
                        variant="outlined" size="small"
                        onClick={atualizarTempo}
                        sx={{
                          ml: 'auto', color: 'var(--text-secondary)',
                          borderColor: 'var(--border-default)', minWidth: '80px',
                        }}
                      >
                        Atualizar
                      </Button>
                    </Box>
                    <NewFlowForm onAddFlow={handleAddFlow} />
                  </Box>

                  {/* Coluna: Saudações */}
                  <Box className="main-column" sx={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', height: '100%', boxSizing: 'border-box', minHeight: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '14px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Box sx={{
                          width: 28, height: 28, borderRadius: '8px',
                          backgroundColor: 'rgba(79,142,247,0.12)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <MessageSquare size={13} style={{ color: 'var(--accent-primary)' }} />
                        </Box>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                          Saudações
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Typography sx={{ fontSize: '0.72rem', color: saudacaoAtiva ? 'var(--accent-success)' : 'var(--text-muted)', fontWeight: 500, transition: 'color 0.2s' }}>
                          {saudacaoAtiva ? 'On' : 'Off'}
                        </Typography>
                        <label className="switch">
                          <input type="checkbox" checked={saudacaoAtiva} onChange={async (e) => {
                            const novoStatus = e.target.checked;
                            try {
                              const res = await fetch("http://localhost:5005/api/saudacao-ativa", {
                                method: "POST", headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ativo: novoStatus })
                              });
                              const json = await res.json();
                              if (json.success) {
                                setSaudacaoAtiva(novoStatus);
                                notify(novoStatus ? 'Saudações ativadas' : 'Saudações desativadas', 'success');
                              } else {
                                notify(json.message || 'Erro ao mudar status da saudação.', 'error');
                              }
                            } catch (err) {
                              notify('Erro ao alterar estado da saudação', 'error');
                              console.error(err);
                            }
                          }} />
                          <span className="slider round"></span>
                        </label>
                      </Box>
                    </Box>
                    <GreetingMessageManager greetings={greetings} onAddGreeting={addGreeting} onDeleteGreeting={deleteGreeting} onEditGreeting={editGreeting} />
                  </Box>

                  {/* Coluna: IA + Ferramentas */}
                  <Box className="main-column" sx={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', height: '100%', boxSizing: 'border-box', minHeight: 0 }}>
                    {/* Cabeçalho Fluxos IA */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '4px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Box sx={{
                          width: 28, height: 28, borderRadius: '8px',
                          backgroundColor: 'rgba(79,142,247,0.12)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Bot size={13} style={{ color: 'var(--accent-primary)' }} />
                        </Box>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                          Fluxos IA
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Typography sx={{ fontSize: '0.72rem', color: iaAtiva ? 'var(--accent-success)' : 'var(--text-muted)', fontWeight: 500, transition: 'color 0.2s' }}>
                          {iaAtiva ? 'On' : 'Off'}
                        </Typography>
                        <label className="switch">
                          <input type="checkbox" checked={iaAtiva} onChange={toggleIaAtiva} />
                          <span className="slider round"></span>
                        </label>
                      </Box>
                    </Box>

                    {/* Seção IA */}
                    <Box sx={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      display: 'flex', flexDirection: 'column', gap: '8px',
                      background: 'var(--bg-overlay)',
                    }}>
                      <Button variant="outlined" size="small"
                        sx={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)', justifyContent: 'flex-start' }}
                        onClick={() => setActiveConfigPage('configIA')}>
                        Configuração da IA
                      </Button>
                      <Button variant="outlined" size="small"
                        sx={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)', justifyContent: 'flex-start' }}
                        onClick={() => setActiveConfigPage('contentIA')}>
                        Gerenciar Conteúdo
                      </Button>
                      <Button variant="outlined" size="small"
                        sx={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)', justifyContent: 'flex-start' }}
                        onClick={() => setActiveConfigPage('promptIA')}>
                        Editar Prompt
                      </Button>
                    </Box>

                    {/* Cabeçalho Ferramentas */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', mb: '4px' }}>
                      <Box sx={{
                        width: 28, height: 28, borderRadius: '8px',
                        backgroundColor: 'rgba(79,142,247,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Wrench size={13} style={{ color: 'var(--accent-primary)' }} />
                      </Box>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                        Ferramentas
                      </Typography>
                    </Box>

                    {/* Seção Ferramentas */}
                    <Box sx={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      display: 'flex', flexDirection: 'column', gap: '8px',
                      background: 'var(--bg-overlay)',
                    }}>
                      <Button variant="outlined" size="small"
                        sx={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)', justifyContent: 'flex-start' }}
                        onClick={() => setOpenExportModal(true)}>
                        Exportar por Etiqueta
                      </Button>
                      <Button variant="outlined" size="small"
                        sx={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)', justifyContent: 'flex-start' }}
                        onClick={() => setOpenExportGroupsModal(true)}>
                        Exportar Contatos de Grupos
                      </Button>
                      <Button variant="outlined" size="small"
                        sx={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)', justifyContent: 'flex-start' }}
                        onClick={() => setActiveConfigPage('bulkSender')}>
                        Envio em Massa
                      </Button>
                    </Box>
                  </Box>

                  {/* Coluna: Lista de Fluxos */}
                  <Box className="main-column" sx={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', height: '100%', boxSizing: 'border-box', minHeight: 0 }}>
                    <FlowsGridList
                      flows={flows}
                      onDeleteFlow={handleDeleteFlow}
                      onUpdateFlow={handleUpdateFlow}
                      respostasAtivas={respostasAtivas}
                      toggleRespostas={toggleRespostas}
                      limit={6}
                      onSeeMore={() => setActiveConfigPage('flowsPage')}
                    />
                  </Box>
                </Box>
              )}

              {/* ── PÁGINAS DE CONFIGURAÇÃO ── */}
              {activeConfigPage === 'configIA' && <IAConfigForm onClose={() => setActiveConfigPage(null)} />}
              {activeConfigPage === 'contentIA' && <IAContentManager onClose={() => setActiveConfigPage(null)} />}
              {activeConfigPage === 'promptIA' && <IAPromptConfig onClose={() => setActiveConfigPage(null)} fullContext={contextoIA} onSave={handleSaveContextoIA} />}
              {activeConfigPage === 'bulkSender' && (
                <BulkSenderModal
                  onClose={() => setActiveConfigPage(null)}
                  confirmCloseModal={confirmCloseModal}
                  setConfirmCloseModal={setConfirmCloseModal}
                />
              )}
              {activeConfigPage === 'flowsPage' && (
                <Box className="flows-page-container">
                  <Box className="flows-page-header">
                    <Typography variant="h6" sx={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      Todos os Fluxos Criados
                    </Typography>
                    <Button variant="contained" size="small" onClick={() => setActiveConfigPage(null)}>
                      Voltar ao Painel
                    </Button>
                  </Box>
                  <FlowsGridList
                    flows={flows}
                    onDeleteFlow={handleDeleteFlow}
                    onUpdateFlow={handleUpdateFlow}
                    respostasAtivas={respostasAtivas}
                    toggleRespostas={toggleRespostas}
                  />
                </Box>
              )}
              {/* ── CENTRAL DE CONVERSAS (LIVE CHAT) COM PERSISTÊNCIA EM MEMÓRIA ── */}
              {(hasVisitedLiveChat || activeConfigPage === 'liveChat') && (
                <Box
                  sx={{
                    display: activeConfigPage === 'liveChat' ? 'flex' : 'none',
                    flex: 1,
                    height: '100%',
                    width: '100%',
                    minHeight: 0,
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  <LiveChatHub />
                </Box>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* ── MODAIS GLOBAIS ── */}
      {electronAPI && showActivationModal && !isAppActivated && (
        <ActivationModal
          open={showActivationModal}
          onClose={() => notify("A ativação é necessária.", "warning")}
          onSuccess={handleActivationSuccess}
        />
      )}
      <ExportarEtiquetasModal open={openExportModal} onClose={() => setOpenExportModal(false)} />
      <ExportarGruposModal open={openExportGroupsModal} onClose={() => setOpenExportGroupsModal(false)} />

      {/* ── LOG DRAWER (Gaveta de Observabilidade) ── */}
      {isLogDrawerOpen && (
        <Box
          onClick={toggleLogDrawer}
          sx={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 1200,
            backgroundColor: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(2px)',
          }}
        />
      )}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          right: isLogDrawerOpen ? 0 : '-360px',
          width: '340px',
          height: '100vh',
          zIndex: 1201,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
          transition: 'right 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Header da gaveta */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Box sx={{
              width: 28, height: 28, borderRadius: '8px',
              backgroundColor: 'rgba(79,142,247,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Activity size={13} style={{ color: 'var(--accent-primary)' }} />
            </Box>
            <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
              Log do Sistema
            </Typography>
            {systemLogs.length > 0 && (
              <Box sx={{
                backgroundColor: 'rgba(79,142,247,0.15)',
                border: '1px solid rgba(79,142,247,0.25)',
                borderRadius: '20px',
                padding: '1px 7px',
              }}>
                <Typography sx={{ fontSize: '0.68rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                  {systemLogs.length}
                </Typography>
              </Box>
            )}
          </Box>
          <Box
            onClick={toggleLogDrawer}
            sx={{
              width: 28, height: 28, borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)' },
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            <X size={14} />
          </Box>
        </Box>

        {/* Lista de logs */}
        <Box sx={{
          flex: 1, overflowY: 'auto', padding: '8px',
          display: 'flex', flexDirection: 'column', gap: '4px',
          '&::-webkit-scrollbar': { width: '4px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { background: 'var(--border-subtle)', borderRadius: '4px' },
        }}>
          {systemLogs.length === 0 ? (
            <Box sx={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '10px', padding: '40px 20px',
            }}>
              <Activity size={28} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                Nenhuma ação registrada ainda.<br />Os logs do bot aparecerão aqui em tempo real.
              </Typography>
            </Box>
          ) : (
            [...systemLogs].reverse().map((log) => {
              const colorMap = {
                success: { dot: 'var(--accent-success)', bg: 'rgba(37,211,102,0.06)', border: 'rgba(37,211,102,0.12)', text: 'rgba(37,211,102,0.9)' },
                warning: { dot: 'var(--accent-warning)', bg: 'rgba(240,165,0,0.06)', border: 'rgba(240,165,0,0.12)', text: 'rgba(240,165,0,0.9)' },
                error:   { dot: 'var(--accent-danger)',  bg: 'rgba(224,82,82,0.06)',   border: 'rgba(224,82,82,0.12)',   text: 'rgba(224,82,82,0.9)'   },
                info:    { dot: 'var(--accent-primary)', bg: 'rgba(79,142,247,0.06)',   border: 'rgba(79,142,247,0.12)',  text: 'rgba(79,142,247,0.9)'  },
              };
              const c = colorMap[log.type] || colorMap.info;
              const hora = log.timestamp
                ? new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : '';
              return (
                <Box
                  key={log.id}
                  sx={{
                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: `1px solid ${c.border}`,
                    backgroundColor: c.bg,
                  }}
                >
                  <Box sx={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    backgroundColor: c.dot,
                    flexShrink: 0, mt: '4px',
                  }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', mb: '2px' }}>
                      <Typography sx={{ fontSize: '0.68rem', color: c.text, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        {log.action}
                      </Typography>
                      <Typography sx={{ fontSize: '0.64rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {hora}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.45, wordBreak: 'break-word' }}>
                      {log.message}
                    </Typography>
                  </Box>
                </Box>
              );
            })
          )}
        </Box>

        {/* Rodapé */}
        {systemLogs.length > 0 && (
          <Box sx={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}>
            <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              {systemLogs.length} de 50 eventos armazenados
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}