// backend/routes/apiRoutes.js (CÓDIGO COMPLETO E MODIFICADO)
const express = require('express');
const { atualizarContextoIA } = require('../services/geminiService');

module.exports = function (app, io, client, handlers) {
  // 📍 INÍCIO DA MODIFICAÇÃO 1: Adicionar iaAtivaRef
  const {
    loadFlows, saveFlows,
    loadGreetings, saveGreetings,
    loadConfig, saveConfig,
    loadConfigIA, saveConfigIA,
    upload,
    respostasAtivasRef, saudacaoAtivaRef, tempoExpiracaoMsRef, iaAtivaRef, limparHistoricoSaudacao
    // ⚠️ Atenção: `iaAtivaRef` será criado no seu arquivo de servidor principal.
  } = handlers;
  // 🏁 FIM DA MODIFICAÇÃO 1

  app.get('/api/status', (req, res) => {
    res.json({ success: true, message: 'Servidor está ativo' });
  });

  // ... (todas as suas outras rotas existentes, como /api/fluxos, continuam aqui sem alteração) ...

  app.get('/api/fluxos', (req, res) => {
    try {
      res.json({ success: true, flows: loadFlows() });
    } catch (error) {
      console.error('[API] Erro em /api/fluxos:', error);
      res.status(500).json({ success: false, message: 'Erro ao carregar fluxos.' });
    }
  });

  app.post('/api/respostas-ativas', (req, res) => {
    try {
        const novoEstado = !!req.body.ativo;
        respostasAtivasRef.value = novoEstado;
        const config = loadConfig();
        config.respostasAtivas = novoEstado;
        saveConfig(config);
        console.log(`[API] 💾 Respostas automáticas salvas como: ${novoEstado ? 'ATIVADAS' : 'DESATIVADAS'}`);
        res.json({ success: true, ativo: novoEstado });
    } catch (error) {
        console.error('[API] Erro em /api/respostas-ativas:', error);
        res.status(500).json({ success: false, message: 'Erro ao processar a solicitação.' });
    }
  });

  app.post('/api/saudacao-ativa', (req, res) => {
    try {
      const novoValor = !!req.body.ativo;
      saudacaoAtivaRef.value = novoValor;
      const config = loadConfig();
      config.saudacaoAtiva = novoValor;
      saveConfig(config);
      console.log(`[API] 🔁 Saudação automática ${novoValor ? 'ativada' : 'desativada'}`);
      res.json({ success: true, ativo: novoValor });
    } catch (error) {
      console.error('[API] Erro em /api/saudacao-ativa:', error);
      res.status(500).json({ success: false, message: 'Erro ao processar a solicitação.' });
    }
  });

  // ✅ INÍCIO DA MODIFICAÇÃO 2: Adicionando a nova rota para o status da IA
  app.post('/api/ia-status', (req, res) => {
    try {
      // 1. Pega o novo estado do corpo da requisição
      const novoEstado = !!req.body.ativo;

      // 2. Atualiza a referência em memória para efeito imediato
      iaAtivaRef.value = novoEstado;

      // 3. Carrega a configuração atual
      const config = loadConfig();

      // 4. Modifica a configuração com o novo estado
      config.iaAtiva = novoEstado;

      // 5. Salva a configuração no disco
      saveConfig(config);

      console.log(`[API] 🤖 Fluxos da IA salvos como: ${novoEstado ? 'ATIVADOS' : 'DESATIVADOS'}`);
      res.json({ success: true, ativo: novoEstado });

    } catch (error) {
      console.error('[API] Erro em /api/ia-status:', error);
      res.status(500).json({ success: false, message: 'Erro ao processar a solicitação.' });
    }
  });
  // 🏁 FIM DA MODIFICAÇÃO 2


  // ... (o restante do seu arquivo /api/adicionar-fluxo, /api/limpar-historico-saudacao, etc. continua aqui sem alteração) ...
  app.post('/api/adicionar-fluxo', (req, res) => {
    try {
      const novoFluxo = req.body.fluxo;
      if (!novoFluxo || !novoFluxo.trigger || !novoFluxo.response) {
        return res.status(400).json({ success: false, message: 'Dados inválidos.' });
      }
      novoFluxo.id = Date.now().toString();
      novoFluxo.matchType = ['equals', 'includes'].includes(novoFluxo.matchType) ? novoFluxo.matchType : 'equals';
      const flows = loadFlows();
      flows.push(novoFluxo);
      saveFlows(flows);
      io.emit('loadedFlows', flows);
      res.status(201).json({ success: true, message: 'Novo fluxo adicionado com sucesso!', flows });
    } catch (error) {
      console.error('[API] Erro em /api/adicionar-fluxo:', error);
      res.status(500).json({ success: false, message: 'Erro interno ao adicionar fluxo.' });
    }
  });

  app.post('/api/limpar-historico-saudacao', (req, res) => {
      try {
          const sucesso = limparHistoricoSaudacao();
          if (sucesso) {
              res.json({ success: true, message: 'Histórico de saudações limpo com sucesso.' });
          } else {
              throw new Error('Falha ao escrever no arquivo de histórico.');
          }
      } catch (error) {
          console.error('[API] Erro em /api/limpar-historico-saudacao:', error);
          res.status(500).json({ success: false, message: 'Erro interno ao limpar histórico.' });
      }
    });

  app.put('/api/fluxos/:id', (req, res) => {
    try {
      const fluxoId = req.params.id;
      const fluxoAtualizado = req.body;
      if (!fluxoAtualizado || !fluxoAtualizado.trigger || !fluxoAtualizado.response) {
        return res.status(400).json({ success: false, message: 'Dados inválidos.' });
      }
      const flows = loadFlows();
      const index = flows.findIndex(f => f.id === fluxoId);
      if (index === -1) return res.status(404).json({ success: false, message: 'Fluxo não encontrado.' });
      flows[index] = { ...flows[index], ...fluxoAtualizado };
      saveFlows(flows);
      io.emit('loadedFlows', flows);
      res.json({ success: true, message: 'Fluxo atualizado com sucesso!', flows });
    } catch (error) {
      console.error(`[API] Erro em PUT /api/fluxos/${req.params.id}:`, error);
      res.status(500).json({ success: false, message: 'Erro interno ao atualizar fluxo.' });
    }
  });

  app.delete('/api/fluxos/:id', (req, res) => {
    try {
      const fluxoId = req.params.id;
      const flows = loadFlows();
      const novaLista = flows.filter(f => f.id !== fluxoId);
      if (novaLista.length === flows.length) return res.status(404).json({ success: false, message: 'Fluxo não encontrado.' });
      saveFlows(novaLista);
      io.emit('loadedFlows', novaLista);
      res.json({ success: true, message: 'Fluxo excluído com sucesso!', flows: novaLista });
    } catch (error) {
      console.error(`[API] Erro em DELETE /api/fluxos/${req.params.id}:`, error);
      res.status(500).json({ success: false, message: 'Erro interno ao excluir fluxo.' });
    }
  });

  app.get('/api/greetings', (req, res) => {
    try {
      const greetingsData = loadGreetings();
      res.json(greetingsData);
    } catch (error) {
      console.error('[API] Erro em /api/greetings:', error);
      res.status(500).json({ error: 'Erro interno ao carregar saudações' });
    }
  });

  app.post('/api/greetings', (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'Mensagem inválida.' });
      const greetings = loadGreetings();
      const newGreeting = { id: Date.now().toString(), message };
      greetings.push(newGreeting);
      saveGreetings(greetings);
      res.status(201).json(newGreeting);
    } catch (error) {
      console.error('[API] Erro em POST /api/greetings:', error);
      res.status(500).json({ error: 'Erro interno ao adicionar saudação' });
    }
  });

  app.delete('/api/greetings/:id', (req, res) => {
    try {
      const greetings = loadGreetings();
      const updated = greetings.filter(g => g.id !== req.params.id);
      if (updated.length === greetings.length) return res.status(404).json({ error: 'Saudação não encontrada.' });
      saveGreetings(updated);
      res.json({ success: true });
    } catch (error) {
      console.error(`[API] Erro em DELETE /api/greetings/${req.params.id}:`, error);
      res.status(500).json({ error: 'Erro interno ao excluir saudação.' });
    }
  });

  app.put('/api/greetings/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ success: false, message: 'O conteúdo da mensagem é obrigatório.' });
        }

        const greetings = loadGreetings();
        const index = greetings.findIndex(g => g.id === id);

        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Saudação não encontrada.' });
        }

        greetings[index].message = message;
        saveGreetings(greetings);

        res.json({ success: true, greeting: greetings[index] });
    } catch (error) {
        console.error(`[API] Erro em PUT /api/greetings/${req.params.id}:`, error);
        res.status(500).json({ success: false, message: 'Erro interno ao atualizar saudação.' });
    }
  });

  app.post('/api/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Nenhuma imagem enviada.' });
    const filePath = `/uploads/${req.file.filename}`;
    res.json({ imageUrl: filePath });
  });

  app.get('/api/data', (req, res) => {
    try {
      const config = loadConfig();
      // ✅ INÍCIO DA MODIFICAÇÃO 3: Adicionar iaAtiva na resposta da API de dados
      const dataResponse = {
        message: 'Servidor ativo.',
        timestamp: Date.now(),
        tempoExpiracaoMinutos: config.tempoExpiracaoMinutos,
        saudacaoAtiva: saudacaoAtivaRef.value,
        respostasAtivas: respostasAtivasRef.value,
        iaAtiva: iaAtivaRef.value // Adicionado aqui
      };
      // 🏁 FIM DA MODIFICAÇÃO 3
      res.json(dataResponse);
    } catch (error) {
      console.error(`[API] Erro em /api/data:`, error);
      res.status(500).json({ success: false, message: 'Erro ao carregar dados de configuração.' });
    }
  });

  app.get('/api/contexto-ia', (req, res) => {
    try {
        const contexto = loadConfigIA(); // Usa a função do configService
        res.json({ success: true, contexto });
    } catch (error) {
        console.error('[API] Erro em /api/contexto-ia (GET):', error);
        res.status(500).json({ success: false, message: 'Erro ao carregar contexto da IA.' });
    }
  });

  app.post('/api/contexto-ia', (req, res) => {
    try {
        const novoContexto = req.body.contexto;
        if (!novoContexto) {
            return res.status(400).json({ success: false, message: 'Dados de contexto inválidos.' });
        }
        saveConfigIA(novoContexto);
        atualizarContextoIA();
        res.json({ success: true, message: 'Contexto da IA atualizado com sucesso!' });
    } catch (error) {
        console.error('[API] Erro em /api/contexto-ia (POST):', error);
        res.status(500).json({ success: false, message: 'Erro ao salvar o contexto da IA.' });
    }
  });

  app.post('/api/tempo-expiracao', (req, res) => {
    try {
      const { minutos } = req.body;
      const minutosNum = parseInt(minutos, 10);

      if (isNaN(minutosNum) || minutosNum < 1) {
        return res.status(400).json({ success: false, message: 'Tempo inválido. Forneça um número maior que 0.' });
      }

      tempoExpiracaoMsRef.value = minutosNum * 60 * 1000;
      const config = loadConfig();
      config.tempoExpiracaoMinutos = minutosNum;
      saveConfig(config);

      console.log(`[API] ⏳ Tempo de expiração atualizado para ${minutosNum} minutos.`);
      res.json({ success: true, tempoExpiracaoMs: tempoExpiracaoMsRef.value });
    } catch (error) {
      console.error(`[API] ❌ Erro em /api/tempo-expiracao:`, error);
      res.status(500).json({ success: false, message: `Erro ao atualizar tempo: ${error.message}` });
    }
  });

};