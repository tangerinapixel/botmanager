// preload.js (na raiz do seu projeto)
const { contextBridge, ipcRenderer } = require('electron');

// Canais que o Renderer pode ENVIAR mensagens para o Main Process
const validSendChannels = [
  'validate-license',
  'get-initial-activation-status',
  'exportar-etiqueta', // Canal para exportar etiquetas
  'exportar-grupo'    // Canal para exportar grupos
];

// Canais que o Renderer pode OUVIR mensagens do Main Process
const validReceiveChannels = [
  'activation-status',
  'initial-activation-status',
  'backend-status',
  'download-progress', // Opcional, para receber progresso do download
  'download-complete'  // Opcional, para receber status final do download
];

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => {
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.warn(`Preload Script: Tentativa de ENVIO em canal inválido: ${channel}`);
    }
  },
  on: (channel, funcCallback) => {
    if (validReceiveChannels.includes(channel)) {
      const subscription = (event, ...args) => funcCallback(...args);
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
        console.log(`Preload Script: Listener para o canal "${channel}" foi removido.`);
      };
    } else {
      console.warn(`Preload Script: Tentativa de OUVIR em canal inválido: ${channel}`);
      return () => {}; 
    }
  },
  removeListener: (channel, funcCallback) => {
    if (validReceiveChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, funcCallback);
    } else {
      console.warn(`Preload Script: Tentativa de REMOVER LISTENER de canal inválido: ${channel}`);
    }
  },
  removeAllListeners: (channel) => {
    if (validReceiveChannels.includes(channel)) {
        ipcRenderer.removeAllListeners(channel);
        console.log(`Preload Script: Todos os listeners para o canal "${channel}" foram removidos.`);
    } else {
        console.warn(`Preload Script: Tentativa de REMOVER TODOS OS LISTENERS de canal inválido: ${channel}`);
    }
  },

  // --- FUNÇÕES DE ATALHO QUE ESTAVAM FALTANDO ---
  exportarEtiqueta: (id) => ipcRenderer.send('exportar-etiqueta', id),
  exportarGrupo: (id) => ipcRenderer.send('exportar-grupo', id)
  // ---------------------------------------------
});

console.log('Preload script "electronAPI" foi carregado e exposto na window.');