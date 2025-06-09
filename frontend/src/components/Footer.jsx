// src/components/Footer.jsx
import React from 'react';

function Footer() {
  return (
    <footer
      style={{
       padding: '10px 20px', // Aumentei um pouco o padding para melhor aparência
        textAlign: 'center',
        borderTop: '1px solid #ddd',
        backgroundColor: '#f8f9fa', // Cor de fundo para combinar com o layout
        // marginTop: 'auto', // <<<<<<< REMOVIDA
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {/*<h3 style={{ margin: '0', fontSize: '18px', fontWeight: 'bold' }}>
        👁️‍🗨️ Bot Menager X
      </h3>*/}

      <p style={{ fontSize: '12px', margin: '8px 0 4px', color: '#555' }}>
        © {new Date().getFullYear()} Todos os direitos reservados.
        Desenvolvido com tecnologia de ponta para automações inteligentes via WhatsApp.
      </p>

     {/* <p style={{ fontSize: '13px', color: '#444', margin: 0 }}>
        📞 Suporte: <strong>(44) 92001-7310</strong>
      </p>*/}
    </footer>
  );
}

export default Footer;
