// --- CONFIGURAÇÃO DE CODIFICAÇÃO UTF-8 DO CONSOLE (WINDOWS) ---
if (process.platform === 'win32') {
  try {
    require('child_process').execSync('chcp 65001', { stdio: 'ignore' });
  } catch (err) {
    // Ignora silenciosamente se houver erro
  }
}

const { app, BrowserWindow, ipcMain, dialog, utilityProcess, Menu } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const Store = require('electron-store');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const splashManager = require('./preloader/splashManager');

// Variáveis globais
const store = new Store();
let mainWindow;
let botProcess;
let isActivated = false;
let isDownloadListenerAttached = false;
let checkerInterval = null;

// Callback IPC: preenchido por loadAppWhenReady(), consumido por startBotBackend()
let onBackendReadyCallback = null;
// Flag de segurança: sinal IPC pode chegar antes de loadAppWhenReady() setar o callback
let backendReadyPending = false;

// --- CONTROLE DE RESTART AUTOMÁTICO DO BACKEND ---
let botRestartAttempts = 0;
let botRestartTimeout = null;
const MAX_RESTART_ATTEMPTS = 5;
const BASE_RESTART_DELAY = 2000; // 2 segundos inicial
const MAX_RESTART_DELAY = 30000;  // máximo de 30 segundos

function getRestartDelay() {
  // Backoff exponencial: 2s, 4s, 8s, 16s, 30s
  const delay = Math.min(BASE_RESTART_DELAY * Math.pow(2, botRestartAttempts), MAX_RESTART_DELAY);
  return Math.round(delay);
}

// --- FUNÇÕES PRINCIPAIS ---

function checkActivationStatus() {
  try {
    const licenseInfo = store.get('appLicense');
    isActivated = !!(licenseInfo && licenseInfo.isActivated);
    if (isActivated) {
      console.log('[Electron Main] Aplicação já ativada. Chave:', licenseInfo.key);
    } else {
      console.log('[Electron Main] Aplicação não ativada.');
    }
  } catch (error) {
    console.error('[Electron Main] Erro ao verificar status de ativação:', error);
    isActivated = false;
  }
}

function createWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return;
  }

  // 1. Inicializa a janela Splash independente imediatamente (card frameless premium)
  splashManager.createSplashWindow();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Mantém oculta na memória enquanto carrega o React
    backgroundColor: '#161b27',
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      zoomFactor: 0.9
    },
    icon: path.join(__dirname, 'assets', 'chatb.png')
  });

  // Atalho manual para abrir DevTools (Ctrl+Shift+I e F12) mesmo sem o menu padrão
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control && input.shift && input.key.toLowerCase() === 'i') || input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  const loadAppWhenReady = () => {
    const appUrl = `http://localhost:5005`;
    const healthUrl = `http://127.0.0.1:5005/api/status`;
    let backendReady = false;

    const stopChecker = () => {
      if (checkerInterval) {
        clearInterval(checkerInterval);
        checkerInterval = null;
      }
    };

    const loadApp = () => {
      if (backendReady) return;
      backendReady = true;
      onBackendReadyCallback = null; // Limpa o callback após uso
      stopChecker();
      console.log('[Electron Main] Backend pronto! Carregando aplicação principal em segundo plano...');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(appUrl);
      }
    };

    // Registra o callback para que startBotBackend() possa disparar loadApp
    // quando receber o sinal IPC do backend. Cada novo fork atualiza este callback.
    onBackendReadyCallback = loadApp;

    // Se o sinal IPC chegou antes deste callback ser registrado (race condition
    // causada pelo bot subir rápido com lazy init), dispara imediatamente.
    if (backendReadyPending) {
      backendReadyPending = false;
      console.log('[Electron Main] Sinal IPC estava pendente. Disparando loadApp agora...');
      loadApp();
      return;
    }

    // --- ABORDAGEM HÍBRIDA (FAST-PATH IPC + POLLING OTIMIZADO) ---
    // Polling ágil a cada 600ms via 127.0.0.1 (evita atrasos de resolução DNS do localhost).
    checkerInterval = setInterval(() => {
      axios.get(healthUrl, { timeout: 800 })
        .then(response => {
          if (response.status === 200) {
            console.log('[Electron Main] Backend detectado via Polling HTTP (/api/status).');
            loadApp();
          }
        })
        .catch(() => {
          // Fallback de sondagem na raiz caso /api/status ainda esteja registrando
          axios.get(`http://127.0.0.1:5005`, { timeout: 800 })
            .then(res => {
              if (res.status === 200) {
                console.log('[Electron Main] Backend detectado via Polling HTTP (raiz).');
                loadApp();
              }
            })
            .catch(() => {
              // Continua aguardando o backend
            });
        });
    }, 600);

    if (mainWindow) {
      mainWindow.on('closed', stopChecker);
    }
  };

  loadAppWhenReady();

  if (!isDownloadListenerAttached) {
    mainWindow.webContents.session.on('will-download', (event, item) => {
      const fileName = item.getFilename();
      console.log(`[Electron Main] Interceptado download de: ${fileName}`);
      item.pause();

      dialog.showSaveDialog({
        title: 'Salvar Arquivo',
        defaultPath: path.join(app.getPath('downloads'), fileName),
        buttonLabel: 'Salvar',
        filters: [{ name: 'Planilhas Excel', extensions: ['xlsx'] }]
      }).then(({ canceled, filePath }) => {
        if (canceled || !filePath) {
          item.cancel();
          return;
        }
        item.setSavePath(filePath);
        item.resume();
      }).catch(err => {
        console.error('[Electron Main] Erro ao mostrar a caixa de diálogo de salvar:', err);
        item.cancel();
      });

      item.once('done', (evt, state) => {
        const savedPath = item.getSavePath();
        const webContents = event.sender;
        if (state === 'completed') {
          console.log(`Download de ${fileName} concluído com sucesso em: ${savedPath}`);
          if (webContents && !webContents.isDestroyed()) webContents.send('download-complete', { success: true, path: savedPath });
        } else {
          console.error(`Download de ${fileName} falhou. Estado: ${state}`);
          if (webContents && !webContents.isDestroyed()) webContents.send('download-complete', { success: false, state: state });
        }
      });
    });
    isDownloadListenerAttached = true;
    console.log('[Electron Main] Gerenciador de downloads configurado.');
  }

  mainWindow.webContents.on('did-finish-load', () => {
    const currentURL = mainWindow.webContents.getURL();
    if (mainWindow && !mainWindow.isDestroyed() && currentURL.includes(':5005')) {
      console.log('[Electron Main] Aplicação principal carregada. Executando transição atômica...');
      splashManager.transitionToMain(mainWindow, () => {
        mainWindow.webContents.send('initial-activation-status', isActivated);
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    splashManager.destroySplash();
  });
}

function startBotBackend() {
  const backendPath = app.isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, 'backend');
  const botScriptPath = path.join(backendPath, 'bot.js');
  
  // Limpa timeout de restart pendente se houver
  if (botRestartTimeout) {
    clearTimeout(botRestartTimeout);
    botRestartTimeout = null;
  }
  
  if (botProcess) {
    botProcess.kill();
    botProcess = null;
  }
  
  const logFilePath = path.join(app.getPath('userData'), 'backend-log.txt');
  const crashLogFilePath = path.join(app.getPath('userData'), 'backend-crash-log.txt');
  try {
    fs.writeFileSync(logFilePath, `--- BACKEND LOG INICIADO EM ${new Date().toISOString()} ---\n`);
  } catch (err) {
    console.error('Falha ao inicializar arquivo de log do backend:', err);
  }
  try {
    if (!fs.existsSync(crashLogFilePath)) {
      fs.writeFileSync(crashLogFilePath, `--- BACKEND CRASH LOG INICIADO EM ${new Date().toISOString()} ---\n`);
    } else {
      fs.appendFileSync(crashLogFilePath, `\n--- BACKEND CRASH LOG INICIADO EM ${new Date().toISOString()} ---\n`);
    }
  } catch (err) {
    console.error('Falha ao inicializar arquivo de crash log do backend:', err);
  }

  const logToBackendFile = (msg) => {
    try {
      fs.appendFileSync(logFilePath, msg + '\n');
    } catch (e) {}
  };

  const logToCrashFile = (msg) => {
    try {
      fs.appendFileSync(crashLogFilePath, msg + '\n');
    } catch (e) {}
  };

  console.log(`[Electron Main] Iniciando backend: ${botScriptPath}`);
  logToBackendFile(`[Electron Main] Iniciando backend: ${botScriptPath}`);

  botProcess = utilityProcess.fork(botScriptPath, [], {
    cwd: backendPath,
    stdio: 'pipe',
    env: {
      ...process.env,
      USER_DATA_PATH: app.getPath('userData'),
      NODE_ENV: app.isPackaged ? 'production' : 'development'
    }
  });

  botProcess.stdout.on('data', (data) => {
    const text = `[Bot.js]: ${data.toString().trim()}`;
    console.log(text);
    logToBackendFile(text);
  });
  botProcess.stderr.on('data', (data) => {
    const text = `[Bot.js ERR]: ${data.toString().trim()}`;
    console.error(text);
    logToBackendFile(text);
    logToCrashFile(text);
  });
  botProcess.on('error', (err) => {
    const text = `[Electron Main] Erro ao tentar iniciar o processo backend bot.js: ${err.message}`;
    console.error(text);
    logToBackendFile(text);
    logToCrashFile(text);
  });
  botProcess.on('exit', (code) => {
    const text = `[Electron Main] Backend bot.js saiu com código ${code}`;
    console.log(text);
    logToBackendFile(text);
    logToCrashFile(text);
    botProcess = null;
    
    // Se saiu com código 0 ou se a aplicação está em encerramento, não tenta restart.
    if (code === 0 || isGracefulQuitting) {
      console.log(`[Electron Main] Backend encerrado (código ${code}).`);
      botRestartAttempts = 0;
      return;
    }
    
    // Caso contrário, tenta restart com backoff exponencial
    if (botRestartAttempts < MAX_RESTART_ATTEMPTS) {
      botRestartAttempts++;
      const delayMs = getRestartDelay();
      const delaySecs = Math.round(delayMs / 1000);
      
      const statusMsg = `O servidor do bot parou inesperadamente (código: ${code}). Tentando reiniciar em ${delaySecs}s (Tentativa ${botRestartAttempts}/${MAX_RESTART_ATTEMPTS})...`;
      console.warn(`[Electron Main] 🔄 ${statusMsg}`);
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backend-status', { 
          status: 'restarting', 
          message: statusMsg,
          restartAttempt: botRestartAttempts,
          maxAttempts: MAX_RESTART_ATTEMPTS,
          nextRetryIn: delaySecs
        });
      }
      splashManager.updateSplashStatus({
        status: 'restarting',
        message: statusMsg
      });
      
      botRestartTimeout = setTimeout(() => {
        console.log(`[Electron Main] ▶️ Reiniciando backend (Tentativa ${botRestartAttempts}/${MAX_RESTART_ATTEMPTS})...`);
        startBotBackend();
      }, delayMs);
    } else {
      const finalMsg = `O servidor do bot falhou após ${MAX_RESTART_ATTEMPTS} tentativas de restart automático. Por favor, reinicie a aplicação completamente.`;
      console.error(`[Electron Main] ❌ ${finalMsg}`);
      
      if (checkerInterval) {
        clearInterval(checkerInterval);
        checkerInterval = null;
      }
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backend-status', { 
          status: 'failed', 
          message: finalMsg,
          restartAttempt: botRestartAttempts,
          maxAttempts: MAX_RESTART_ATTEMPTS
        });
        mainWindow.webContents.executeJavaScript(`
          const el = document.querySelector('.loading-text');
          if (el) el.innerText = "Erro: O servidor do bot falhou ao iniciar. Verifique se a porta 5005 está ocupada.";
        `).catch(err => console.error(err));
      }
      splashManager.updateSplashStatus({
        status: 'failed',
        message: finalMsg
      });
    }
  });

  // Anexa os listeners IPC diretamente ao botProcess (sem depender de botProcess.pid síncrono)
  botRestartAttempts = 0;

  if (botProcess.pid) {
    console.log(`[Electron Main] ✅ Processo do bot.js iniciado com PID: ${botProcess.pid}.`);
  } else {
    botProcess.on('spawn', () => {
      console.log(`[Electron Main] ✅ Processo do bot.js spawn concluído com PID: ${botProcess.pid}.`);
    });
  }

  // Registra o listener IPC no botProcess.
  // Sempre que o backend faz httpServer.listen(), envia { type: 'backend-ready' }.
  // Este listener dispara o callback registrado por loadAppWhenReady() (ou o de restart).
  botProcess.on('message', (msg) => {
    if (msg && msg.type === 'backend-ready') {
      console.log(`[Electron Main] 🚀 Sinal IPC recebido: backend-ready (porta ${msg.port}).`);
      if (typeof onBackendReadyCallback === 'function') {
        onBackendReadyCallback();
      } else {
        // Race condition: sinal chegou antes de loadAppWhenReady() setar o callback.
        // Salva o sinal para ser consumido assim que o callback for registrado.
        console.log('[Electron Main] Callback ainda não registrado. Guardando sinal IPC como pendente...');
        backendReadyPending = true;
      }
    } else if (msg && msg.type === 'shutdown-complete') {
      console.log('[Electron Main] 🛑 Sinal IPC recebido: shutdown-complete do backend.');
    }
  });
}

// --- LISTENERS DO IPCMAIN (Comunicação com o Frontend) ---
ipcMain.on('get-initial-activation-status', (event) => {
  try {
    console.log("[Electron Main] Recebido 'get-initial-activation-status'. Enviando status de ativação:", isActivated);
    event.sender.send('initial-activation-status', isActivated);
  } catch (error) {
    console.error("[Electron Main] Erro no manipulador get-initial-activation-status:", error);
    event.sender.send('initial-activation-status', { success: false, error: error.message });
  }
});

// --- NOVO HANDLER: Permite que o frontend force um restart manual do backend ---
ipcMain.on('restart-backend', (event) => {
  console.log('[Electron Main] Recebido comando para reiniciar backend manualmente do frontend.');
  botRestartAttempts = 0; // Reset para permitir todas as tentativas novamente
  
  // Mata o processo atual se estiver rodando
  if (botProcess) {
    console.log('[Electron Main] Matando processo backend atual...');
    botProcess.kill();
    botProcess = null;
  }
  
  // Aguarda um pouco antes de reiniciar
  setTimeout(() => {
    console.log('[Electron Main] Iniciando backend novamente...');
    startBotBackend();
    event.sender.send('backend-restart-initiated', { success: true });
  }, 1000);
});

ipcMain.on('validate-license', async (event, licenseKeyFromRenderer) => {
  console.log(`[Electron Main] Recebida chave para validar do Renderer: ${licenseKeyFromRenderer}`);
  event.sender.send('activation-status', { status: 'validating', message: 'Validando chave...' });

  const WORDPRESS_SITE_URL = 'https://selsconsultoria.com.br';
  const CONSUMER_KEY = 'ck_d69e83ad3f86e9f56e312d796132c16dcd0d603f';
  const CONSUMER_SECRET = 'cs_575acfe34cbceae1d9bed2a846885bf07910e068';
  const PRODUCT_ID = '8826'; 

  const apiPath = `/wp-json/lmfwc/v2/licenses/activate/${encodeURIComponent(licenseKeyFromRenderer)}`;
  const fullApiUrl = `${WORDPRESS_SITE_URL}${apiPath}`;

  let instanceId = store.get('appInstanceId');
  if (!instanceId) {
    instanceId = crypto.randomBytes(16).toString('hex');
    store.set('appInstanceId', instanceId);
  }

  console.log(`[Electron Main] Tentando ativar chave em: ${fullApiUrl}`);

  try {
    const response = await axios.get(fullApiUrl, {
      params: {
        consumer_key: CONSUMER_KEY,
        consumer_secret: CONSUMER_SECRET,
        product_id: PRODUCT_ID,
        instance_name: instanceId
      },
      timeout: 25000 
    });

    console.log('[Electron Main] Resposta da API de licença:', JSON.stringify(response.data, null, 2));

    if (response.data && response.data.success === true) {
      const licenseData = response.data.data;
      
      const isActive = licenseData && (licenseData.status === 2 || licenseData.status === 3 || licenseData.status === 'active');
      const activationsOk = licenseData && 
                            (licenseData.timesActivatedMax === null || 
                             licenseData.timesActivated <= licenseData.timesActivatedMax);

      if (isActive && activationsOk) {
        store.set('appLicense', { 
          isActivated: true, 
          key: licenseKeyFromRenderer, 
          activatedAt: new Date().toISOString(),
          expiresAt: licenseData.expiresAt || null, 
          activationData: licenseData 
        });
        isActivated = true;
        event.sender.send('activation-status', {
          status: 'success',
          message: 'Aplicação ativada com sucesso!'
        });
      } else {
        let failureMessage = 'Não foi possível ativar. Verifique o status da sua licença.';
        if (!isActive && licenseData) {
          failureMessage = `A chave é válida, mas não está ativa (Status: ${licenseData.status}). Verifique seu status no painel do site.`;
        } else if (!activationsOk) {
          failureMessage = 'Limite de ativações para esta chave foi excedido.';
        }
        console.warn('[Electron Main] Ativação falhou (lógica interna):', failureMessage);
        event.sender.send('activation-status', {
          status: 'failed',
          message: failureMessage
        });
      }
    } else {
      console.error('[Electron Main] Falha na ativação - resposta da API não indica sucesso:', response.data);
      event.sender.send('activation-status', {
        status: 'failed',
        message: response.data.message || 'Chave de licença inválida ou erro na ativação.'
      });
    }
  } catch (error) {
    let errorMessage = 'Falha ao conectar ao servidor de ativação.';
    if (error.response) {
      console.error('[Electron Main] Erro da API de licença (HTTP):', error.response.status, error.response.data);
      errorMessage = (error.response.data && error.response.data.message) ? error.response.data.message : `Erro do servidor: ${error.response.status}`;
    } else if (error.request) {
      console.error('[Electron Main] Erro na API de licença (sem resposta do servidor):', error.request);
      errorMessage = 'O servidor de ativação não respondeu. Verifique sua conexão.';
    } else {
      console.error('[Electron Main] Erro ao configurar requisição para API de licença:', error.message);
      errorMessage = `Erro na requisição: ${error.message}`;
    }
    event.sender.send('activation-status', {
      status: 'failed',
      message: errorMessage
    });
  }
});

ipcMain.on('exportar-etiqueta', async (event, labelId) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) {
    console.error('[Electron Main] Nenhuma janela focada para iniciar o download.');
    return;
  }

  const downloadUrl = `http://localhost:5005/exportar-etiqueta/${encodeURIComponent(labelId)}`;
  console.log(`[Electron Main] Iniciando download manual de: ${downloadUrl}`);

  try {
    // Primeiro, fazemos uma requisição para pegar o nome do arquivo dos headers
    const headResponse = await axios.head(downloadUrl);
    const contentDisposition = headResponse.headers['content-disposition'];
    let fileName = 'contatos.xlsx'; // Nome padrão
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?(.+)"?/i);
      if (match && match[1]) fileName = match[1].replace(/"/g, '');
    }

    // 1. Mostramos a NOSSA janela de salvar primeiro
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Salvar Contatos da Etiqueta',
      defaultPath: path.join(app.getPath('downloads'), fileName),
      buttonLabel: 'Salvar',
      filters: [{ name: 'Planilhas Excel', extensions: ['xlsx'] }]
    });

    if (canceled || !filePath) {
      console.log('[Electron Main] Download cancelado pelo usuário.');
      return;
    }

    // 2. Se o usuário não cancelou, fazemos o download do arquivo como um buffer de dados
    const fileResponse = await axios.get(downloadUrl, { responseType: 'arraybuffer' });

    // 3. E salvamos os dados no disco no caminho que o usuário escolheu
    fs.writeFileSync(filePath, fileResponse.data);

    console.log(`[Electron Main] Download concluído com sucesso em: ${filePath}`);
    win.webContents.send('download-complete', { success: true, path: filePath });

  } catch (error) {
    console.error('[Electron Main] Erro durante o download manual:', error.message);
    win.webContents.send('download-complete', { success: false, message: error.message });
  }
});

ipcMain.on('exportar-grupo', async (event, groupId) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) {
    console.error('[Electron Main] Nenhuma janela focada para iniciar o download.');
    return;
  }

  const downloadUrl = `http://localhost:5005/api/exportar-grupo/${encodeURIComponent(groupId)}`;
  console.log(`[Electron Main] Iniciando download manual de: ${downloadUrl}`);

  try {
    const headResponse = await axios.head(downloadUrl);
    const contentDisposition = headResponse.headers['content-disposition'];
    let fileName = 'contatos_grupo.xlsx'; // Nome padrão
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?(.+)"?/i);
      if (match && match[1]) fileName = match[1].replace(/"/g, '');
    }

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Salvar Contatos do Grupo',
      defaultPath: path.join(app.getPath('downloads'), fileName),
      buttonLabel: 'Salvar',
      filters: [{ name: 'Planilhas Excel', extensions: ['xlsx'] }]
    });

    if (canceled || !filePath) {
      console.log('[Electron Main] Download cancelado pelo usuário.');
      return;
    }

    const fileResponse = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
    
    fs.writeFileSync(filePath, fileResponse.data);

    console.log(`[Electron Main] Download concluído com sucesso em: ${filePath}`);
    win.webContents.send('download-complete', { success: true, path: filePath });

  } catch (error) {
    console.error('[Electron Main] Erro durante o download manual do grupo:', error.message);
    win.webContents.send('download-complete', { success: false, message: error.message });
  }
});

// --- CONTROLES DE JANELA (substituem o titleBarOverlay nativo) ---
ipcMain.on('window:minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => { if (mainWindow) mainWindow.close(); });

// --- CICLO DE VIDA DA APLICAÇÃO ---
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  checkActivationStatus();
  startBotBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

let isGracefulQuitting = false;

app.on('before-quit', (event) => {
  if (isGracefulQuitting) return;

  if (botProcess) {
    event.preventDefault(); // Pausa o encerramento do Electron para permitir o fechamento limpo do Chromium
    isGracefulQuitting = true;
    console.log('[Electron Main] Solicitando encerramento suave ao backend (liberando Chromium e portas)...');

    if (botRestartTimeout) {
      clearTimeout(botRestartTimeout);
      botRestartTimeout = null;
    }
    if (checkerInterval) {
      clearInterval(checkerInterval);
      checkerInterval = null;
    }

    let hasExited = false;
    const finalizeQuit = () => {
      if (hasExited) return;
      hasExited = true;
      if (forceKillTimer) clearTimeout(forceKillTimer);
      console.log('[Electron Main] Encerramento suave do backend concluído. Finalizando Electron...');
      botProcess = null;
      app.quit();
    };

    // Fallback de segurança: se o backend não finalizar em 2.5s, força kill para não travar o fechamento
    const forceKillTimer = setTimeout(() => {
      if (!hasExited && botProcess) {
        console.warn('[Electron Main] ⚠️ Backend não encerrou a tempo. Forçando término...');
        try {
          botProcess.kill();
        } catch (_) {}
        finalizeQuit();
      }
    }, 2500);

    // Escuta término do subprocesso
    botProcess.once('exit', (code) => {
      finalizeQuit();
    });

    // Envia o comando IPC de encerramento suave ao bot.js
    try {
      botProcess.postMessage({ type: 'graceful-shutdown' });
    } catch (err) {
      console.error('[Electron Main] Falha ao enviar mensagem de shutdown via IPC:', err.message);
      try {
        botProcess.kill();
      } catch (_) {}
      finalizeQuit();
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') { 
    app.quit();
  }
});

app.on('quit', () => {
  console.log('[Electron Main] Aplicação Electron encerrada com sucesso.');
});