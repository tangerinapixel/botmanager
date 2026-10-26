// backend/routes/systemRoutes.js
// Rotas da API de Sistema e Auto-Diagnóstico de Infraestrutura

const express = require('express');
const WAEngine = require('../wa-engine');

module.exports = function(clientManager) {
  const router = express.Router();

  /**
   * GET /api/system/wa-health
   * Retorna o diagnóstico em tempo real dos contratos e módulos Meta Comet do WhatsApp Web.
   */
  router.get('/wa-health', async (req, res) => {
    try {
      const client = clientManager && typeof clientManager.getClient === 'function'
        ? clientManager.getClient()
        : (clientManager && clientManager.client ? clientManager.client : null);

      const report = await WAEngine.runHealthCheck(client);
      res.json(report);
    } catch (err) {
      res.status(500).json({
        timestamp: new Date().toISOString(),
        status: 'ERROR',
        error: err.message,
        contracts: []
      });
    }
  });

  return router;
};
