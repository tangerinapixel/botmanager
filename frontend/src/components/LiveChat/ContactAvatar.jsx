// frontend/src/components/LiveChat/ContactAvatar.jsx
// Componente de Avatar Inteligente com carregamento assíncrono de foto de perfil, cache em memória e fallback

import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';

const API_BASE = 'http://localhost:5005';

// Cache global no módulo do frontend para reter URLs de fotos já carregadas durante a sessão
const frontendAvatarCache = new Map();
const pendingFetches = new Map();

function getInitials(name) {
  if (!name) return '?';
  const clean = name.replace(/^\+/, '').trim();
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function ContactAvatar({
  jid,
  name,
  isGroup = false,
  size = 40,
  initialAvatarUrl = null,
  fontSize = null,
  className = '',
}) {
  const [imgUrl, setImgUrl] = useState(() => {
    if (initialAvatarUrl) {
      frontendAvatarCache.set(jid, initialAvatarUrl);
      return initialAvatarUrl;
    }
    return frontendAvatarCache.get(jid) || null;
  });
  const [imgError, setImgError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!jid) return;

    // Se recebemos uma URL inicial válida via props
    if (initialAvatarUrl) {
      frontendAvatarCache.set(jid, initialAvatarUrl);
      setImgUrl(initialAvatarUrl);
      setImgError(false);
      return;
    }

    // Se já temos a URL (ou confirmamos que não tem foto) no cache local
    if (frontendAvatarCache.has(jid)) {
      setImgUrl(frontendAvatarCache.get(jid));
      return;
    }

    // Se já houver uma busca em andamento para este JID, anexa à promessa existente
    if (pendingFetches.has(jid)) {
      pendingFetches.get(jid).then(url => {
        setImgUrl(url);
      });
      return;
    }

    // Busca assíncrona sob demanda sem travar a renderização inicial
    const fetchPromise = fetch(`${API_BASE}/api/live-chat/avatar/${encodeURIComponent(jid)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const url = (data && data.avatarUrl) ? data.avatarUrl : null;
        frontendAvatarCache.set(jid, url);
        setImgUrl(url);
        pendingFetches.delete(jid);
        return url;
      })
      .catch(() => {
        frontendAvatarCache.set(jid, null);
        pendingFetches.delete(jid);
        return null;
      });

    pendingFetches.set(jid, fetchPromise);
  }, [jid, initialAvatarUrl]);

  const initials = getInitials(name);
  const calculatedFontSize = fontSize || `${Math.max(10, Math.round(size * 0.38))}px`;

  return (
    <div
      className={`live-chat-avatar ${isGroup ? 'group-avatar' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: '50%',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: calculatedFontSize,
        backgroundColor: isGroup ? 'rgba(79, 142, 247, 0.15)' : 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}
    >
      {/* Fallback visual: iniciais ou ícone de grupo */}
      {isGroup ? (
        <Users size={Math.round(size * 0.45)} style={{ color: 'var(--accent-primary)' }} />
      ) : (
        <span style={{ fontWeight: 600, color: 'var(--text-secondary)', userSelect: 'none' }}>
          {initials}
        </span>
      )}

      {/* Foto de perfil sobreposta com fade-in suave */}
      {imgUrl && !imgError && (
        <img
          src={imgUrl}
          alt={name || 'Avatar'}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          onError={() => setImgError(true)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.25s ease-in-out',
            borderRadius: '50%',
          }}
        />
      )}
    </div>
  );
}
