// src/components/ActivationModal.jsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useNotifier } from '../context/Notifier';

// Acessa a API exposta pelo preload.js
const electronAPI = window.electronAPI;

function ActivationModal({ open, onClose, onSuccess }) {
  const [licenseKey, setLicenseKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activationMessage, setActivationMessage] = useState('');
  const [messageSeverity, setMessageSeverity] = useState('info');
  const notify = useNotifier();

  useEffect(() => {
    if (!electronAPI) {
      console.error("ActivationModal: electronAPI não está disponível no window. Verifique seu preload.js.");
      return;
    }

    const handleActivationStatus = ({ status, message }) => {
      console.log('ActivationModal: Recebido activation-status:', { status, message });
      setIsLoading(false); // Para o spinner do botão
      
      if (status === 'success') {
        notify(message || 'Aplicação ativada com sucesso!', 'success');
        if (onSuccess && typeof onSuccess === 'function') {
          onSuccess(); // Chama o callback de sucesso para o App.jsx
        }
      } else if (status === 'failed') {
        setActivationMessage(message || 'Falha na ativação. Verifique sua chave e tente novamente.');
        setMessageSeverity('error');
      } else if (status === 'validating') {
        setActivationMessage(message || 'Validando chave...');
        setMessageSeverity('info');
      }
    };

    // Registra o listener e guarda a função de cleanup retornada pelo .on()
    const unsubscribe = electronAPI.on('activation-status', handleActivationStatus);

    // Função de limpeza (cleanup) do useEffect
    return () => {
      console.log("ActivationModal: Limpando listener 'activation-status'.");
      // Chama a função de unsubscribe se ela existir
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [onSuccess, notify]); // Array de dependências

  const handleActivate = () => {
    if (!licenseKey.trim()) {
      setActivationMessage('Por favor, insira uma chave de licença válida.');
      setMessageSeverity('warning');
      return;
    }
    if (electronAPI && electronAPI.send) {
      setIsLoading(true);
      setActivationMessage(''); // Limpa mensagens anteriores
      electronAPI.send('validate-license', licenseKey);
    } else {
      console.error("ActivationModal: electronAPI.send não está disponível.");
      notify('Erro de comunicação com o sistema. Tente reiniciar a aplicação.', 'error');
    }
  };

  const handleModalClose = () => {
    if (isLoading) return; // Não permite fechar se estiver validando
    setLicenseKey(''); 
    setActivationMessage(''); 
    onClose(); 
  };

  return (
    <Modal
      open={open}
      onClose={handleModalClose}
      aria-labelledby="activation-modal-title"
      aria-describedby="activation-modal-description"
    >
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '90%', sm: 450 },
        bgcolor: 'background.paper',
        border: '1px solid #ccc',
        borderRadius: '8px',
        boxShadow: 24,
        p: {xs: 2, sm: 3, md: 4},
        textAlign: 'center'
      }}>
        <IconButton
          aria-label="Fechar"
          onClick={handleModalClose}
          disabled={isLoading}
          sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
          }}
        >
            <CloseIcon />
        </IconButton>
        <Typography id="activation-modal-title" variant="h5" component="h2" gutterBottom>
          Ativar Aplicação
        </Typography>
        <Typography id="activation-modal-description" sx={{ mb: 2 }}>
          Por favor, insira sua chave de licença para ativar todas as funcionalidades.
        </Typography>
        <TextField
          label="Chave de Licença"
          variant="outlined"
          fullWidth
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.target.value)}
          margin="normal"
          disabled={isLoading}
          autoFocus
        />
        {activationMessage && (
          <Typography color={messageSeverity === 'error' ? 'error' : (messageSeverity === 'warning' ? 'warning.main' : 'text.secondary')} sx={{ mt: 1, mb: 1, minHeight: '20px' }}>
            {activationMessage}
          </Typography>
        )}
        <Button
          variant="contained"
          color="primary"
          onClick={handleActivate}
          disabled={isLoading}
          fullWidth
          sx={{ mt: 2, py: 1.5 }}
        >
          {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Ativar'}
        </Button>
      </Box>
    </Modal>
  );
}

export default ActivationModal;