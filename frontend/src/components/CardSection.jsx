import React from 'react';

function CardSection({ icon = "💬", title, children }) {
  return (
    <div
      style={{
        backgroundColor: '#f9f9ff',
        borderLeft: '6px solid #4a90e2',
        borderRadius: '10px',
        padding: '20px',
        marginBottom: '25px',
        display: 'flex',
        gap: '15px',
        alignItems: 'flex-start',
        boxShadow: '0 1px 6px rgba(0, 0, 0, 0.05)',
        flexWrap: 'wrap'
      }}
    >
      <div style={{ fontSize: '24px', color: '#4a90e2' }}>{icon}</div>
      <div style={{ flex: 1 }}>
        {title && <h2 style={{ marginTop: 0 }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export default CardSection;
