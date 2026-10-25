// src/components/QRCodeDisplay.jsx
import React from 'react';
import { Modal, Box, Typography } from '@mui/material';
import { QRCodeCanvas } from 'qrcode.react';

// Este componente exibe o QR Code em um Modal elegante, suspenso e persistente.
function QRCodeDisplay({ url }) {
  if (!url) {
    return null; // Se não houver URL, não renderiza nada.
  }

  return (
    <Modal
      open={true}
      disableEscapeKeyDown
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backdropFilter: 'blur(4px)', // Efeito moderno de desfoque de fundo
        backgroundColor: 'rgba(0, 0, 0, 0.65)'
      }}
    >
      <Box sx={{
        bgcolor: 'background.paper',
        p: 4,
        borderRadius: 4,
        boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.4)',
        textAlign: 'center',
        maxWidth: 380,
        mx: 2,
        outline: 'none',
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2
      }}>
        <Typography variant="h6" fontWeight="bold" sx={{ color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
          📱 Conectar WhatsApp
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', px: 1, lineHeight: 1.5 }}>
          Abra o WhatsApp no seu celular, vá em <strong>Aparelhos conectados</strong> e escaneie o código abaixo:
        </Typography>
        
        <Box sx={{ 
          p: 2, 
          bgcolor: 'white', 
          borderRadius: 3, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)',
          border: '1px solid',
          borderColor: 'grey.200',
          mt: 1
        }}>
          <QRCodeCanvas value={url} size={230} />
        </Box>
        
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1 }}>
          ⏳ O pop-up fechará automaticamente após a sincronização ser concluída.
        </Typography>
      </Box>
    </Modal>
  );
}

export default QRCodeDisplay;