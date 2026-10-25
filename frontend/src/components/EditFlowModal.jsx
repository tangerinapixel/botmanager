// src/components/EditFlowModal.jsx — Design Premium Dark Mode
import React, { useState, useEffect, useRef } from 'react';
import { Pencil } from 'lucide-react';
import { Modal, Box, Typography, TextField, Button, Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFloppyDisk, faXmark, faCloudArrowUp, faImage, faTrashCan
} from '@fortawesome/free-solid-svg-icons';
import { updateFlow } from '../services/api';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 460,
  maxWidth: '95vw',
  bgcolor: 'var(--bg-elevated)',
  border: '1px solid var(--glass-border)',
  borderRadius: '18px',
  boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
  p: 0,
  outline: 'none',
  overflow: 'hidden',
};

function EditFlowModal({ open, onClose, flow, onFlowUpdated }) {
  const [trigger, setTrigger] = useState('');
  const [response, setResponse] = useState('');
  const [matchType, setMatchType] = useState('equals');
  const [newImage, setNewImage] = useState(null);
  const [flowState, setFlowState] = useState(flow);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (flow) {
      setTrigger(flow.trigger);
      setResponse(Array.isArray(flow.response) ? flow.response.join(' || ') : flow.response);
      setMatchType(flow.matchType || 'equals');
      setFlowState(flow);
      setNewImage(null);
    }
  }, [flow]);

  const handleSave = async () => {
    let imageUrl = flowState?.imageUrl || flow?.imageUrl || '';

    if (newImage) {
      const formData = new FormData();
      formData.append('image', newImage);
      try {
        const uploadResponse = await fetch('http://localhost:5005/api/upload-image', {
          method: 'POST', body: formData,
        });
        const result = await uploadResponse.json();
        imageUrl = result.imageUrl;
      } catch {
        alert('Erro ao enviar imagem');
        return;
      }
    }

    const updatedFlow = {
      ...flow,
      trigger,
      response: response.includes('||')
        ? response.split('||').map(r => r.trim())
        : [response.trim()],
      imageUrl: imageUrl || '',
      matchType,
    };

    try {
      await updateFlow(updatedFlow);
      onFlowUpdated(updatedFlow);
      onClose();
    } catch {
      alert('Erro ao atualizar fluxo. Veja o console.');
    }
  };

  if (!flow) return null;

  const matchOptions = [
    { value: 'equals',   label: 'Exatamente igual (recomendado)' },
    { value: 'includes', label: 'Contém (menos preciso)' },
  ];

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={modalStyle}>
        {/* ── Cabeçalho ── */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Pencil size={15} style={{ color: 'var(--accent-primary)' }} /> Editar Fluxo
          </Typography>
          <Box
            onClick={onClose}
            sx={{
              width: 28, height: 28, borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'all 0.15s ease',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)' },
            }}
          >
            <FontAwesomeIcon icon={faXmark} style={{ fontSize: '14px' }} />
          </Box>
        </Box>

        {/* ── Corpo ── */}
        <Box sx={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Gatilho */}
          <TextField
            fullWidth
            label="Gatilho"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            size="small"
          />

          {/* Tipo de correspondência — select estilizado */}
          <Box>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', mb: '8px' }}>
              Tipo de Correspondência
            </Typography>
            <Box sx={{ display: 'flex', gap: '8px' }}>
              {matchOptions.map(opt => (
                <Box
                  key={opt.value}
                  onClick={() => setMatchType(opt.value)}
                  sx={{
                    flex: 1, textAlign: 'center',
                    padding: '8px 12px', borderRadius: '10px', cursor: 'pointer',
                    border: `1px solid ${matchType === opt.value ? 'rgba(79,142,247,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    backgroundColor: matchType === opt.value ? 'rgba(79,142,247,0.1)' : 'transparent',
                    transition: 'all 0.15s ease',
                    '&:hover': { backgroundColor: matchType === opt.value ? 'rgba(79,142,247,0.14)' : 'rgba(255,255,255,0.04)' },
                  }}
                >
                  <Typography sx={{
                    fontSize: '0.8rem', fontWeight: matchType === opt.value ? 600 : 400,
                    color: matchType === opt.value ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    transition: 'color 0.15s',
                  }}>
                    {opt.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Resposta */}
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Resposta (use || para múltiplas variações)"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            size="small"
          />

          {/* Imagem atual */}
          {flowState?.imageUrl && (
            <Box sx={{
              borderRadius: '10px', overflow: 'hidden',
              border: '1px solid var(--border-subtle)',
              position: 'relative',
            }}>
              <img
                src={`http://localhost:5005${flowState.imageUrl}`}
                alt="Imagem do fluxo"
                style={{ width: '100%', maxHeight: '100px', objectFit: 'cover', display: 'block' }}
              />
              <Button
                size="small"
                color="error"
                startIcon={<FontAwesomeIcon icon={faTrashCan} style={{ fontSize: '11px' }} />}
                onClick={() => setFlowState(prev => ({ ...prev, imageUrl: '' }))}
                sx={{
                  position: 'absolute', top: 8, right: 8,
                  backgroundColor: 'rgba(224,82,82,0.85)',
                  color: 'white', borderRadius: '8px',
                  fontSize: '0.72rem', padding: '3px 10px',
                  '&:hover': { backgroundColor: 'rgba(224,82,82,1)' },
                }}
              >
                Remover
              </Button>
            </Box>
          )}

          {/* Upload nova imagem */}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={(e) => setNewImage(e.target.files[0] || null)}
          />
          <Box
            onClick={() => fileInputRef.current?.click()}
            sx={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 14px', borderRadius: '10px', cursor: 'pointer',
              border: `1.5px dashed ${newImage ? 'var(--accent-success)' : 'rgba(255,255,255,0.1)'}`,
              backgroundColor: newImage ? 'rgba(37,211,102,0.04)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.18s ease',
              '&:hover': { borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.04)' },
            }}
          >
            <FontAwesomeIcon
              icon={newImage ? faImage : faCloudArrowUp}
              style={{ fontSize: '16px', color: newImage ? 'var(--accent-success)' : 'var(--text-muted)' }}
            />
            <Typography sx={{ fontSize: '0.8rem', color: newImage ? 'var(--accent-success)' : 'var(--text-muted)' }}>
              {newImage ? newImage.name : 'Substituir imagem (opcional)'}
            </Typography>
          </Box>
        </Box>

        {/* ── Rodapé ── */}
        <Box sx={{
          display: 'flex', justifyContent: 'flex-end', gap: '10px',
          padding: '14px 24px 20px',
          borderTop: '1px solid var(--border-subtle)',
        }}>
          <Button variant="outlined" onClick={onClose} size="small">
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={handleSave}
            startIcon={<FontAwesomeIcon icon={faFloppyDisk} style={{ fontSize: '12px' }} />}
          >
            Salvar Alterações
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

export default EditFlowModal;
