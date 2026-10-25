const express = require('express');
const fs = require('fs');
const { getDataFilePath } = require('../utils/paths');

const router = express.Router();
const fluxoPath = getDataFilePath('fluxos.json');

// 📖 GET: Ler os fluxos
router.get('/', (req, res) => {
  try {
    const data = fs.readFileSync(fluxoPath, 'utf-8');
    const fluxos = JSON.parse(data);
    res.json(fluxos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao ler os fluxos.' });
  }
});

// 💾 POST: Salvar os fluxos
router.post('/', (req, res) => {
  try {
    const novosFluxos = req.body;
    fs.writeFileSync(fluxoPath, JSON.stringify(novosFluxos, null, 2), 'utf-8');
    res.json({ mensagem: 'Fluxos atualizados com sucesso!' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao salvar os fluxos.' });
  }
});

module.exports = router;
