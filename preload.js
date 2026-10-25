// preload.js (na raiz do seu projeto)
const { contextBridge, ipcRenderer } = require('electron');

const listenersMap = new Map();

// Canais que o Renderer pode ENVIAR mensagens para o Main Process
const validSendChannels = [
  'validate-license',
  'get-initial-activation-status',
  'exportar-etiqueta',
  'exportar-grupo',
  'restart-backend',
  'window:minimize',
  'window:maximize',
  'window:close'
];

// Canais que o Renderer pode OUVIR mensagens do Main Process
const validReceiveChannels = [
  'activation-status',
  'initial-activation-status',
  'backend-status',
  'backend-restart-initiated',
  'download-progress',
  'download-complete'
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
      let subscription = listenersMap.get(funcCallback);
      if (!subscription) {
        subscription = (event, ...args) => funcCallback(...args);
        listenersMap.set(funcCallback, subscription);
      }
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
        listenersMap.delete(funcCallback);
        console.log(`Preload Script: Listener para o canal "${channel}" foi removido.`);
      };
    } else {
      console.warn(`Preload Script: Tentativa de OUVIR em canal inválido: ${channel}`);
      return () => {}; 
    }
  },
  removeListener: (channel, funcCallback) => {
    if (validReceiveChannels.includes(channel)) {
      const subscription = listenersMap.get(funcCallback);
      if (subscription) {
        ipcRenderer.removeListener(channel, subscription);
        listenersMap.delete(funcCallback);
      } else {
        ipcRenderer.removeListener(channel, funcCallback);
      }
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

  // --- FUNÇÕES PARA BACKEND RESTART ---
  restartBackend: () => ipcRenderer.send('restart-backend'),
  onBackendStatus: (callback) => {
    const subscription = (event, data) => callback(event, data);
    ipcRenderer.on('backend-status', subscription);
    return () => ipcRenderer.removeListener('backend-status', subscription);
  },
  onBackendRestartInitiated: (callback) => {
    const subscription = (event, data) => callback(event, data);
    ipcRenderer.on('backend-restart-initiated', subscription);
    return () => ipcRenderer.removeListener('backend-restart-initiated', subscription);
  },

  // --- FUNÇÕES DE ATALHO QUE ESTAVAM FALTANDO ---
  exportarEtiqueta: (id) => ipcRenderer.send('exportar-etiqueta', id),
  exportarGrupo: (id) => ipcRenderer.send('exportar-grupo', id),

  // --- CONTROLES DE JANELA ---
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow:    () => ipcRenderer.send('window:close')
  // ------------------------------------------------
});