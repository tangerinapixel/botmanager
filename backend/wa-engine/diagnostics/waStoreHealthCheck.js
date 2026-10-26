// backend/wa-engine/diagnostics/waStoreHealthCheck.js
// Diagnóstico Não-Bloqueante de Saúde dos Contratos Meta Comet / window.require.
// Executa sondas sem efeitos colaterais para detectar quebras de API ou atualizações do WhatsApp Web.

const contractCatalog = require('./contractCatalog');
const { ts } = require('../../utils/logger');

class WAStoreHealthCheck {
  /**
   * Executa a auditoria completa no cliente WhatsApp Web de forma 100% não-bloqueante e segura.
   * @param {Object} client Instância do whatsapp-web.js
   * @returns {Promise<Object>} Relatório de saúde estruturado
   */
  async run(client) {
    const timestamp = new Date().toISOString();

    if (!client || !client.pupPage || (typeof client.pupPage.isClosed === 'function' && client.pupPage.isClosed())) {
      return {
        timestamp,
        status: 'OFFLINE',
        message: 'WhatsApp Web cliente não está ativo ou pupPage fechada',
        wwebVersion: null,
        summary: { total: contractCatalog.length, healthy: 0, degraded: 0, critical: 0 },
        breakingChanges: [],
        contracts: []
      };
    }

    try {
      // Executa sondas no navegador de forma totalmente isolada
      const evalResult = await client.pupPage.evaluate((catalog) => {
        let wwebVersion = null;
        try {
          if (window.Debug && window.Debug.VERSION) {
            wwebVersion = window.Debug.VERSION;
          }
        } catch (_) {}

        const contracts = [];

        for (const item of catalog) {
          const entry = {
            module: item.module,
            domain: item.domain,
            severity: item.severity,
            description: item.description,
            status: 'HEALTHY',
            error: null,
            checks: []
          };

          let mod = null;
          try {
            if (typeof window.require === 'function') {
              mod = window.require(item.module);
            } else {
              entry.status = 'CRITICAL_FAIL';
              entry.error = 'window.require não está disponível no contexto';
            }
          } catch (e) {
            entry.status = item.severity === 'CRITICAL' ? 'CRITICAL_FAIL' : 'DEGRADED';
            entry.error = e.message || 'Módulo ausente no registro da Meta';
          }

          if (!mod && entry.status === 'HEALTHY') {
            entry.status = item.severity === 'CRITICAL' ? 'CRITICAL_FAIL' : 'DEGRADED';
            entry.error = 'Retorno nulo/indefinido ao carregar módulo';
          }

          if (mod) {
            for (const chk of item.checks) {
              const chkResult = {
                property: chk.property,
                expectedType: chk.type,
                actualType: 'undefined',
                ok: false
              };

              let val = undefined;
              try {
                if (chk.path) {
                  const parts = chk.path.split('.');
                  val = mod;
                  for (const p of parts) {
                    if (val != null) {
                      val = val[p];
                    } else {
                      val = undefined;
                      break;
                    }
                  }
                } else {
                  val = mod[chk.property];
                }
              } catch (errProp) {
                val = undefined;
              }

              const actualType = typeof val;
              chkResult.actualType = actualType;

              // No JS, arrays e null são 'object', mas se esperamos 'object' e não é null, é ok
              if (actualType === chk.type && val !== null) {
                chkResult.ok = true;
              } else {
                chkResult.ok = false;
                if (entry.status === 'HEALTHY') {
                  entry.status = item.severity === 'CRITICAL' ? 'CRITICAL_FAIL' : 'DEGRADED';
                }
                if (!entry.error) {
                  entry.error = `Propriedade ${chk.property} esperada '${chk.type}', recebido '${actualType}'`;
                }
              }

              entry.checks.push(chkResult);
            }
          }

          contracts.push(entry);
        }

        return {
          wwebVersion,
          contracts
        };
      }, contractCatalog);

      const contracts = (evalResult && evalResult.contracts) || [];
      const wwebVersion = (evalResult && evalResult.wwebVersion) || 'Desconhecida';

      // Consolidação de métricas
      let healthyCount = 0;
      let degradedCount = 0;
      let criticalCount = 0;
      const breakingChanges = [];

      for (const c of contracts) {
        if (c.status === 'HEALTHY') {
          healthyCount++;
        } else if (c.status === 'CRITICAL_FAIL') {
          criticalCount++;
          breakingChanges.push({
            module: c.module,
            domain: c.domain,
            severity: c.severity,
            error: c.error
          });
        } else {
          degradedCount++;
          breakingChanges.push({
            module: c.module,
            domain: c.domain,
            severity: c.severity,
            error: c.error
          });
        }
      }

      let overallStatus = 'HEALTHY';
      if (criticalCount > 0) {
        overallStatus = 'CRITICAL';
      } else if (degradedCount > 0) {
        overallStatus = 'DEGRADED';
      }

      const report = {
        timestamp,
        status: overallStatus,
        wwebVersion,
        summary: {
          total: contracts.length,
          healthy: healthyCount,
          degraded: degradedCount,
          critical: criticalCount
        },
        breakingChanges,
        contracts
      };

      if (overallStatus !== 'HEALTHY') {
        console.warn(`[${ts()}] [WAStoreHealthCheck] Alerta de integridade WhatsApp Web: ${overallStatus} (${criticalCount} críticos, ${degradedCount} degradados)`);
      } else {
        console.log(`[${ts()}] [WAStoreHealthCheck] Todos os ${contracts.length} contratos Meta estão 100% saudáveis (WWeb v${wwebVersion})`);
      }

      return report;
    } catch (err) {
      console.error(`[${ts()}] [WAStoreHealthCheck] Falha defensiva ao inspecionar contratos: ${err.message}`);
      return {
        timestamp,
        status: 'ERROR',
        message: err.message,
        wwebVersion: null,
        summary: { total: contractCatalog.length, healthy: 0, degraded: 0, critical: 0 },
        breakingChanges: [{ module: 'ALL', severity: 'CRITICAL', error: err.message }],
        contracts: []
      };
    }
  }
}

module.exports = new WAStoreHealthCheck();
