// frontend/src/components/IAContentManager/IAContentManager.jsx
import React, { useState, useEffect } from 'react';
import { Key } from 'lucide-react';
import { Box, Typography, TextField, Button, Paper, IconButton, Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faTrashCan, faBookmark, faLink, faFileLines,
  faUsers, faLightbulb, faFloppyDisk
} from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifier } from '../../context/Notifier';

/* ── Variantes de Animação ─────────────────────────────── */
const itemVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, x: 20, scale: 0.97, transition: { duration: 0.15 } },
};

/* ── Item de Material/Produto ───────────────────────────── */
function ProductItem({ item, index, onChange, onRemove }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div variants={itemVariants} initial="hidden" animate="visible" exit="exit" layout>
      <Paper
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        sx={{
          padding: '16px',
          borderRadius: '12px',
          border: `1px solid ${hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`,
          background: 'rgba(255,255,255,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          position: 'relative',
          transition: 'all 0.2s ease',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Material {index + 1}
          </Typography>
          <Tooltip title="Remover Material" placement="top">
            <IconButton
              size="small"
              onClick={() => onRemove(index)}
              sx={{
                width: 26, height: 26, borderRadius: '7px',
                color: 'var(--accent-danger)',
                backgroundColor: 'rgba(224,82,82,0.08)',
                opacity: hovered ? 1 : 0,
                transform: hovered ? 'scale(1)' : 'scale(0.9)',
                transition: 'opacity 0.18s ease, transform 0.18s ease',
                '&:hover': { backgroundColor: 'rgba(224,82,82,0.18)' },
              }}
            >
              <FontAwesomeIcon icon={faTrashCan} style={{ fontSize: '10px' }} />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Box sx={{ color: 'var(--text-muted)', width: '16px', display: 'flex', justifyContent: 'center' }}>
            <FontAwesomeIcon icon={faBookmark} style={{ fontSize: '12px' }} />
          </Box>
          <TextField
            fullWidth
            label="Nome do Material"
            name="nome"
            value={item.nome || ''}
            onChange={(e) => onChange('produtos', index, e)}
            size="small"
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <Box sx={{ color: 'var(--text-muted)', mt: '10px', width: '16px', display: 'flex', justifyContent: 'center' }}>
            <FontAwesomeIcon icon={faFileLines} style={{ fontSize: '12px' }} />
          </Box>
          <TextField
            fullWidth
            multiline
            rows={2}
            label="Descrição"
            name="descricao"
            value={item.descricao || ''}
            onChange={(e) => onChange('produtos', index, e)}
            size="small"
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Box sx={{ color: 'var(--text-muted)', width: '16px', display: 'flex', justifyContent: 'center' }}>
            <FontAwesomeIcon icon={faLink} style={{ fontSize: '12px' }} />
          </Box>
          <TextField
            fullWidth
            label="Link de Acesso"
            name="link"
            value={item.link || ''}
            onChange={(e) => onChange('produtos', index, e)}
            size="small"
          />
        </Box>
      </Paper>
    </motion.div>
  );
}

/* ── Item de Grupo de WhatsApp ──────────────────────────── */
function GroupItem({ item, index, onChange, onRemove }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div variants={itemVariants} initial="hidden" animate="visible" exit="exit" layout>
      <Paper
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        sx={{
          padding: '16px',
          borderRadius: '12px',
          border: `1px solid ${hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}`,
          background: 'rgba(255,255,255,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          position: 'relative',
          transition: 'all 0.2s ease',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Grupo {index + 1}
          </Typography>
          <Tooltip title="Remover Grupo" placement="top">
            <IconButton
              size="small"
              onClick={() => onRemove(index)}
              sx={{
                width: 26, height: 26, borderRadius: '7px',
                color: 'var(--accent-danger)',
                backgroundColor: 'rgba(224,82,82,0.08)',
                opacity: hovered ? 1 : 0,
                transform: hovered ? 'scale(1)' : 'scale(0.9)',
                transition: 'opacity 0.18s ease, transform 0.18s ease',
                '&:hover': { backgroundColor: 'rgba(224,82,82,0.18)' },
              }}
            >
              <FontAwesomeIcon icon={faTrashCan} style={{ fontSize: '10px' }} />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Box sx={{ color: 'var(--text-muted)', width: '16px', display: 'flex', justifyContent: 'center' }}>
            <FontAwesomeIcon icon={faUsers} style={{ fontSize: '12px' }} />
          </Box>
          <TextField
            fullWidth
            label="Nome do Grupo"
            name="nome"
            value={item.nome || ''}
            onChange={(e) => onChange('gruposWhatsapp', index, e)}
            size="small"
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Box sx={{ color: 'var(--text-muted)', width: '16px', display: 'flex', justifyContent: 'center' }}>
            <FontAwesomeIcon icon={faLink} style={{ fontSize: '12px' }} />
          </Box>
          <TextField
            fullWidth
            label="Link do Grupo"
            name="link"
            value={item.link || ''}
            onChange={(e) => onChange('gruposWhatsapp', index, e)}
            size="small"
          />
        </Box>
      </Paper>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════ */
function IAContentManager({ onClose }) {
  const notify = useNotifier();
  const [contexto, setContexto] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/contexto-ia')
      .then(res => res.json())
      .then(data => {
        if (data.success) setContexto(data.contexto);
        else notify('Erro ao carregar o conteúdo da IA.', 'error');
        setIsLoading(false);
      })
      .catch(() => {
        notify('Erro de conexão.', 'error');
        setIsLoading(false);
      });
  }, [notify]);

  const handleSave = () => {
    setIsSaving(true);
    fetch('/api/contexto-ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contexto })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) notify('Conteúdo da IA salvo com sucesso!', 'success');
        else notify('Falha ao salvar o conteúdo.', 'error');
        setIsSaving(false);
      })
      .catch(() => {
        notify('Erro de conexão ao salvar.', 'error');
        setIsSaving(false);
      });
  };

  const handleItemChange = (listName, index, event) => {
    const { name, value } = event.target;
    const currentList = Array.isArray(contexto?.informacoes?.[listName])
      ? contexto.informacoes[listName]
      : [];
    const newList = [...currentList];
    if (newList[index]) {
      newList[index][name] = value;
    }
    setContexto(prev => ({
      ...prev,
      informacoes: { ...prev.informacoes, [listName]: newList }
    }));
  };

  const handleAddItem = (listName, newItem) => {
    const currentList = Array.isArray(contexto?.informacoes?.[listName])
      ? contexto.informacoes[listName]
      : [];
    const newList = [...currentList, newItem];
    setContexto(prev => ({
      ...prev,
      informacoes: { ...prev.informacoes, [listName]: newList }
    }));
  };

  const handleRemoveItem = (listName, index) => {
    const currentList = Array.isArray(contexto?.informacoes?.[listName])
      ? contexto.informacoes[listName]
      : [];
    const newList = currentList.filter((_, i) => i !== index);
    setContexto(prev => ({
      ...prev,
      informacoes: { ...prev.informacoes, [listName]: newList }
    }));
  };

  const handleTopicsChange = (event) => {
    const { value } = event.target;
    const topicsArray = value.split(',').map(s => s.trim());
    setContexto(prev => ({
      ...prev,
      informacoes: { ...prev.informacoes, principaisTopicos: topicsArray }
    }));
  };

  if (isLoading && !contexto) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <Typography sx={{ color: 'var(--text-secondary)' }}>Carregando conteúdo...</Typography>
      </Box>
    );
  }

  const produtosArray = Array.isArray(contexto?.informacoes?.produtos)
    ? contexto.informacoes.produtos
    : [];
  const gruposArray = Array.isArray(contexto?.informacoes?.gruposWhatsapp)
    ? contexto.informacoes.gruposWhatsapp
    : [];
  const topicosArray = Array.isArray(contexto?.informacoes?.principaisTopicos)
    ? contexto.informacoes.principaisTopicos
    : [];

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
        {/* Coluna 1: Materiais Gratuitos */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', height: '100%', minHeight: 0 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.08em', textTransform: 'uppercase', mb: '4px' }}>
            Materiais Gratuitos
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1, minHeight: 0, overflowY: 'auto', pr: '4px' }}>
            <AnimatePresence mode="popLayout">
              {produtosArray.map((item, index) => (
                <ProductItem
                  key={`prod-${index}`}
                  item={item}
                  index={index}
                  onChange={handleItemChange}
                  onRemove={(idx) => handleRemoveItem('produtos', idx)}
                />
              ))}
            </AnimatePresence>
          </Box>

          <Button
            variant="outlined"
            onClick={() => handleAddItem('produtos', { nome: 'Novo Material', descricao: '', link: '' })}
            startIcon={<FontAwesomeIcon icon={faPlus} />}
            sx={{
              color: 'var(--text-secondary)',
              borderColor: 'var(--border-default)',
              '&:hover': { borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-hover)' }
            }}
          >
            Adicionar Material
          </Button>
        </Box>

        {/* Coluna 2: Grupos e Tópicos */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', height: '100%', minHeight: 0 }}>
          {/* Grupos de WhatsApp */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px', flexGrow: 1, minHeight: 0 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.08em', textTransform: 'uppercase', mb: '4px' }}>
              Grupos de WhatsApp
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1, minHeight: 0, overflowY: 'auto', pr: '4px' }}>
              <AnimatePresence mode="popLayout">
                {gruposArray.map((item, index) => (
                  <GroupItem
                    key={`group-${index}`}
                    item={item}
                    index={index}
                    onChange={handleItemChange}
                    onRemove={(idx) => handleRemoveItem('gruposWhatsapp', idx)}
                  />
                ))}
              </AnimatePresence>
            </Box>

            <Button
              variant="outlined"
              onClick={() => handleAddItem('gruposWhatsapp', { nome: 'Novo Grupo', link: '' })}
              startIcon={<FontAwesomeIcon icon={faPlus} />}
              sx={{
                color: 'var(--text-secondary)',
                borderColor: 'var(--border-default)',
                '&:hover': { borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-hover)' }
              }}
            >
              Adicionar Grupo
            </Button>
          </Box>

          {/* Tópicos da IA */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px', mt: '8px' }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={13} style={{ color: 'var(--accent-primary)' }} /> Principais Tópicos da IA
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '14px', width: '100%' }}>
              <Box sx={{ color: 'var(--text-muted)', mt: '12px', width: '20px', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
                <FontAwesomeIcon icon={faLightbulb} />
              </Box>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Tópicos (separados por vírgula)"
                value={topicosArray.join(', ')}
                onChange={handleTopicsChange}
                placeholder="Teologia Adventista, Lição da Escola Sabatina..."
              />
            </Box>
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
          {isSaving ? 'Salvando...' : 'Salvar Conteúdo'}
        </Button>
      </Box>
    </Box>
  );
}

export default IAContentManager;