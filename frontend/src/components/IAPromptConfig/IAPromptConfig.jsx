// frontend/src/components/IAPromptConfig/IAPromptConfig.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, TextField, Button, Chip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTheaterMasks, faScroll, faFloppyDisk, faLightbulb
} from '@fortawesome/free-solid-svg-icons';
import { useNotifier } from '../../context/Notifier';

const availableVariables = [
  { name: "Nome do Bot", value: "nomeBot" },
  { name: "Nome da Empresa", value: "nomeEmpresa" },
  { name: "Tipo de Negócio", value: "tipoNegocio" },
  { name: "Tom de Voz", value: "tomDeVoz" },
  { name: "Horário de Atendimento", value: "informacoes.horarioAtendimento" },
  { name: "Site", value: "informacoes.site" },
  { name: "Contato Humano", value: "informacoes.contatoHumano" },
];

function IAPromptConfig({ onClose, fullContext, onSave }) {
  const notify = useNotifier();
  const [promptConfig, setPromptConfig] = useState(
    fullContext?.promptConfig || { persona: '', regrasGerais: [] }
  );
  const [isLoading, setIsLoading] = useState(false);

  const personaTextareaRef = useRef(null);
  const regrasTextareaRef = useRef(null);
  const [activeTextarea, setActiveTextarea] = useState('persona');

  useEffect(() => {
    if (fullContext?.promptConfig) {
      setPromptConfig(fullContext.promptConfig);
    }
  }, [fullContext]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPromptConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleRegrasChange = (e) => {
    const { value } = e.target;
    const regrasArray = value.split('\n');
    setPromptConfig(prev => ({ ...prev, regrasGerais: regrasArray }));
  };

  const handleInsertVariable = (variable) => {
    const isPersona = activeTextarea === 'persona';
    const textarea = isPersona ? personaTextareaRef.current : regrasTextareaRef.current;

    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const newText = `${text.substring(0, start)}${variable}${text.substring(end)}`;

    if (isPersona) {
      setPromptConfig(prev => ({ ...prev, persona: newText }));
    } else {
      setPromptConfig(prev => ({ ...prev, regrasGerais: newText.split('\n') }));
    }

    textarea.focus();
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + variable.length;
    }, 0);
  };

  const handleSaveChanges = () => {
    setIsLoading(true);
    const updatedContext = { ...fullContext, promptConfig: promptConfig };
    Promise.resolve(onSave(updatedContext))
      .finally(() => {
        setIsLoading(false);
      });
  };

  if (!fullContext) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <Typography sx={{ color: 'var(--text-secondary)' }}>Carregando...</Typography>
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
      {/* Grid de Form (100% Width e Gap Generoso) */}
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
        {/* Coluna 1: Persona */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', height: '100%', minHeight: 0 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.08em', textTransform: 'uppercase', mb: '4px' }}>
            Persona da IA
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'stretch', gap: '14px', width: '100%', flexGrow: 1, minHeight: 0 }}>
            <Box sx={{ color: 'var(--text-muted)', mt: '12px', width: '20px', textAlign: 'center', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
              <FontAwesomeIcon icon={faTheaterMasks} />
            </Box>
            <TextField
              fullWidth
              multiline
              label="Personalidade e Comportamento"
              name="persona"
              inputRef={personaTextareaRef}
              value={promptConfig?.persona || ''}
              onChange={handleInputChange}
              onFocus={() => setActiveTextarea('persona')}
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

          {/* Variáveis */}
          <Box
            sx={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '16px',
              ml: '34px',
            }}
          >
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', mb: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FontAwesomeIcon icon={faLightbulb} style={{ fontSize: '11px', color: 'var(--accent-warning)' }} />
              Clique para inserir variáveis no campo focado:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {availableVariables.map(variable => (
                <Chip
                  key={variable.name}
                  label={variable.name}
                  onClick={() => handleInsertVariable(`\${${variable.value}}`)}
                  clickable
                  sx={{
                    fontSize: '0.72rem',
                    height: '24px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    color: 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: 'var(--text-primary)',
                    }
                  }}
                />
              ))}
            </Box>
          </Box>
        </Box>

        {/* Coluna 2: Regras Gerais */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', height: '100%', minHeight: 0 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.08em', textTransform: 'uppercase', mb: '4px' }}>
            Regras de Resposta
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'stretch', gap: '14px', width: '100%', flexGrow: 1, minHeight: 0 }}>
            <Box sx={{ color: 'var(--text-muted)', mt: '12px', width: '20px', textAlign: 'center', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
              <FontAwesomeIcon icon={faScroll} />
            </Box>
            <TextField
              fullWidth
              multiline
              label="Regras Gerais (uma regra por linha)"
              name="regrasGerais"
              inputRef={regrasTextareaRef}
              value={promptConfig?.regrasGerais?.join('\n') || ''}
              onChange={handleRegrasChange}
              onFocus={() => setActiveTextarea('regras')}
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
          onClick={handleSaveChanges}
          disabled={isLoading}
          startIcon={<FontAwesomeIcon icon={faFloppyDisk} />}
        >
          {isLoading ? 'Salvando...' : 'Salvar Prompt'}
        </Button>
      </Box>
    </Box>
  );
}

export default IAPromptConfig;