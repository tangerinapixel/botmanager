// frontend/src/components/UpdateModal/UpdateModal.jsx
// Modal / Popup de Notificação e Download de Atualizações do Aplicativo

import React from 'react';
import { Download, Sparkles, CheckCircle2, AlertTriangle, RefreshCw, X, ArrowRight } from 'lucide-react';
import './UpdateModal.css';

export default function UpdateModal({
  isOpen,
  step,
  updateInfo,
  progress,
  errorMessage,
  onStartDownload,
  onQuitAndInstall,
  onClose
}) {
  if (!isOpen) return null;

  const version = updateInfo?.version || 'Nova Versão';
  const currentVersion = updateInfo?.currentVersion || '2.2.0';
  const releaseNotes = updateInfo?.releaseNotes;

  return (
    <div className="update-modal-backdrop" onClick={onClose}>
      <div className="update-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="update-modal-glow" />

        <button className="update-modal-close-btn" onClick={onClose} title="Fechar">
          <X size={18} />
        </button>

        {/* --- ESTADO 1: NOVA VERSÃO DISPONÍVEL --- */}
        {step === 'available' && (
          <>
            <div className="update-modal-header">
              <div className="update-modal-icon-badge">
                <Sparkles size={28} color="#ffffff" />
              </div>
              <div>
                <h2 className="update-modal-title">Nova Versão Disponível!</h2>
                <div className="update-modal-subtitle">
                  Versão Atual: <span>v{currentVersion}</span>
                  <ArrowRight size={14} />
                  <span className="update-version-tag">v{version}</span>
                </div>
              </div>
            </div>

            <div className="update-changelog-box">
              <h3>Novidades e Melhorias:</h3>
              {releaseNotes ? (
                <div style={{ whiteSpace: 'pre-wrap' }}>{releaseNotes}</div>
              ) : (
                <p>Esta atualização traz melhorias de estabilidade, correções importantes e otimizações de performance.</p>
              )}
            </div>

            <div className="update-modal-actions">
              <button className="update-btn-secondary" onClick={onClose}>
                Lembrar Mais Tarde
              </button>
              <button className="update-btn-primary" onClick={onStartDownload}>
                <Download size={18} />
                Baixar e Atualizar
              </button>
            </div>
          </>
        )}

        {/* --- ESTADO 2: BAIXANDO ATUALIZAÇÃO --- */}
        {step === 'downloading' && (
          <>
            <div className="update-modal-header">
              <div className="update-modal-icon-badge">
                <RefreshCw size={26} color="#ffffff" className="spin-icon" />
              </div>
              <div>
                <h2 className="update-modal-title">Baixando Atualização...</h2>
                <div className="update-modal-subtitle">
                  Preparando os arquivos da versão <span className="update-version-tag">v{version}</span>
                </div>
              </div>
            </div>

            <div className="update-progress-container">
              <div className="update-progress-info">
                <span>{progress.transferredMb} MB de {progress.totalMb} MB</span>
                <span>{progress.percent}% ({progress.speedMb} MB/s)</span>
              </div>
              <div className="update-progress-track">
                <div
                  className="update-progress-fill"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '14px 0 20px' }}>
              O download está sendo executado em segundo plano. Você pode continuar usando o sistema normalmente.
            </p>

            <div className="update-modal-actions">
              <button className="update-btn-secondary" onClick={onClose}>
                Continuar em Segundo Plano
              </button>
            </div>
          </>
        )}

        {/* --- ESTADO 3: PRONTO PARA INSTALAR --- */}
        {step === 'downloaded' && (
          <>
            <div className="update-modal-header">
              <div className="update-modal-icon-badge success">
                <CheckCircle2 size={30} color="#ffffff" />
              </div>
              <div>
                <h2 className="update-modal-title">Pronto para Instalar!</h2>
                <div className="update-modal-subtitle">
                  A versão <span className="update-version-tag">v{version}</span> foi baixada com sucesso.
                </div>
              </div>
            </div>

            <div className="update-changelog-box" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
              <p style={{ margin: 0, color: '#a7f3d0' }}>
                O instalador foi preparado no seu computador. Ao clicar no botão abaixo, o aplicativo será reiniciado para aplicar as melhorias automaticamente (leva cerca de 5 segundos).
              </p>
            </div>

            <div className="update-modal-actions">
              <button className="update-btn-secondary" onClick={onClose}>
                Instalar Depois
              </button>
              <button className="update-btn-primary success" onClick={onQuitAndInstall}>
                <RefreshCw size={18} />
                Reiniciar e Atualizar Agora
              </button>
            </div>
          </>
        )}

        {/* --- ESTADO 4: ERRO --- */}
        {step === 'error' && (
          <>
            <div className="update-modal-header">
              <div className="update-modal-icon-badge" style={{ background: '#dc2626' }}>
                <AlertTriangle size={28} color="#ffffff" />
              </div>
              <div>
                <h2 className="update-modal-title">Falha na Atualização</h2>
                <div className="update-modal-subtitle">
                  Não foi possível completar o download
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.875rem', color: '#fca5a5', margin: '16px 0 22px' }}>
              {errorMessage || 'Ocorreu uma falha temporária de rede ao baixar o pacote.'}
            </p>

            <div className="update-modal-actions">
              <button className="update-btn-secondary" onClick={onClose}>
                Fechar
              </button>
              <button className="update-btn-primary" onClick={onStartDownload}>
                <RefreshCw size={18} />
                Tentar Novamente
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
