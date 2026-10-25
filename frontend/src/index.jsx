import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import App from './App';
import { NotifierProvider } from './context/Notifier';
import theme from './theme';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotifierProvider>
        <App />
      </NotifierProvider>
    </ThemeProvider>
  </React.StrictMode>
);
