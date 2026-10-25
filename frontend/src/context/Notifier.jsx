// frontend/src/context/Notifier.jsx — Passo 6: Toast Premium
import React, {
  createContext, useContext, useState, useCallback, useRef, useEffect
} from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleCheck, faCircleXmark, faTriangleExclamation,
  faCircleInfo, faXmark,
} from '@fortawesome/free-solid-svg-icons';

const NotifierContext = createContext(null);

/* ── Configurações por tipo ─────────────────────────────── */
const TOAST_CONFIG = {
  success: {
    icon:       faCircleCheck,
    color:      'var(--accent-success)',
    bg:         'rgba(37,211,102,0.1)',
    border:     'rgba(37,211,102,0.25)',
    bar:        '#25d366',
  },
  error: {
    icon:       faCircleXmark,
    color:      'var(--accent-danger)',
    bg:         'rgba(224,82,82,0.1)',
    border:     'rgba(224,82,82,0.25)',
    bar:        '#e05252',
  },
  warning: {
    icon:       faTriangleExclamation,
    color:      'var(--accent-warning)',
    bg:         'rgba(240,165,0,0.1)',
    border:     'rgba(240,165,0,0.25)',
    bar:        '#f0a500',
  },
  info: {
    icon:       faCircleInfo,
    color:      'var(--accent-primary)',
    bg:         'rgba(79,142,247,0.1)',
    border:     'rgba(79,142,247,0.25)',
    bar:        '#4f8ef7',
  },
};

const DURATION = 4000;

/* ── Componente Toast individual ────────────────────────── */
function Toast({ id, message, severity = 'success', onRemove }) {
  const cfg = TOAST_CONFIG[severity] || TOAST_CONFIG.info;
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const startRef = useRef(null);
  const rafRef = useRef(null);

  /* Entrada */
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  /* Barra de progresso via rAF */
  useEffect(() => {
    startRef.current = performance.now();

    const tick = (now) => {
      const elapsed = now - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / DURATION) * 100);
      setProgress(remaining);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        handleDismiss();
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleDismiss = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setVisible(false);
    setTimeout(() => onRemove(id), 280);
  }, [id, onRemove]);

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        minWidth: '300px',
        maxWidth: '380px',
        padding: '12px 14px 14px',
        borderRadius: '14px',
        border: `1px solid ${cfg.border}`,
        backgroundColor: cfg.bg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        transform: visible ? 'translateX(0) scale(1)' : 'translateX(32px) scale(0.96)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.28s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s ease',
        cursor: 'default',
      }}
    >
      {/* Ícone */}
      <Box sx={{ mt: '1px', flexShrink: 0 }}>
        <FontAwesomeIcon
          icon={cfg.icon}
          style={{ fontSize: '16px', color: cfg.color }}
        />
      </Box>

      {/* Mensagem */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{
          fontSize: '0.83rem',
          fontWeight: 500,
          color: 'var(--text-primary)',
          lineHeight: 1.45,
          wordBreak: 'break-word',
        }}>
          {message}
        </Typography>
      </Box>

      {/* Fechar */}
      <IconButton
        size="small"
        onClick={handleDismiss}
        sx={{
          width: 22, height: 22, mt: '-2px', mr: '-4px',
          color: 'var(--text-muted)',
          '&:hover': { color: 'var(--text-primary)', backgroundColor: 'rgba(255,255,255,0.08)' },
        }}
      >
        <FontAwesomeIcon icon={faXmark} style={{ fontSize: '11px' }} />
      </IconButton>

      {/* Barra de progresso */}
      <Box sx={{
        position: 'absolute',
        bottom: 0, left: 0,
        height: '3px',
        width: `${progress}%`,
        backgroundColor: cfg.bar,
        borderRadius: '0 0 0 14px',
        transition: 'width 0.05s linear',
        opacity: 0.7,
      }} />
    </Box>
  );
}

/* ══════════════════════════════════════════════════════════
   PROVIDER PRINCIPAL
══════════════════════════════════════════════════════════ */
export function NotifierProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const notify = useCallback((message, severity = 'success') => {
    const id = ++counterRef.current;
    setToasts(prev => [...prev, { id, message, severity }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <NotifierContext.Provider value={notify}>
      {children}

      {/* Stack de toasts — canto inferior direito */}
      <Box sx={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        alignItems: 'flex-end',
        pointerEvents: 'none',
        '& > *': { pointerEvents: 'auto' },
      }}>
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            id={toast.id}
            message={toast.message}
            severity={toast.severity}
            onRemove={removeToast}
          />
        ))}
      </Box>
    </NotifierContext.Provider>
  );
}

export function useNotifier() {
  return useContext(NotifierContext);
}