import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { NotifierProvider } from './context/Notifier'; // ✅ Importa o provider

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <NotifierProvider> {/* ✅ Envolve toda a aplicação */}
      <App />
    </NotifierProvider>
  </React.StrictMode>
);


