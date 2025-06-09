import React, { useState, useEffect } from 'react';
import {
  Modal, Box, Typography, Button, Select, MenuItem,
  FormControl, InputLabel, CircularProgress, LinearProgress
} from '@mui/material';
import { useNotifier } from '../context/Notifier';

const electronAPI = window.electronAPI;

export default function ExportarGruposModal({ open, onClose }) {
  const [grupos, setGrupos] = useState([]);
  const [grupoSelecionado, setGrupoSelecionado] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const notify = useNotifier();

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      fetch('http://localhost:5001/api/grupos')
        .then(res => {
          if (!res.ok) {
            return res.json().then(errorData => {
              throw new Error(errorData.message || 'Falha ao buscar grupos do servidor.');
            }).catch(() => { throw new Error(`Erro ${res.status} do servidor.`); });
          }
          return res.json();
        })
        .then(data => {
          if (data.success && Array.isArray(data.grupos)) {
            setGrupos(data.grupos);
          } else {
            console.warn("API de grupos não retornou a estrutura esperada:", data);
            setGrupos([]);
          }
        })
        .catch(err => {
          console.error("Erro ao carregar grupos:", err);
          notify(`❌ ${err.message}`, 'error');
          setGrupos([]);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      // Limpa os estados quando o modal é fechado
      setGrupos([]);
      setGrupoSelecionado('');
      setIsLoading(false); // Garante que o loading seja resetado
    }
  }, [open, notify]);

  const handleExportar = () => { // Removido 'event' pois não é mais necessário aqui
    if (!grupoSelecionado) {
      notify('⚠️ Por favor, selecione um grupo para exportar.', 'warning');
      return;
    }
    
    setIsLoading(true); // Ativa o estado de loading para feedback visual
    notify('⏳ Iniciando exportação... A janela "Salvar Como" deve aparecer.', 'info');

    if (electronAPI && electronAPI.exportarGrupo) {
      // Chama a função de IPC exposta pelo preload.js
      electronAPI.exportarGrupo(grupoSelecionado);
      
      // O download agora é gerenciado pelo Electron. Podemos fechar o modal.
      // Damos um pequeno tempo para a notificação aparecer antes de fechar.
      setTimeout(() => {
          onClose();
          setIsLoading(false); // Reseta o loading
      }, 500);

    } else {
      console.error("electronAPI.exportarGrupo não está disponível.");
      notify('❌ Erro de comunicação com a aplicação.', 'error');
      setIsLoading(false); // Reseta o loading em caso de erro
    }
  };

  const handleModalClose = (event, reason) => {
    if (isLoading && (reason === 'backdropClick' || reason === 'escapeKeyDown')) {
      notify('Aguarde a conclusão da exportação.', 'info');
      return; 
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={handleModalClose}>
      <Box sx={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: 400 }, bgcolor: 'background.paper', border: '1px solid #ccc',
          borderRadius: '8px', boxShadow: 24, p: 3, textAlign: 'center'
      }}>
        <Typography variant="h6" gutterBottom>Exportar Contatos de Grupo</Typography>
        
        {/* Mostra um spinner circular enquanto a lista inicial de grupos carrega */}
        {isLoading && grupos.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <CircularProgress />
          </Box>
        ) : (
          <FormControl fullWidth sx={{ my: 2 }}>
            <InputLabel id="select-grupo-label">Selecione um Grupo</InputLabel>
            <Select
              labelId="select-grupo-label"
              id="select-grupo"
              value={grupoSelecionado}
              label="Selecione um Grupo"
              onChange={(e) => setGrupoSelecionado(e.target.value)}
              disabled={isLoading}
            >
              {grupos.map((grupo) => (
                <MenuItem key={grupo.id} value={grupo.id}>
                  {grupo.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        
        {/* Mostra uma barra de progresso linear se a exportação foi iniciada */}
        {isLoading && grupos.length > 0 && <LinearProgress sx={{my: 2}} />}
        
        <Box display="flex" justifyContent="space-around" mt={2}>
          <Button variant="outlined" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleExportar} // Não precisa mais passar o evento 'e' aqui
            disabled={isLoading || !grupoSelecionado}
          >
            {/* Mostra spinner no botão durante o loading */}
            {isLoading && grupos.length > 0 ? <CircularProgress size={24} color="inherit" /> : 'Exportar'}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}