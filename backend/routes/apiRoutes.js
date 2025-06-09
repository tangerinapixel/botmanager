// backend/routes/apiRoutes.js
const express = require('express');
const path = require('path');

module.exports = function (app, io, client, handlers) {
  const {
    loadFlows, saveFlows,
    loadGreetings, saveGreetings,
    loadConfig, saveConfig,
    upload,
    respostasAtivasRef, saudacaoAtivaRef, tempoExpiracaoMsRef
  } = handlers;

  app.get('/api/status', (req, res) => {
    res.json({ success: true, message: 'Servidor está ativo' });
  });

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
      respostasAtivasRef.value = !!req.body.ativo;
      console.log(`[API] 🔁 Respostas automáticas ${respostasAtivasRef.value ? 'ativadas' : 'desativadas'}`);
      res.json({ success: true, ativo: respostasAtivasRef.value });
    } catch (error) {
      console.error('[API] Erro em /api/respostas-ativas:', error);
      res.status(500).json({ success: false, message: 'Erro ao processar a solicitação.' });
    }
  });

  app.post('/api/saudacao-ativa', (req, res) => {
    try {
      saudacaoAtivaRef.value = !!req.body.ativo;
      console.log(`[API] 🔁 Saudação automática ${saudacaoAtivaRef.value ? 'ativada' : 'desativada'}`);
      res.json({ success: true, ativo: saudacaoAtivaRef.value });
    } catch (error) {
      console.error('[API] Erro em /api/saudacao-ativa:', error);
      res.status(500).json({ success: false, message: 'Erro ao processar a solicitação.' });
    }
  });

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

  app.post('/api/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Nenhuma imagem enviada.' });
    const filePath = `/uploads/${req.file.filename}`;
    res.json({ imageUrl: filePath });
  });

  app.get('/api/data', (req, res) => {
    try {
      const config = loadConfig();
      const dataResponse = {
        message: 'Servidor ativo.',
        timestamp: Date.now(),
        tempoExpiracaoMinutos: config.tempoExpiracaoMinutos,
        saudacaoAtiva: saudacaoAtivaRef.value
      };
      res.json(dataResponse);
    } catch (error) {
      console.error(`[API] Erro em /api/data:`, error);
      res.status(500).json({ success: false, message: 'Erro ao carregar dados de configuração.' });
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

  // A rota para servir o frontend permanece no final
  const frontendPath = path.join(__dirname, '../../frontend/build');
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
};