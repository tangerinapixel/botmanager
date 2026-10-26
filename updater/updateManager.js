// updater/updateManager.js
// Orquestrador Central de Atualizações Automáticas (Auto-Updater) via GitHub Releases

const { app, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const isDev = require('electron-is-dev');
const logger = require('./updateLogger');

class UpdateManager {
  constructor() {
    this.mainWindow = null;
    this.isInitialized = false;
    this.status = 'idle'; // 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'
    this.currentUpdateInfo = null;
    this.downloadProgress = null;
  }

  /**
   * Inicializa o gerenciador de atualizações com a janela principal do Electron.
   * @param {BrowserWindow} mainWindow 
   */
  init(mainWindow) {
    if (this.isInitialized) return;
    this.mainWindow = mainWindow;
    this.isInitialized = true;

    logger.log(`Inicializando UpdateManager (Versão Atual: ${app.getVersion()}, isDev: ${isDev})`);

    // Configurações do autoUpdater
    autoUpdater.logger = logger;
    autoUpdater.autoDownload = false; // Exige consentimento do usuário no modal
    autoUpdater.autoInstallOnAppQuit = false;

    // Configuração explícita do feed no GitHub
    try {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'tangerinapixel',
        repo: 'botmanager'
      });
    } catch (feedErr) {
      logger.warn(`Aviso ao definir feed URL: ${feedErr.message}`);
    }

    this._setupAutoUpdaterEvents();
    this._setupIpcHandlers();

    // Em produção, agenda checagem automática silenciosa 8 segundos após inicialização
    if (!isDev) {
      setTimeout(() => {
        this.checkForUpdates(false);
      }, 8000);
    }
  }

  /**
   * Envia evento para a janela do Renderer de forma segura
   */
  _send(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.webContents) {
      try {
        this.mainWindow.webContents.send(channel, data);
      } catch (err) {
        logger.warn(`Erro ao enviar IPC ${channel}: ${err.message}`);
      }
    }
  }

  /**
   * Registra os eventos do ciclo de vida da biblioteca electron-updater
   */
  _setupAutoUpdaterEvents() {
    autoUpdater.on('checking-for-update', () => {
      this.status = 'checking';
      logger.log('Verificando atualizações no GitHub...');
      this._send('updater:status', { state: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
      this.status = 'available';
      this.currentUpdateInfo = info;
      logger.log(`Nova versão disponível encontrada: v${info.version}`);
      this._send('updater:update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
        currentVersion: app.getVersion()
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      this.status = 'idle';
      logger.log(`Aplicativo atualizado. Nenhuma versão nova disponível (v${info.version}).`);
      this._send('updater:update-not-available', {
        currentVersion: app.getVersion(),
        latestVersion: info.version
      });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      this.status = 'downloading';
      this.downloadProgress = progressObj;
      this._send('updater:download-progress', {
        percent: Math.round(progressObj.percent || 0),
        bytesPerSecond: progressObj.bytesPerSecond || 0,
        transferred: progressObj.transferred || 0,
        total: progressObj.total || 0
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.status = 'downloaded';
      logger.log(`Download da versão v${info.version} concluído com sucesso e pronto para instalar.`);
      this._send('updater:update-downloaded', {
        version: info.version,
        currentVersion: app.getVersion()
      });
    });

    autoUpdater.on('error', (err) => {
      this.status = 'error';
      logger.error(`Erro durante o ciclo de atualização: ${err.message}`);
      this._send('updater:error', {
        message: err.message || 'Falha ao verificar ou baixar atualização'
      });
    });
  }

  /**
   * Registra os handlers de IPC invocados pelo Renderer (React)
   */
  _setupIpcHandlers() {
    // 1. Verificar atualizações manualmente
    ipcMain.handle('updater:check-for-updates', async () => {
      return this.checkForUpdates(true);
    });

    // 2. Iniciar download do pacote
    ipcMain.handle('updater:start-download', async () => {
      logger.log('Iniciando download do pacote de atualização solicitado pelo usuário...');
      try {
        await autoUpdater.downloadUpdate();
        return { success: true };
      } catch (err) {
        logger.error(`Falha ao iniciar download: ${err.message}`);
        return { success: false, error: err.message };
      }
    });

    // 3. Reiniciar e instalar agora
    ipcMain.handle('updater:quit-and-install', () => {
      logger.log('Aplicando atualização: reiniciando aplicação...');
      try {
        setImmediate(() => {
          autoUpdater.quitAndInstall(false, true);
        });
        return { success: true };
      } catch (err) {
        logger.error(`Falha no quitAndInstall: ${err.message}`);
        return { success: false, error: err.message };
      }
    });

    // 4. Obter versão atual do app
    ipcMain.handle('updater:get-current-version', () => {
      return app.getVersion();
    });

    // 5. Simular update (útil para testar o modal em desenvolvimento)
    ipcMain.handle('updater:simulate-update', () => {
      logger.log('Simulando nova versão disponível para teste visual de UI...');
      this._send('updater:update-available', {
        version: '2.1.8',
        releaseDate: new Date().toISOString(),
        releaseNotes: '### 🚀 Melhorias de Teste\n- Teste de interface do modal de atualização.\n- Simulação de download e instalação rápida.',
        currentVersion: app.getVersion(),
        isSimulation: true
      });
      return { success: true };
    });
  }

  /**
   * Dispara a checagem de atualizações no GitHub
   * @param {boolean} isManual Se a checagem foi solicitada manualmente pelo usuário
   */
  async checkForUpdates(isManual = false) {
    logger.log(`Disparando checkForUpdates (Manual: ${isManual}, isDev: ${isDev})`);

    if (isDev) {
      // Em modo dev, se não houver dev-app-update.yml, trata defensivamente
      try {
        return await autoUpdater.checkForUpdates();
      } catch (devErr) {
        logger.warn(`Checagem em modo Dev requer dev-app-update.yml: ${devErr.message}`);
        if (isManual) {
          this._send('updater:update-not-available', {
            currentVersion: app.getVersion(),
            message: 'Ambiente de desenvolvimento local (isDev)'
          });
        }
        return null;
      }
    }

    try {
      return await autoUpdater.checkForUpdates();
    } catch (err) {
      logger.error(`Erro ao checar atualizações: ${err.message}`);
      if (isManual) {
        this._send('updater:error', { message: err.message });
      }
      return null;
    }
  }
}

module.exports = new UpdateManager();
