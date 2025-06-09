import React from 'react';
import { Typography, Button, IconButton, Tooltip, Box, CircularProgress } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';

function Header({ status, onConnect, onAbrirMass }) {
  let statusText = '🔴 Desconectado';
  let statusColor = 'red';
  let buttonText = 'Conectar';
  let buttonColor = 'error';
  let showSpinnerInButton = false;
  let buttonDisabled = false;
  let hideStatusDisplay = false;
  let tooltipMessage = 'Estabelecer conexão com o WhatsApp';

  switch (status) {
    case 'loading':
      hideStatusDisplay = true;                 // Mantém o texto "Status: ..." escondido
      showSpinnerInButton = true;               // Mostra o spinner no botão
      buttonText = 'Conectando...';             // << NOVO: Texto dentro do botão durante o loading
      buttonDisabled = true;                    // Mantém o botão desabilitado (aparência cinza)
      buttonColor = 'inherit';                  // Para o spinner herdar a cor de texto desabilitado (cinza)
      tooltipMessage = 'Conectando ao WhatsApp...';
      break;
    case 'qr':
      statusText = '📱 Escaneie o QR Code';
      statusColor = '#007bff';
      buttonText = 'Gerar Novo QR';
      buttonDisabled = false; // Permite clicar para tentar gerar novo QR ou conectar
      buttonColor = 'primary';
      tooltipMessage = 'Solicitar novo QR Code ou tentar conectar';
      break;
    case 'ready':
      statusText = '🛜​ Conectado';
      statusColor = 'green';
      buttonText = 'REINICIAR';
      buttonColor = 'success'; 
      tooltipMessage = 'Reiniciar conexão com o WhatsApp';
      break;
    case 'auth_failure':
      statusText = '⚠️ Falha na Autenticação';
      statusColor = 'red';
      buttonText = 'Tentar Novamente';
      buttonColor = 'error';
      tooltipMessage = 'Tentar conectar novamente ao WhatsApp';
      break;
    case 'disconnected':
    default:
      statusText = '❌ ​Desconectado';
      statusColor = 'red';
      buttonText = 'Conectar';
      buttonColor = 'error';
      tooltipMessage = 'Estabelecer conexão com o WhatsApp';
      break;
  }

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 20px',
      backgroundColor: '#eef',
      borderBottom: '1px solid #ddd',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
      position: 'sticky',
      top: 0,
      zIndex: 999,
      height: '48px',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Tooltip title="Abrir painel de envio em massa">
          <IconButton
            aria-label="Abrir painel de envio em massa"
            onClick={onAbrirMass}
            color="primary"
          >
            <MenuIcon />
          </IconButton>
        </Tooltip>
        {/*<Typography variant="h5" fontWeight="bold">
          👁️‍🗨️ Bot Manager X
        </Typography>*/}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {!hideStatusDisplay && (
          <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center' }}>
            ♾️​{' '}
            <span style={{ fontWeight: 'bold', color: statusColor, marginLeft: '4px' }}>
              {statusText}
            </span>
          </Typography>
        )}

        <Tooltip title={tooltipMessage}>
          <span> 
            <Button
              variant="contained"
              color={buttonColor}
              onClick={onConnect}
              disabled={buttonDisabled}
              startIcon={showSpinnerInButton ? <CircularProgress size={20} color="inherit" /> : undefined } // undefined se não houver ícone
              sx={{ 
                minWidth: '140px', // Ajustado para acomodar "Conectando..." + spinner
                textAlign: 'center' // Garante que o conteúdo do botão (ícone + texto) esteja centralizado
              }}
            >
              {buttonText}
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}

export default Header;