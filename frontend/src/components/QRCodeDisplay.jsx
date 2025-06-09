// src/components/QRCodeDisplay.jsx
import React from 'react';
import { Box, Typography } from '@mui/material';
import { QRCodeCanvas } from 'qrcode.react';

// Este é um componente "burro". Ele não sabe de onde vem a URL, apenas a exibe.
function QRCodeDisplay({ url }) {
  if (!url) {
    return null; // Se não houver URL, não renderiza nada.
  }

  return (
    <Box sx={{ textAlign: 'center', p: 2, m: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Typography variant="h6">Escaneie o QR Code com seu WhatsApp:</Typography>
      <Box sx={{ mt: 2, p: 1, display: 'inline-block', bgcolor: 'white' }}>
        <QRCodeCanvas value={url} size={250} />
      </Box>
    </Box>
  );
}

export default QRCodeDisplay;