// preloader/splashManager.js — Gerenciador Modular e Isolado da Janela de Splash
const { BrowserWindow } = require('electron');
const path = require('path');

let splashWindow = null;
let isTransitioning = false;

/**
 * Cria a janela de Splash independente, sem moldura, centralizada e com visual nativo.
 */
function createSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    return splashWindow;
  }

  splashWindow = new BrowserWindow({
    width: 460,
    height: 320,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload.js')
    },
    icon: path.join(__dirname, '..', 'assets', 'chatb.png')
  });

  splashWindow.loadFile(path.join(__dirname, 'loading.html'));

  splashWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.show();
    }
  });

  splashWindow.on('closed', () => {
    splashWindow = null;
  });

  return splashWindow;
}

/**
 * Envia atualizações de status ou progresso para a tela de Splash
 */
function updateSplashStatus(payload) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('backend-status', payload);
  }
}

/**
 * Transição Atômica e Suave (Sem Tela Preta):
 * Revela a janela principal apenas quando o DOM e React já estão 100% montados na memória,
 * fechando o Splash no mesmo frame.
 */
function transitionToMain(mainWindow, callback) {
  if (isTransitioning) return;
  isTransitioning = true;

  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('backend-status', { status: 'ready' });
  }

  // Micro-delay para completar a animação de 100% no Splash antes da troca de foco
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.maximize();
      mainWindow.show();
      mainWindow.focus();
    }

    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      splashWindow = null;
    }

    isTransitioning = false;
    if (typeof callback === 'function') callback();
  }, 160);
}

function getSplashWindow() {
  return splashWindow;
}

function destroySplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.destroy();
    splashWindow = null;
  }
}

module.exports = {
  createSplashWindow,
  updateSplashStatus,
  transitionToMain,
  getSplashWindow,
  destroySplash
};
