// src/components/NewFlowForm.jsx — Passo 4: Design Premium
import React, { useState, useRef } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import {
  Box, Typography, Tooltip, RadioGroup, FormControlLabel,
  Radio, Button, Chip
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleInfo, faCloudArrowUp, faXmark, faFloppyDisk, faImage
} from '@fortawesome/free-solid-svg-icons';
import { addFlow, uploadImage } from '../services/api';
import { useNotifier } from '../context/Notifier';

/* ── Label de seção ─────────────────────────────────────── */
function FieldLabel({ children, tooltip }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', mb: '8px' }}>
      <Typography sx={{
        fontSize: '0.78rem', fontWeight: 600,
        color: 'var(--text-secondary)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {children}
      </Typography>
      {tooltip && (
        <Tooltip title={tooltip} placement="top" arrow>
          <Box sx={{ cursor: 'help', color: 'var(--text-muted)', lineHeight: 1 }}>
            <FontAwesomeIcon icon={faCircleInfo} style={{ fontSize: '12px' }} />
          </Box>
        </Tooltip>
      )}
    </Box>
  );
}

/* ── Área de upload estilizada ──────────────────────────── */
function UploadArea({ fileInputRef, newImage, onFileChange, onClear }) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) onFileChange(file);
  };

  return (
    <Box>
      <FieldLabel>Imagem (opcional)</FieldLabel>

      {/* Input nativo oculto */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files[0];
          if (file) onFileChange(file);
          else onClear();
        }}
      />

      {/* Zona de drop / botão */}
      <Box
        onClick={() => !newImage && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        sx={{
          position: 'relative',
          border: `1.5px dashed ${dragging ? 'var(--accent-primary)' : newImage ? 'var(--accent-success)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: '12px',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: dragging
            ? 'rgba(79,142,247,0.06)'
            : newImage
            ? 'rgba(37,211,102,0.05)'
            : 'rgba(255,255,255,0.03)',
          cursor: newImage ? 'default' : 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': !newImage ? {
            borderColor: 'rgba(255,255,255,0.22)',
            backgroundColor: 'rgba(255,255,255,0.05)',
          } : {},
        }}
      >
        <Box sx={{
          width: 36, height: 36, borderRadius: '8px',
          backgroundColor: newImage ? 'rgba(37,211,102,0.12)' : 'rgba(79,142,247,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <FontAwesomeIcon
            icon={newImage ? faImage : faCloudArrowUp}
            style={{
              fontSize: '16px',
              color: newImage ? 'var(--accent-success)' : 'var(--accent-primary)',
            }}
          />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {newImage ? (
            <Typography sx={{ fontSize: '0.8rem', color: 'var(--accent-success)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {newImage.name}
            </Typography>
          ) : (
            <>
              <Typography sx={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                Clique para selecionar ou arraste aqui
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                PNG, JPG, GIF, WEBP
              </Typography>
            </>
          )}
        </Box>

        {newImage && (
          <Box
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            sx={{
              width: 26, height: 26, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(224,82,82,0.12)',
              cursor: 'pointer', flexShrink: 0,
              transition: 'all 0.15s ease',
              '&:hover': { backgroundColor: 'rgba(224,82,82,0.22)' },
            }}
          >
            <FontAwesomeIcon icon={faXmark} style={{ fontSize: '12px', color: 'var(--accent-danger)' }} />
          </Box>
        )}
      </Box>
    </Box>
  );
}

/* ══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════ */
function NewFlowForm({ onAddFlow }) {
  const notify = useNotifier();
  const [newTrigger, setNewTrigger] = useState('');
  const [newResponse, setNewResponse] = useState('');
  const [newImage, setNewImage] = useState('');
  const [matchType, setMatchType] = useState('equals');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const clearImage = () => {
    setNewImage('');
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  const handleSubmit = async () => {
    if (!newTrigger.trim() || !newResponse.trim()) {
      notify('Preencha o gatilho e a resposta antes de salvar.', 'error');
      return;
    }

    setLoading(true);
    let imageUrl = '';

    if (newImage) {
      try {
        const uploadData = await uploadImage(newImage);
        imageUrl = uploadData.imageUrl;
      } catch {
        notify('Erro ao enviar a imagem.', 'error');
        setLoading(false);
        return;
      }
    }

    const respostas = newResponse.includes('||')
      ? newResponse.split('||').map(r => r.trim())
      : [newResponse.trim()];

    const flowParaEnviar = {
      trigger: newTrigger.trim(),
      response: respostas,
      imageUrl: imageUrl || '',
      matchType,
    };

    try {
      const result = await addFlow(flowParaEnviar);
      if (result.success) {
        const flowOficialComId = result.flows[result.flows.length - 1];
        onAddFlow(flowOficialComId);
        notify(result.message || 'Fluxo salvo com sucesso!', 'success');
        setNewTrigger('');
        setNewResponse('');
        clearImage();
      } else {
        notify(result.message || 'Falha ao adicionar fluxo.', 'error');
      }
    } catch {
      notify('Erro ao adicionar fluxo.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', boxSizing: 'border-box' }}>

      {/* Título da seção */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', pb: '4px', borderBottom: '1px solid var(--border-subtle)' }}>
        <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquarePlus size={16} style={{ color: 'var(--accent-primary)' }} /> Novo Fluxo
        </Typography>
      </Box>

      {/* ── Campo: Gatilho ── */}
      <Box>
        <FieldLabel tooltip="Palavra ou frase que ativará este fluxo quando o usuário enviar no WhatsApp">
          Gatilho
        </FieldLabel>
        <input
          className="card"
          type="text"
          value={newTrigger}
          onChange={(e) => setNewTrigger(e.target.value)}
          placeholder="Ex: oi, olá, cardápio..."
          style={{
            width: '100%',
            padding: '9px 14px',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(28,35,51,0.7)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-family)',
            fontSize: '0.875rem',
            outline: 'none',
            backdropFilter: 'blur(8px)',
            boxSizing: 'border-box',
            transition: 'all 0.18s ease',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'var(--accent-primary)';
            e.target.style.borderWidth = '1.5px';
            e.target.style.boxShadow = '0 0 0 3px rgba(79,142,247,0.14)';
          }}
          onBlur={e => {
            e.target.style.borderColor = 'rgba(255,255,255,0.1)';
            e.target.style.borderWidth = '1px';
            e.target.style.boxShadow = 'none';
          }}
        />
      </Box>

      {/* ── Campo: Tipo de correspondência ── */}
      <Box>
        <FieldLabel tooltip="'Igual' ativa apenas quando a mensagem for exatamente o gatilho. 'Contém' ativa quando o gatilho aparece em qualquer parte da mensagem.">
          Ajuste de Gatilho
        </FieldLabel>
        <RadioGroup
          row
          value={matchType}
          onChange={(e) => setMatchType(e.target.value)}
          sx={{ gap: '8px' }}
        >
          {[
            { value: 'equals', label: 'Igual' },
            { value: 'includes', label: 'Contém' },
          ].map(opt => (
            <FormControlLabel
              key={opt.value}
              value={opt.value}
              control={
                <Radio
                  size="small"
                  disableRipple
                  sx={{
                    color: 'rgba(255,255,255,0.25)',
                    padding: '4px',
                    '&.Mui-checked': { color: 'var(--accent-primary)' },
                  }}
                />
              }
              label={
                <Typography sx={{ fontSize: '0.83rem', color: matchType === opt.value ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: matchType === opt.value ? 500 : 400, transition: 'all 0.15s' }}>
                  {opt.label}
                </Typography>
              }
              sx={{
                margin: 0,
                padding: '6px 14px 6px 8px',
                borderRadius: '10px',
                border: `1px solid ${matchType === opt.value ? 'rgba(79,142,247,0.35)' : 'rgba(255,255,255,0.08)'}`,
                backgroundColor: matchType === opt.value ? 'rgba(79,142,247,0.08)' : 'transparent',
                transition: 'all 0.15s ease',
                cursor: 'pointer',
              }}
            />
          ))}
        </RadioGroup>
      </Box>

      {/* ── Campo: Resposta ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0 }}>
        <FieldLabel tooltip="Use || (duplo pipe) para separar variações de resposta. O bot enviará uma delas aleatoriamente. Ex: Olá! || Oi, tudo bem? || Como posso ajudar?">
          Resposta (Aceita || para variações)
        </FieldLabel>
        <textarea
          value={newResponse}
          onChange={(e) => setNewResponse(e.target.value)}
          placeholder="Digite a resposta do bot... Use || para adicionar variações aleatórias."
          style={{
            width: '100%',
            flexGrow: 1,
            minHeight: '60px',
            padding: '10px 14px',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(28,35,51,0.7)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-family)',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            outline: 'none',
            resize: 'none',
            overflowY: 'auto',
            backdropFilter: 'blur(8px)',
            boxSizing: 'border-box',
            transition: 'all 0.18s ease',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'var(--accent-primary)';
            e.target.style.borderWidth = '1.5px';
            e.target.style.boxShadow = '0 0 0 3px rgba(79,142,247,0.14)';
          }}
          onBlur={e => {
            e.target.style.borderColor = 'rgba(255,255,255,0.1)';
            e.target.style.borderWidth = '1px';
            e.target.style.boxShadow = 'none';
          }}
        />
      </Box>

      {/* ── Upload de imagem ── */}
      <UploadArea
        fileInputRef={fileInputRef}
        newImage={newImage}
        onFileChange={setNewImage}
        onClear={clearImage}
      />

      {/* ── Botão Salvar ── */}
      <Button
        variant="contained"
        color="primary"
        onClick={handleSubmit}
        disabled={loading}
        startIcon={<FontAwesomeIcon icon={faFloppyDisk} style={{ fontSize: '14px' }} />}
        fullWidth
        sx={{
          height: '44px',
          borderRadius: '12px',
          fontSize: '0.88rem',
          fontWeight: 600,
          background: 'linear-gradient(135deg, #3a78e8 0%, #4f8ef7 100%)',
          boxShadow: '0 4px 16px rgba(79,142,247,0.3)',
          letterSpacing: '0.02em',
          mt: '4px',
          '&:hover': {
            background: 'linear-gradient(135deg, #4f8ef7 0%, #6aa1ff 100%)',
            boxShadow: '0 6px 24px rgba(79,142,247,0.45)',
          },
          '&:active': { transform: 'scale(0.97)' },
          '&.Mui-disabled': { opacity: 0.45, background: 'var(--bg-overlay)' },
        }}
      >
        {loading ? 'Salvando...' : 'Salvar Novo Fluxo'}
      </Button>
    </Box>
  );
}

export default NewFlowForm;
