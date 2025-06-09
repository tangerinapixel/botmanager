import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Select,
  MenuItem, FormControl, InputLabel, Typography, CircularProgress
} from '@mui/material';
import { Download } from 'lucide-react';
import { useNotifier } from '../context/Notifier';

// Acessa a API exposta pelo preload.js
const electronAPI = window.electronAPI;

export default function ExportarEtiquetasModal({ open, onClose }) {
  const notify = useNotifier();
  const [etiquetas, setEtiquetas] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // A lógica para carregar as etiquetas permanece a mesma
    if (open) {
      setLoading(true);
      fetch('http://localhost:5001/api/etiquetas-com-total')
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(data => {
          if (data && Array.isArray(data.etiquetas)) setEtiquetas(data.etiquetas);
          else setEtiquetas([]);
        })
        .catch(err => {
          console.error("Erro ao carregar etiquetas:", err);
          notify('❌ Falha ao carregar etiquetas.', 'error');
          setEtiquetas([]);
        })
        .finally(() => setLoading(false));
    } else {
      setEtiquetas([]);
      setSelectedId('');
      setLoading(true);
    }
  }, [open, notify]);

useEffect(() => {
  console.log('ESTADO DO MODAL ATUALIZADO:', {
    loading: loading,
    selectedId: selectedId,
    isButtonDisabled: !selectedId || loading
  });
}, [loading, selectedId]); // Este efeito r

// Em ExportarEtiquetasModal.jsx (e similar para ExportarGruposModal.jsx)

const handleExport = async () => {
   debugger;
  if (!selectedId) {
    notify('⚠️ Por favor, selecione uma etiqueta para exportar.', 'warning');
    return;
  }
  
  setLoading(true);
  notify('⏳ Iniciando exportação... Por favor, aguarde a janela para salvar.', 'info');

  try {
    // A CORREÇÃO ESTÁ AQUI:
    // Nós NÃO fazemos o fetch nem criamos links no frontend.
    // Apenas avisamos o processo principal do Electron qual etiqueta queremos exportar.
    window.electronAPI.send('exportar-etiqueta', selectedId);

    // O processo de download agora é gerenciado inteiramente pelo Electron em segundo plano.
    // A notificação de sucesso e o fechamento do modal podem ser acionados
    // por uma mensagem de 'download-complete' vinda do Electron, se desejar.
    // Por enquanto, podemos fechar o modal.
    onClose();

  } catch (err) {
    // Este catch agora é menos provável de ser atingido, mas é bom manter.
    console.error('Erro ao solicitar exportação:', err);
    notify(`❌ Erro inesperado ao solicitar exportação.`, 'error');
  } finally {
    // O setLoading pode ser setado para false aqui,
    // ou de forma mais precisa, após o download ser concluído.
    setLoading(false);
  }
};

  return (
    <>
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Exportar Contatos por Etiqueta</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
            <CircularProgress />
          </div>
        ) : (
          <FormControl fullWidth>
            <InputLabel id="etiqueta-label">Etiqueta</InputLabel>
            <Select
              labelId="etiqueta-label"
              value={selectedId}
              label="Etiqueta"
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {etiquetas.map((etiqueta) => (
                <MenuItem
                  key={etiqueta.id}
                  value={etiqueta.id}
                  disabled={etiqueta.totalContatos === 0}
                >
                  {etiqueta.nome} ({etiqueta.totalContatos})
                </MenuItem>
              ))}
            </Select>
            {etiquetas.length === 0 && !loading && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Nenhuma etiqueta encontrada.
              </Typography>
            )}
          </FormControl>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">Cancelar</Button>
        <Button
          onClick={handleExport}
          variant="contained"
          startIcon={<Download size={18} />}
          disabled={!selectedId || loading}
        >
          Exportar
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}