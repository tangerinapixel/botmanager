// src/components/FlowsGridList.jsx — Passo 5+6: Lista moderna com hover actions + animações
import React, { useState, useMemo } from 'react';
import { Box, Typography, Tooltip, IconButton } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPencil, faTrashCan, faImage, faChevronRight,
  faBolt, faCircle,
} from '@fortawesome/free-solid-svg-icons';
import EditFlowModal from './EditFlowModal';
import ConfirmDialog from './ConfirmDialog';
import { useNotifier } from '../context/Notifier';

/* ── Badge de tipo de correspondência ───────────────────── */
function MatchBadge({ type }) {
  const isContains = type === 'includes';
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: '0.62rem', fontWeight: 600,
      letterSpacing: '0.05em', textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: '5px',
      backgroundColor: isContains ? 'rgba(240,165,0,0.1)' : 'rgba(79,142,247,0.1)',
      color: isContains ? 'var(--accent-warning)' : 'var(--accent-primary)',
      border: `1px solid ${isContains ? 'rgba(240,165,0,0.2)' : 'rgba(79,142,247,0.2)'}`,
      flexShrink: 0,
    }}>
      {isContains ? 'Contém' : 'Igual'}
    </Box>
  );
}

/* ── Linha individual de fluxo ────────────────────────────── */
const rowVariants = {
  hidden:  { opacity: 0, y: 8, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, x: 20, scale: 0.97, transition: { duration: 0.18, ease: 'easeIn' } },
};

function FlowRow({ flow, respostasAtivas, onEdit, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const isActive = respostasAtivas;

  const responseText = Array.isArray(flow.response)
    ? flow.response.join(' · ')
    : (flow.response || '');

  return (
    <motion.div
      variants={rowVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
    >
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        borderRadius: '10px',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
        backgroundColor: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        transition: 'all 0.18s ease',
        cursor: 'default',
        position: 'relative',
        minWidth: 0,
      }}
    >
      {/* Indicador de status ativo/inativo */}
      <Box sx={{ flexShrink: 0, mt: '2px' }}>
        <FontAwesomeIcon
          icon={faCircle}
          style={{
            fontSize: '7px',
            color: isActive ? 'var(--accent-success)' : 'var(--text-muted)',
            filter: isActive ? '0 0 6px rgba(37,211,102,0.6)' : 'none',
            transition: 'color 0.2s ease',
          }}
        />
      </Box>

      {/* Conteúdo de texto */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', mb: '3px', flexWrap: 'wrap' }}>
          <Typography sx={{
            fontSize: '0.85rem', fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: '160px',
          }}>
            {flow.trigger}
          </Typography>
          <MatchBadge type={flow.matchType} />
          {flow.imageUrl && (
            <Tooltip title="Contém imagem" placement="top">
              <Box sx={{ color: 'var(--text-muted)', lineHeight: 1 }}>
                <FontAwesomeIcon icon={faImage} style={{ fontSize: '11px' }} />
              </Box>
            </Tooltip>
          )}
        </Box>

        <Typography sx={{
          fontSize: '0.77rem',
          color: 'var(--text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}>
          {responseText || <em>Sem resposta definida</em>}
        </Typography>
      </Box>

      {/* Botões de ação — visíveis apenas no hover */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        flexShrink: 0,
        opacity: hovered ? 1 : 0,
        transform: hovered ? 'translateX(0)' : 'translateX(6px)',
        transition: 'opacity 0.18s ease, transform 0.18s ease',
        pointerEvents: hovered ? 'auto' : 'none',
      }}>
        <Tooltip title="Editar fluxo" placement="top">
          <IconButton
            size="small"
            onClick={() => onEdit(flow)}
            sx={{
              width: 28, height: 28,
              color: 'var(--accent-primary)',
              backgroundColor: 'rgba(79,142,247,0.08)',
              borderRadius: '8px',
              '&:hover': {
                backgroundColor: 'rgba(79,142,247,0.18)',
              },
            }}
          >
            <FontAwesomeIcon icon={faPencil} style={{ fontSize: '11px' }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Remover fluxo" placement="top">
          <IconButton
            size="small"
            onClick={() => onDelete(flow)}
            sx={{
              width: 28, height: 28,
              color: 'var(--accent-danger)',
              backgroundColor: 'rgba(224,82,82,0.08)',
              borderRadius: '8px',
              '&:hover': {
                backgroundColor: 'rgba(224,82,82,0.18)',
              },
            }}
          >
            <FontAwesomeIcon icon={faTrashCan} style={{ fontSize: '11px' }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════ */
function FlowsGridList({ flows, onDeleteFlow, onUpdateFlow, respostasAtivas, toggleRespostas, limit, onSeeMore }) {
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [flowToDelete, setFlowToDelete] = useState(null);
  const notify = useNotifier();

  const handleEdit = (flow) => {
    setEditingFlow(flow);
    setModalOpen(true);
  };

  const handleDeleteClick = (flow) => {
    setFlowToDelete(flow);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!flowToDelete) return;
    try {
      const response = await fetch(`/api/fluxos/${flowToDelete.id}`, { method: 'DELETE' });
      if (response.ok) {
        onDeleteFlow(flowToDelete.id);
        notify('Fluxo removido com sucesso!', 'success');
      } else {
        const error = await response.json();
        notify(`Erro ao deletar: ${error.message}`, 'error');
      }
    } catch {
      notify('Erro inesperado ao deletar o fluxo.', 'error');
    } finally {
      setDialogOpen(false);
      setFlowToDelete(null);
    }
  };

  const handleSave = async (updatedFlow) => {
    try {
      const response = await fetch(`/api/fluxos/${updatedFlow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFlow),
      });
      if (response.ok) {
        onUpdateFlow(updatedFlow);
        setEditingFlow(null);
        setModalOpen(false);
        notify('Fluxo atualizado com sucesso!', 'success');
      } else {
        const error = await response.json();
        notify(`Erro ao atualizar: ${error.message}`, 'error');
      }
    } catch {
      notify('Erro inesperado ao atualizar o fluxo.', 'error');
    }
  };

  const flowsToShow = useMemo(() => {
    const reversed = [...flows].reverse();
    return limit ? reversed.slice(0, limit) : reversed;
  }, [flows, limit]);

  return (
    <>
      {/* ── Cabeçalho ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '16px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Box sx={{
            width: 28, height: 28, borderRadius: '8px',
            backgroundColor: 'rgba(79,142,247,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FontAwesomeIcon icon={faBolt} style={{ fontSize: '13px', color: 'var(--accent-primary)' }} />
          </Box>
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Fluxos Ativos
          </Typography>
          <Box sx={{
            padding: '2px 8px', borderRadius: '6px',
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {flows.length}
            </Typography>
          </Box>
        </Box>

        {/* Toggle de respostas ativas */}
        <Tooltip title={respostasAtivas ? 'Respostas automáticas ativas — clique para desativar' : 'Respostas desativadas — clique para ativar'} placement="left">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={toggleRespostas}>
            <Typography sx={{ fontSize: '0.72rem', color: respostasAtivas ? 'var(--accent-success)' : 'var(--text-muted)', fontWeight: 500, transition: 'color 0.2s' }}>
              {respostasAtivas ? 'On' : 'Off'}
            </Typography>
            <label className="switch" onClick={e => e.stopPropagation()}>
              <input type="checkbox" checked={respostasAtivas} onChange={toggleRespostas} />
              <span className="slider round"></span>
            </label>
          </Box>
        </Tooltip>
      </Box>

      {/* ── Lista de fluxos ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1, overflowY: limit ? 'hidden' : 'auto', pr: '2px', minHeight: 0 }}>
        <AnimatePresence mode="popLayout">
        {flowsToShow.length === 0 ? (
          <Box sx={{
            textAlign: 'center', py: '32px',
            border: '1px dashed rgba(255,255,255,0.08)',
            borderRadius: '10px',
            color: 'var(--text-muted)',
          }}>
            <FontAwesomeIcon icon={faBolt} style={{ fontSize: '20px', marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
            <Typography sx={{ fontSize: '0.82rem' }}>Nenhum fluxo criado ainda.</Typography>
            <Typography sx={{ fontSize: '0.75rem', mt: '4px' }}>Use o formulário ao lado para começar.</Typography>
          </Box>
        ) : (
          flowsToShow.map((flow) => (
            <FlowRow
              key={flow.id}
              flow={flow}
              respostasAtivas={respostasAtivas}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
            />
          ))
        )}
        </AnimatePresence>
      </Box>

      {/* ── Botão "Ver todos" ── */}
      {limit && flows.length > limit && (
        <Box
          onClick={onSeeMore}
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            mt: '10px', padding: '8px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.07)',
            cursor: 'pointer', color: 'var(--text-secondary)',
            fontSize: '0.8rem', fontWeight: 500,
            transition: 'all 0.15s ease',
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.04)',
              color: 'var(--text-primary)',
              borderColor: 'rgba(255,255,255,0.14)',
            },
          }}
        >
          Ver todos os fluxos ({flows.length})
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: '11px' }} />
        </Box>
      )}

      {/* ── Modais ── */}
      <EditFlowModal
        open={isModalOpen}
        onClose={() => setModalOpen(false)}
        flow={editingFlow}
        onSave={handleSave}
        onFlowUpdated={onUpdateFlow}
      />
      <ConfirmDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={confirmDelete}
        title="Confirmar Remoção"
        message="Tem certeza que deseja remover este fluxo? Esta ação não pode ser desfeita."
      />
    </>
  );
}

export default FlowsGridList;
