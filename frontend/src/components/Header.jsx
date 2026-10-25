// frontend/src/components/Header.jsx (VERSÃO COM ÍCONE DO WHATSAPP)

import React, { useState, useEffect } from 'react';
import { Typography, Button, IconButton, Tooltip, Box, CircularProgress } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot } from '@fortawesome/free-solid-svg-icons';
// MUDANÇA 1: Importa o ícone do WhatsApp
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

import PulsatingDot from './PulsatingDot';

// Componente auxiliar do progresso (não muda)
function CircularProgressWithLabel(props) {
  const displayValue = Math.min(props.value, 99);
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <CircularProgress variant="determinate" {...props} value={displayValue} />
      <Box
        sx={{
          top: 0, left: 0, bottom: 0, right: 0,
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="caption" component="div" color="inherit" sx={{ fontSize: '0.6rem', fontWeight: 'bold' }}>
          {`${Math.round(displayValue)}%`}
        </Typography>
      </Box>
    </Box>
  );
}

// Componente para o texto animado (não muda)
function AnimatedLoadingText() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const intervalId = setInterval(() => {
      setDots(prevDots => (prevDots.length >= 3 ? '' : prevDots + '.'));
    }, 400);
    return () => clearInterval(intervalId);
  }, []);
  return <span>Carregando{dots}</span>;
}


function Header({ status, loadingProgress = 0, onConnect, onAbrirMass }) {
  let statusElement;
  let buttonText;
  let buttonColor;
  let buttonDisabled = false;
  let startIcon = null; // A variável que controla o ícone
  let tooltipMessage = '';
  let hideStatusDisplay = false;

  switch (status) {
    case 'loading':
      hideStatusDisplay = true;
      buttonText = <AnimatedLoadingText />;
      buttonColor = 'inherit';
      buttonDisabled = true;
      tooltipMessage = 'Conectando ao WhatsApp...';
      startIcon = <CircularProgressWithLabel value={loadingProgress} size={24} color="inherit" />;
      break;

    case 'qr':
      statusElement = <span style={{ fontWeight: 'bold', color: '#007bff' }}>📱 Escaneie o QR Code</span>;
      buttonText = 'Gerar Novo QR';
      buttonColor = 'primary';
      tooltipMessage = 'Solicitar novo QR Code';
      break;

    case 'ready':
      statusElement = (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PulsatingDot />
          <span style={{ fontWeight: 'bold', color: 'green' }}>Conectado</span>
        </Box>
      );
      buttonText = 'REINICIAR';
      buttonColor = 'success';
      tooltipMessage = 'Reiniciar conexão com o WhatsApp';
      // MUDANÇA 2: Define o ícone do WhatsApp para o estado 'ready'
      startIcon = <FontAwesomeIcon icon={faWhatsapp} />;
      break;

    case 'no_internet':
      statusElement = <span style={{ fontWeight: 'bold', color: '#ff9800' }}>🌐 Sem Conexão de Rede</span>;
      buttonText = 'Reconectar';
      buttonColor = 'warning';
      tooltipMessage = 'Verifique sua conexão com a internet';
      break;

    case 'fatal_error':
      statusElement = <span style={{ fontWeight: 'bold', color: '#f44336' }}>⚠️ Erro de Inicialização</span>;
      buttonText = 'Recarregar';
      buttonColor = 'error';
      tooltipMessage = 'Ocorreu um erro fatal ao inicializar o WhatsApp. Clique para tentar novamente.';
      break;

    default:
      statusElement = <span style={{ fontWeight: 'bold', color: 'red' }}>🔴 Desconectado</span>;
      buttonText = 'Conectar';
      buttonColor = 'error';
      tooltipMessage = 'Estabelecer conexão com o WhatsApp';
      break;
  }

  return (
    <Box 
      component="header" 
      className="app-header" 
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 24px',
        backgroundColor: '#f0f4ff',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
        height: '60px'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Tooltip title="Menu Principal / Ações">
          <IconButton aria-label="Menu Principal / Ações" onClick={onAbrirMass} color="primary">
            <FontAwesomeIcon icon={faRobot} /> 
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {!hideStatusDisplay && (
          <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center' }}>
            {statusElement}
          </Typography>
        )}
        <Tooltip title={tooltipMessage}>
          <span> 
            <Button
              variant="contained"
              color={buttonColor}
              onClick={onConnect}
              disabled={buttonDisabled}
              startIcon={startIcon} // A prop 'startIcon' exibe o ícone que definimos
              sx={{ 
                minWidth: '180px',
                height: '42px',
                borderRadius: '20px'
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
