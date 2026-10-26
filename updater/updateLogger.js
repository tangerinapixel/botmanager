// updater/updateLogger.js
// Logger dedicado para o ciclo de vida do auto-updater do Electron

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class UpdateLogger {
  constructor() {
    this.logFile = null;
    try {
      const userDataPath = app.getPath('userData');
      this.logFile = path.join(userDataPath, 'updater-log.txt');
    } catch (_) {
      this.logFile = null;
    }
  }

  log(...args) {
    const text = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    const line = `[${new Date().toISOString()}] [AutoUpdater] ${text}\n`;
    console.log(line.trim());
    if (this.logFile) {
      try {
        fs.appendFileSync(this.logFile, line);
      } catch (_) {}
    }
  }

  warn(...args) {
    const text = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    const line = `[${new Date().toISOString()}] [AutoUpdater WARN] ${text}\n`;
    console.warn(line.trim());
    if (this.logFile) {
      try {
        fs.appendFileSync(this.logFile, line);
      } catch (_) {}
    }
  }

  error(...args) {
    const text = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    const line = `[${new Date().toISOString()}] [AutoUpdater ERROR] ${text}\n`;
    console.error(line.trim());
    if (this.logFile) {
      try {
        fs.appendFileSync(this.logFile, line);
      } catch (_) {}
    }
  }
}

module.exports = new UpdateLogger();
