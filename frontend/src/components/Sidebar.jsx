// frontend/src/components/Sidebar.jsx
import React from 'react';
import { Box, Tooltip, IconButton, Divider, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWhatsapp,
} from '@fortawesome/free-brands-svg-icons';
import {
  faHouse,
  faRobot,
  faPaperPlane,
  faGear,
  faAngleLeft,
  faAngleRight,
  faCircleCheck,
  faCircleXmark,
  faSpinner,
  faMobileScreen,
  faComments,
} from '@fortawesome/free-solid-svg-icons';
import PulsatingDot from './PulsatingDot';

/* ── helpers de status ─────────────────────────────────── */
function StatusBadge({ status, loadingProgress = 0 }) {
  if (status === 'ready') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <PulsatingDot />
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-success)', lineHeight: 1 }}>
          Online
        </Typography>
      </Box>
    );
  }
  if (status === 'loading') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <FontAwesomeIcon icon={faSpinner} spin style={{ color: 'var(--accent-primary)', fontSize: '10px' }} />
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1 }}>
          {loadingProgress > 0 ? `Sincronizando ${loadingProgress}%` : 'Conectando...'}
        </Typography>
      </Box>
    );
  }
  if (status === 'qr') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <FontAwesomeIcon icon={faMobileScreen} style={{ color: 'var(--accent-primary)', fontSize: '10px' }} />
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--accent-primary)', lineHeight: 1 }}>
          QR Code
        </Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <FontAwesomeIcon icon={faCircleXmark} style={{ color: 'var(--accent-danger)', fontSize: '10px' }} />
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--accent-danger)', lineHeight: 1 }}>
        Desconectado
      </Typography>
    </Box>
  );
}

/* ── item de navegação ─────────────────────────────────── */
function NavItem({ icon, label, active, onClick, collapsed, badge }) {
  const item = (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: collapsed ? '10px 0' : '10px 14px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        position: 'relative',
        backgroundColor: active ? 'rgba(79, 142, 247, 0.14)' : 'transparent',
        border: active ? '1px solid rgba(79, 142, 247, 0.25)' : '1px solid transparent',
        color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
        transition: 'var(--transition-fast)',
        '&:hover': {
          backgroundColor: active ? 'rgba(79, 142, 247, 0.18)' : 'var(--bg-hover)',
          color: 'var(--text-primary)',
        },
      }}
    >
      {/* Barra indicadora de ativo */}
      {active && (
        <Box sx={{
          position: 'absolute',
          left: 0,
          top: '20%',
          height: '60%',
          width: '3px',
          borderRadius: '0 3px 3px 0',
          backgroundColor: 'var(--accent-primary)',
          boxShadow: 'var(--shadow-glow-blue)',
        }} />
      )}

      <FontAwesomeIcon
        icon={icon}
        style={{ fontSize: '16px', flexShrink: 0, width: '18px', textAlign: 'center' }}
      />

      {!collapsed && (
        <Typography sx={{
          fontSize: '0.82rem',
          fontWeight: active ? 600 : 400,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {label}
        </Typography>
      )}
    </Box>
  );

  if (collapsed) {
    return <Tooltip title={label} placement="right">{item}</Tooltip>;
  }
  return item;
}

/* ── SIDEBAR PRINCIPAL ─────────────────────────────────── */
function Sidebar({ collapsed, onToggle, activeConfigPage, setActiveConfigPage, waClientStatus, loadingProgress = 0, onConnect }) {
  const navItems = [
    { id: null,          icon: faHouse,      label: 'Visão Geral' },
    { id: 'liveChat',    icon: faComments,   label: 'Conversas' },
    { id: 'configIA',    icon: faRobot,       label: 'Configuração IA' },
    { id: 'contentIA',   icon: faGear,        label: 'Conteúdo da IA' },
    { id: 'promptIA',    icon: faGear,        label: 'Prompt da IA' },
    { id: 'bulkSender',  icon: faPaperPlane,  label: 'Envio em Massa' },
    { id: 'flowsPage',   icon: faWhatsapp,    label: 'Todos os Fluxos' },
  ];

  return (
    <Box
      component="aside"
      sx={{
        width: collapsed ? '60px' : '210px',
        minWidth: collapsed ? '60px' : '210px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--glass-bg)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderRight: '1px solid var(--glass-border)',
        transition: 'width 0.25s ease, min-width 0.25s ease',
        overflow: 'hidden',
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      {/* ── LOGO / TOPO ── */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding: collapsed ? '18px 0' : '18px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        {!collapsed && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <Box sx={{
              width: 30, height: 30, borderRadius: '8px',
              background: 'linear-gradient(135deg, #25d366, #128c7e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <FontAwesomeIcon icon={faWhatsapp} style={{ color: 'white', fontSize: '16px' }} />
            </Box>
            <Typography sx={{
              fontSize: '0.82rem', fontWeight: 700,
              color: 'var(--text-primary)', whiteSpace: 'nowrap',
              letterSpacing: '0.01em',
            }}>
              Bot Manager
            </Typography>
          </Box>
        )}
        {collapsed && (
          <Box sx={{
            width: 30, height: 30, borderRadius: '8px',
            background: 'linear-gradient(135deg, #25d366, #128c7e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FontAwesomeIcon icon={faWhatsapp} style={{ color: 'white', fontSize: '16px' }} />
          </Box>
        )}
        {!collapsed && (
          <IconButton onClick={onToggle} size="small" sx={{ color: 'var(--text-muted)', p: '4px' }}>
            <FontAwesomeIcon icon={faAngleLeft} style={{ fontSize: '13px' }} />
          </IconButton>
        )}
      </Box>

      {/* ── STATUS DE CONEXÃO ── */}
      <Box sx={{
        padding: collapsed ? '12px 0' : '12px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        {collapsed ? (
          <Tooltip title={waClientStatus === 'loading' && loadingProgress > 0 ? `WhatsApp: Sincronizando ${loadingProgress}%` : `WhatsApp: ${waClientStatus}`} placement="right">
            <Box sx={{ cursor: 'pointer' }} onClick={onConnect}>
              {waClientStatus === 'ready'
                ? <FontAwesomeIcon icon={faCircleCheck} style={{ color: 'var(--accent-success)', fontSize: '14px' }} />
                : waClientStatus === 'loading'
                ? <FontAwesomeIcon icon={faSpinner} spin style={{ color: 'var(--accent-warning)', fontSize: '14px' }} />
                : <FontAwesomeIcon icon={faCircleXmark} style={{ color: 'var(--accent-danger)', fontSize: '14px' }} />
              }
            </Box>
          </Tooltip>
        ) : (
          <>
            <StatusBadge status={waClientStatus} loadingProgress={loadingProgress} />
            <Box
              component="button"
              onClick={onConnect}
              sx={{
                fontSize: '0.7rem', fontWeight: 500,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '3px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                background: 'transparent',
                fontFamily: 'var(--font-family)',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                '&:hover': {
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border-strong)',
                  backgroundColor: 'var(--bg-hover)',
                },
                '&:active': { transform: 'scale(0.96)' },
              }}
            >
              {waClientStatus === 'ready' ? 'Reiniciar' : 'Conectar'}
            </Box>
          </>
        )}
      </Box>

      {/* ── NAVEGAÇÃO ── */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: collapsed ? '8px 6px' : '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {!collapsed && (
          <Typography sx={{
            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
            color: 'var(--text-muted)', textTransform: 'uppercase',
            padding: '8px 14px 4px',
          }}>
            Navegação
          </Typography>
        )}

        {navItems.map((item) => (
          <NavItem
            key={String(item.id)}
            icon={item.icon}
            label={item.label}
            active={activeConfigPage === item.id}
            collapsed={collapsed}
            onClick={() => setActiveConfigPage(item.id)}
          />
        ))}
      </Box>

      {/* ── RODAPÉ DA SIDEBAR ── */}
      <Box sx={{
        borderTop: '1px solid var(--border-subtle)',
        padding: collapsed ? '12px 0' : '12px 14px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
      }}>
        {!collapsed && (
          <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            © {new Date().getFullYear()} Bot Manager
          </Typography>
        )}
        {collapsed && (
          <Tooltip title="Expandir menu" placement="right">
            <IconButton onClick={onToggle} size="small" sx={{ color: 'var(--text-muted)', p: '4px' }}>
              <FontAwesomeIcon icon={faAngleRight} style={{ fontSize: '13px' }} />
            </IconButton>
          </Tooltip>
        )}
        {!collapsed && (
          <Tooltip title="Recolher menu" placement="top">
            <IconButton onClick={onToggle} size="small" sx={{ color: 'var(--text-muted)', p: '4px' }}>
              <FontAwesomeIcon icon={faAngleLeft} style={{ fontSize: '13px' }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}

export default Sidebar;
