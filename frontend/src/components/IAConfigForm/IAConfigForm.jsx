// frontend/src/components/IAConfigForm/IAConfigForm.jsx
import React, { useState, useEffect } from 'react';
import { Bot } from 'lucide-react';
import { Box, Typography, TextField, Button, Paper } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRobot, faBuilding, faPen, faVolumeHigh,
  faClock, faGlobe, faUser, faFloppyDisk
} from '@fortawesome/free-solid-svg-icons';
import { useNotifier } from '../../context/Notifier';

function IAConfigForm({ onClose }) {
  const notify = useNotifier();
  const [contexto, setContexto] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/contexto-ia')
      .then(res => res.json())
      .then(data => {
        if (data.success) setContexto(data.contexto);
        else notify('Erro ao carregar a configuração da IA.', 'error');
        setIsLoading(false);
      })
      .catch(() => {
        notify('Erro de conexão. Verifique se o backend está rodando.', 'error');
        setIsLoading(false);
      });
  }, [notify]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setContexto(prev => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value }
      }));
    } else {
      setContexto(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    fetch('/api/contexto-ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contexto })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) notify('Configuração da IA salva com sucesso!', 'success');
        else notify('Falha ao salvar o contexto.', 'error');
        setIsSaving(false);
      })
      .catch(() => {
        notify('Erro de conexão ao salvar.', 'error');
        setIsSaving(false);
      });
  };

  if (isLoading && !contexto) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <Typography sx={{ color: 'var(--text-secondary)' }}>Carregando configurações...</Typography>
      </Box>
    );
  }

  if (!contexto) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <Typography sx={{ color: 'var(--accent-danger)' }}>Não foi possível carregar a configuração.</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Grid de Form (Expansão 100% e Gap Generoso) */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: '40px',
          width: '100%',
          flexGrow: 1,
          minHeight: 0,
          boxSizing: 'border-box',
        }}
      >
        {/* Coluna 1: Persona e Contexto */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', height: '100%', minHeight: 0 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.08em', textTransform: 'uppercase', mb: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Bot size={13} style={{ color: 'var(--accent-primary)' }} /> Persona & Contexto
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%' }}>
            <Box sx={{ color: 'var(--text-muted)', width: '20px', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
              <FontAwesomeIcon icon={faRobot} />
            </Box>
            <TextField
              fullWidth
              label="Nome do Bot"
              name="nomeBot"
              value={contexto.nomeBot || ''}
              onChange={handleInputChange}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%' }}>
            <Box sx={{ color: 'var(--text-muted)', width: '20px', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
              <FontAwesomeIcon icon={faBuilding} />
            </Box>
            <TextField
              fullWidth
              label="Nome da Empresa"
              name="nomeEmpresa"
              value={contexto.nomeEmpresa || ''}
              onChange={handleInputChange}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%' }}>
            <Box sx={{ color: 'var(--text-muted)', width: '20px', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
              <FontAwesomeIcon icon={faVolumeHigh} />
            </Box>
            <TextField
              fullWidth
              label="Tom de Voz"
              name="tomDeVoz"
              value={contexto.tomDeVoz || ''}
              onChange={handleInputChange}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'stretch', gap: '14px', width: '100%', flexGrow: 1, minHeight: 0 }}>
            <Box sx={{ color: 'var(--text-muted)', mt: '12px', width: '20px', textAlign: 'center', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
              <FontAwesomeIcon icon={faPen} />
            </Box>
            <TextField
              fullWidth
              multiline
              label="Descrição do Negócio / Empresa"
              name="tipoNegocio"
              value={contexto.tipoNegocio || ''}
              onChange={handleInputChange}
              sx={{
                height: '100%',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start', overflow: 'hidden', boxSizing: 'border-box' },
                '& .MuiInputBase-inputMultiline': { overflowY: 'auto !important', height: '100% !important', boxSizing: 'border-box', wordWrap: 'break-word', whiteSpace: 'pre-wrap' }
              }}
            />
          </Box>
        </Box>

        {/* Coluna 2: Base de Conhecimento */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', height: '100%', minHeight: 0 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.08em', textTransform: 'uppercase', mb: '4px' }}>
            Base de Conhecimento
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%' }}>
            <Box sx={{ color: 'var(--text-muted)', width: '20px', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
              <FontAwesomeIcon icon={faGlobe} />
            </Box>
            <TextField
              fullWidth
              label="Site Principal"
              name="informacoes.site"
              value={contexto.informacoes?.site || ''}
              onChange={handleInputChange}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%' }}>
            <Box sx={{ color: 'var(--text-muted)', width: '20px', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
              <FontAwesomeIcon icon={faUser} />
            </Box>
            <TextField
              fullWidth
              label="Contato Humano (Transferência)"
              name="informacoes.contatoHumano"
              value={contexto.informacoes?.contatoHumano || ''}
              onChange={handleInputChange}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'stretch', gap: '14px', width: '100%', flexGrow: 1, minHeight: 0 }}>
            <Box sx={{ color: 'var(--text-muted)', mt: '12px', width: '20px', textAlign: 'center', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
              <FontAwesomeIcon icon={faClock} />
            </Box>
            <TextField
              fullWidth
              multiline
              label="Horário de Atendimento"
              name="informacoes.horarioAtendimento"
              value={contexto.informacoes?.horarioAtendimento || ''}
              onChange={handleInputChange}
              sx={{
                height: '100%',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start', overflow: 'hidden', boxSizing: 'border-box' },
                '& .MuiInputBase-inputMultiline': { overflowY: 'auto !important', height: '100% !important', boxSizing: 'border-box', wordWrap: 'break-word', whiteSpace: 'pre-wrap' }
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* Ações */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', mt: '8px', pt: '16px', borderTop: '1px solid var(--border-subtle)' }}>
        <Button
          variant="outlined"
          onClick={onClose}
          sx={{
            color: 'var(--text-secondary)',
            borderColor: 'var(--border-default)',
            '&:hover': { borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-hover)' }
          }}
        >
          Voltar ao Painel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isSaving}
          startIcon={<FontAwesomeIcon icon={faFloppyDisk} />}
        >
          {isSaving ? 'Salvando...' : 'Salvar Configuração'}
        </Button>
      </Box>
    </Box>
  );
}

export default IAConfigForm;