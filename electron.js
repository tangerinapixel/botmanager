const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const Store = require('electron-store');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

// Variáveis globais
const store = new Store();
let mainWindow;
let botProcess;
let isActivated = false;
let isDownloadListenerAttached = false;

// --- FUNÇÕES PRINCIPAIS ---

function checkActivationStatus() {
  const licenseInfo = store.get('appLicense');
  isActivated = !!(licenseInfo && licenseInfo.isActivated);
  if (isActivated) {
    console.log('[Electron Main] Aplicação já ativada. Chave:', licenseInfo.key);
  } else {
    console.log('[Electron Main] Aplicação não ativada.');
  }
}

function createWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: '#242424',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'chatb.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'preloader', 'loading.html'));

  mainWindow.on('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  const checkBackendAndLoadApp = () => {
    const appUrl = 'http://localhost:5001';
    let checkerInterval;

    const stopChecker = () => {
      if (checkerInterval) {
        clearInterval(checkerInterval);
        checkerInterval = null;
      }
    };

    checkerInterval = setInterval(() => {
      axios.get(appUrl, { timeout: 1500 })
        .then(response => {
          if (response.status === 200) {
            console.log('[Electron Main] Backend está pronto! Carregando a aplicação principal...');
            stopChecker();
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadURL(appUrl);
            }
          }
        })
        .catch(error => {
          console.log(`[Electron Main] Aguardando o backend em ${appUrl}...`);
        });
    }, 2000);

    if (mainWindow) {
      mainWindow.on('closed', stopChecker);
    }
  };

  checkBackendAndLoadApp();

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
    if (mainWindow && !mainWindow.isDestroyed() && currentURL.startsWith('http://localhost:5001')) {
      console.log('[Electron Main] Aplicação principal carregada. Enviando status inicial de ativação:', isActivated);
      mainWindow.webContents.send('initial-activation-status', isActivated);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBotBackend() {
  const backendPath = path.join(__dirname, 'backend');
  const botScriptPath = path.join(backendPath, 'bot.js');
  
  if (botProcess && !botProcess.killed) {
    botProcess.kill();
    botProcess = null;
  }
  
  console.log(`[Electron Main] Iniciando backend: ${botScriptPath}`);
  botProcess = fork(botScriptPath, [], {
    cwd: backendPath,
    silent: true 
  });

  botProcess.stdout.on('data', (data) => console.log(`[Bot.js STDOUT]: ${data.toString().trim()}`));
  botProcess.stderr.on('data', (data) => console.error(`[Bot.js STDERR]: ${data.toString().trim()}`));
  botProcess.on('error', (err) => console.error('[Electron Main] Erro ao tentar iniciar o processo backend bot.js:', err));
  botProcess.on('exit', (code, signal) => {
    console.log(`[Electron Main] Backend bot.js saiu com código ${code} e sinal ${signal}`);
    botProcess = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backend-status', { 
            status: 'crashed', 
            message: `O servidor do bot parou (código: ${code}, sinal: ${signal}). Tente reiniciar a aplicação.` 
        });
    }
  });

  if (botProcess.pid) {
    console.log(`[Electron Main] Processo do bot.js iniciado com PID: ${botProcess.pid}.`);
  }
}

// --- LISTENERS DO IPCMAIN (Comunicação com o Frontend) ---
ipcMain.on('get-initial-activation-status', (event) => {
    console.log("[Electron Main] Recebido 'get-initial-activation-status'. Enviando status de ativação:", isActivated);
    event.sender.send('initial-activation-status', isActivated);
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
      
      const isActive = licenseData && (licenseData.status === 2 || licenseData.status === 'active');
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

  const downloadUrl = `http://localhost:5001/exportar-etiqueta/${encodeURIComponent(labelId)}`;
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

  const downloadUrl = `http://localhost:5001/api/exportar-grupo/${encodeURIComponent(groupId)}`;
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

// --- CICLO DE VIDA DA APLICAÇÃO ---
app.whenReady().then(() => {
  checkActivationStatus();
  startBotBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') { 
    app.quit();
  }
});

app.on('quit', () => {
  console.log('[Electron Main] Encerrando aplicação Electron...');
  if (botProcess) {
    console.log('[Electron Main] Parando processo do bot.js...');
    botProcess.kill(); 
  }
});