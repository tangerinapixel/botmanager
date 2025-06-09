// src/App.jsx - A NOVA VERSÃO SIMPLES
import React from 'react';
import './App.css';
import { useAppState } from './hooks/useAppState';
import { AppLayout } from './components/AppLayout';

function App() {
  // 1. Pega todos os estados e lógicas do nosso custom hook
  const appState = useAppState();

  // 2. Passa tudo para o componente de layout que cuida da parte visual
  return <AppLayout appState={appState} />;
}

export default App;