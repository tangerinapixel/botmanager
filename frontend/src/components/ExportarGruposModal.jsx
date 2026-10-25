import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Select, MenuItem,
  FormControl, InputLabel, Typography, CircularProgress
} from '@mui/material';
import { Download } from 'lucide-react';
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
      fetch('http://localhost:5005/api/grupos')
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
          notify(`${err.message}`, 'error');
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

  const handleExportar = () => {
    if (!grupoSelecionado) {
      notify('Por favor, selecione um grupo para exportar.', 'warning');
      return;
    }
    
    setIsLoading(true); // Ativa o estado de loading para feedback visual
    notify('Iniciando exportação... A janela "Salvar Como" deve aparecer.', 'info');

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
      notify('Erro de comunicação com a aplicação.', 'error');
      setIsLoading(false); // Reseta o loading em caso de erro
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Exportar Contatos de Grupo</DialogTitle>
      <DialogContent dividers>
        {isLoading && grupos.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
            <CircularProgress />
          </div>
        ) : (
          <FormControl fullWidth>
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
            {grupos.length === 0 && !isLoading && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Nenhum grupo encontrado.
              </Typography>
            )}
          </FormControl>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary" disabled={isLoading}>Cancelar</Button>
        <Button
          onClick={handleExportar}
          variant="contained"
          startIcon={<Download size={18} />}
          disabled={isLoading || !grupoSelecionado}
        >
          Exportar
        </Button>
      </DialogActions>
    </Dialog>
  );
}