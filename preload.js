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
  'window:close',
  // Canais de Auto-Update
  'updater:check-for-updates',
  'updater:start-download',
  'updater:quit-and-install',
  'updater:simulate-update'
];

// Canais que o Renderer pode OUVIR mensagens do Main Process
const validReceiveChannels = [
  'activation-status',
  'initial-activation-status',
  'backend-status',
  'backend-restart-initiated',
  'download-progress',
  'download-complete',
  // Canais de Auto-Update
  'updater:status',
  'updater:update-available',
  'updater:update-not-available',
  'updater:download-progress',
  'updater:update-downloaded',
  'updater:error'
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
  closeWindow:    () => ipcRenderer.send('window:close'),
  // ------------------------------------------------

  // --- AUTO-UPDATE API ---
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check-for-updates'),
    startDownload: () => ipcRenderer.invoke('updater:start-download'),
    quitAndInstall: () => ipcRenderer.invoke('updater:quit-and-install'),
    getCurrentVersion: () => ipcRenderer.invoke('updater:get-current-version'),
    simulateUpdate: () => ipcRenderer.invoke('updater:simulate-update'),
    onStatus: (cb) => {
      const sub = (e, data) => cb(data);
      ipcRenderer.on('updater:status', sub);
      return () => ipcRenderer.removeListener('updater:status', sub);
    },
    onUpdateAvailable: (cb) => {
      const sub = (e, data) => cb(data);
      ipcRenderer.on('updater:update-available', sub);
      return () => ipcRenderer.removeListener('updater:update-available', sub);
    },
    onUpdateNotAvailable: (cb) => {
      const sub = (e, data) => cb(data);
      ipcRenderer.on('updater:update-not-available', sub);
      return () => ipcRenderer.removeListener('updater:update-not-available', sub);
    },
    onDownloadProgress: (cb) => {
      const sub = (e, data) => cb(data);
      ipcRenderer.on('updater:download-progress', sub);
      return () => ipcRenderer.removeListener('updater:download-progress', sub);
    },
    onUpdateDownloaded: (cb) => {
      const sub = (e, data) => cb(data);
      ipcRenderer.on('updater:update-downloaded', sub);
      return () => ipcRenderer.removeListener('updater:update-downloaded', sub);
    },
    onError: (cb) => {
      const sub = (e, data) => cb(data);
      ipcRenderer.on('updater:error', sub);
      return () => ipcRenderer.removeListener('updater:error', sub);
    }
  }
});