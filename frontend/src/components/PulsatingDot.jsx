// src/components/PulsatingDot.jsx
import React from 'react';
import { Box } from '@mui/material';

const pulseAnimation = {
  '@keyframes pulseDot': {
    '0%': {
      transform: 'scale(0.92)',
      boxShadow: '0 0 0 0 rgba(37, 211, 102, 0.6)',
    },
    '70%': {
      transform: 'scale(1)',
      boxShadow: '0 0 0 7px rgba(37, 211, 102, 0)',
    },
    '100%': {
      transform: 'scale(0.92)',
      boxShadow: '0 0 0 0 rgba(37, 211, 102, 0)',
    },
  },
};

function PulsatingDot() {
  return (
    <Box sx={{
      ...pulseAnimation,
      width: '10px',
      height: '10px',
      backgroundColor: 'var(--accent-success)',
      borderRadius: '50%',
      animation: 'pulseDot 2s infinite',
      flexShrink: 0,
    }} />
  );
}

export default PulsatingDot;