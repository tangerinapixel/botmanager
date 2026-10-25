const fs = require('fs');
const path = require('path');
const { clearChromeCache } = require('../utils/browserManager');

// Compatível com versões mais antigas do Node.js
module.exports = {
  dailyMaintenance: () => {
    console.log('[Maintenance] Starting daily cleanup...');
    
    // 1. Chrome Cache
    clearChromeCache();
    
    // 2. Old WhatsApp Sessions
    const cleanOldSessions = () => {
      try {
        const authDir = process.env.USER_DATA_PATH 
          ? path.join(process.env.USER_DATA_PATH, '.wwebjs_auth')
          : path.join(__dirname, '../.wwebjs_auth');
        if (fs.existsSync(authDir)) {
          const stats = fs.statSync(authDir);
          const ageDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
          
          if (ageDays > 3) {
            fs.rmSync(authDir, { recursive: true, force: true });
            console.log('[Maintenance] Removed old session (>3 days)');
            return true;
          }
        }
        return false;
      } catch (error) {
        console.error('[Maintenance] Session clean error:', error.message);
        return false;
      }
    };

    return cleanOldSessions();
  }
};