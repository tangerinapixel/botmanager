// src/components/GreetingMessageManager.jsx — Padronização Final
import React, { useState } from 'react';
import { Box, Typography, TextField, Button, IconButton, Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPencil, faTrashCan, faCommentDots, faFloppyDisk, faPlus,
} from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from './ConfirmDialog';
import { useNotifier } from '../context/Notifier';

/* ── Variantes de animação ─────────────────────────────── */
const rowVariants = {
  hidden:  { opacity: 0, y: 8, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22 } },
  exit:    { opacity: 0, x: 16, scale: 0.97, transition: { duration: 0.16 } },
};

/* ── Card de saudação individual ────────────────────────── */
function GreetingRow({ greeting, index, onEdit, onDelete }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div variants={rowVariants} initial="hidden" animate="visible" exit="exit" layout>
      <Box
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        sx={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          padding: '10px 12px',
          borderRadius: '10px',
          border: `1px solid ${hovered ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
          backgroundColor: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
          transition: 'all 0.18s ease',
          position: 'relative',
        }}
      >
        {/* Badge de índice */}
        <Box sx={{
          width: 22, height: 22, borderRadius: '6px', flexShrink: 0, mt: '1px',
          backgroundColor: 'rgba(79,142,247,0.1)',
          border: '1px solid rgba(79,142,247,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
            {String.fromCharCode(65 + index)}
          </Typography>
        </Box>

        {/* Texto */}
        <Typography sx={{
          flex: 1, fontSize: '0.8rem', color: 'var(--text-secondary)',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
        }}>
          {greeting.message}
        </Typography>

        {/* Ações hover */}
        <Box sx={{
          display: 'flex', gap: '4px', flexShrink: 0,
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'translateX(0)' : 'translateX(6px)',
          transition: 'opacity 0.18s ease, transform 0.18s ease',
          pointerEvents: hovered ? 'auto' : 'none',
        }}>
          <Tooltip title="Editar" placement="top">
            <IconButton size="small" onClick={() => onEdit(greeting)} sx={{
              width: 26, height: 26, borderRadius: '7px',
              color: 'var(--accent-primary)',
              backgroundColor: 'rgba(79,142,247,0.08)',
              '&:hover': { backgroundColor: 'rgba(79,142,247,0.18)' },
            }}>
              <FontAwesomeIcon icon={faPencil} style={{ fontSize: '10px' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Remover" placement="top">
            <IconButton size="small" onClick={() => onDelete(greeting.id)} sx={{
              width: 26, height: 26, borderRadius: '7px',
              color: 'var(--accent-danger)',
              backgroundColor: 'rgba(224,82,82,0.08)',
              '&:hover': { backgroundColor: 'rgba(224,82,82,0.18)' },
            }}>
              <FontAwesomeIcon icon={faTrashCan} style={{ fontSize: '10px' }} />
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
function GreetingMessageManager({ greetings, onAddGreeting, onEditGreeting, onDeleteGreeting }) {
  const notify = useNotifier();
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSave = () => {
    if (!message.trim()) return;
    if (editing) {
      onEditGreeting(editing.id, message);
      setEditing(null);
    } else {
      onAddGreeting({ id: Date.now().toString(), message });
    }
    setMessage('');
  };

  const handleEdit = (greeting) => {
    setMessage(greeting.message);
    setEditing(greeting);
  };

  const handleCancel = () => {
    setEditing(null);
    setMessage('');
  };

  const handleClearHistory = async () => {
    try {
      const response = await fetch('http://localhost:5005/api/limpar-historico-saudacao', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        notify('Histórico de saudações limpo com sucesso!', 'success');
      } else {
        throw new Error(data.message || 'Falha ao limpar histórico.');
      }
    } catch (error) {
      notify(`Erro: ${error.message}`, 'error');
    } finally {
      setDialogOpen(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', minHeight: 0 }}>

      {/* Input de mensagem */}
      <TextField
        label={editing ? 'Editando mensagem...' : 'Nova mensagem de saudação'}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        fullWidth
        multiline
        minRows={3}
        size="small"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
        }}
        sx={{ '& .MuiOutlinedInput-root': { borderColor: editing ? 'rgba(79,142,247,0.4)' : undefined } }}
      />

      {/* Botões de ação do form */}
      <Box sx={{ display: 'flex', gap: '8px' }}>
        <Button
          variant="contained"
          color="primary"
          size="small"
          onClick={handleSave}
          disabled={!message.trim()}
          startIcon={<FontAwesomeIcon icon={editing ? faFloppyDisk : faPlus} style={{ fontSize: '11px' }} />}
          sx={{ flex: 1 }}
        >
          {editing ? 'Salvar Alterações' : 'Adicionar'}
        </Button>

        {editing && (
          <Button variant="outlined" size="small" onClick={handleCancel} sx={{ minWidth: '80px' }}>
            Cancelar
          </Button>
        )}

        {!editing && (
          <Button
            variant="outlined"
            size="small"
            onClick={() => setDialogOpen(true)}
            sx={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)', minWidth: '120px' }}
          >
            Limpar Histórico
          </Button>
        )}
      </Box>

      {/* Lista de saudações */}
      {greetings.length > 0 && (
        <Box sx={{
          borderTop: '1px solid var(--border-subtle)',
          pt: '10px',
          display: 'flex', flexDirection: 'column', gap: '4px',
          flexGrow: 1, overflowY: 'auto', minHeight: 0,
        }}>
          <Typography sx={{
            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em',
            color: 'var(--text-muted)', textTransform: 'uppercase', mb: '4px',
          }}>
            Mensagens ({greetings.length})
          </Typography>
          <AnimatePresence mode="popLayout">
            {greetings.map((greeting, index) => (
              <GreetingRow
                key={greeting.id}
                greeting={greeting}
                index={index}
                onEdit={handleEdit}
                onDelete={onDeleteGreeting}
              />
            ))}
          </AnimatePresence>
        </Box>
      )}

      {greetings.length === 0 && (
        <Box sx={{
          textAlign: 'center', py: '20px',
          border: '1px dashed rgba(255,255,255,0.07)',
          borderRadius: '10px', color: 'var(--text-muted)',
        }}>
          <FontAwesomeIcon icon={faCommentDots} style={{ fontSize: '18px', display: 'block', margin: '0 auto 6px' }} />
          <Typography sx={{ fontSize: '0.78rem' }}>Nenhuma saudação cadastrada.</Typography>
        </Box>
      )}

      <ConfirmDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleClearHistory}
        title="Confirmar Limpeza de Histórico"
        message="Essa ação apagará todo o histórico de saudações. Contatos antigos serão tratados como novos e receberão a saudação novamente."
      />
    </Box>
  );
}

export default GreetingMessageManager;
