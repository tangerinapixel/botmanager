// src/components/StatusBar.jsx
import React from 'react';
import { IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';

function StatusBar({ status, onConnect, onMenuToggle }) {
  return (
    <div className="status-bar">
      <p>Status: <strong style={{ color: 'green' }}>🟢 {status === "ready" ? "online" : status}</strong></p>

      <button
        className="btn green"
        onClick={onConnect}
      >
        🔗 Conectar ao Servidor
      </button>

      <IconButton
        style={{ position: 'absolute', top: 20, right: 20 }}
        onClick={onMenuToggle}
      >
        <MenuIcon fontSize="large" />
      </IconButton>
    </div>
  );
}

export default StatusBar;