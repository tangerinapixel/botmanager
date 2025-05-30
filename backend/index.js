// backend/index.js
const express = require('express');
const flowRoutes = require('./routes/flowRoutes');
const app = express();

app.use(express.json());
app.use('/api/flows', flowRoutes);
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const PORT = 5000;

const FLUXOS_PATH = path.join(__dirname, 'fluxos.json');

app.use(cors());

// Rota GET: retorna os fluxos atuais
app.get('/api/fluxos', (req, res) => {
  try {
    const data = fs.readFileSync(FLUXOS_PATH, 'utf8');
    const fluxos = JSON.parse(data);
    res.json(fluxos);
  } catch (err) {
    console.error('Erro ao ler fluxos:', err);
    res.status(500).json({ error: 'Erro ao ler os fluxos' });
  }
});

// Rota POST: salva novos fluxos
app.post('/api/fluxos', (req, res) => {
  try {
    const novoFluxo = req.body;
    fs.writeFileSync(FLUXOS_PATH, JSON.stringify(novoFluxo, null, 2), 'utf8');
    res.json({ message: 'Fluxos atualizados com sucesso' });
  } catch (err) {
    console.error('Erro ao salvar fluxos:', err);
    res.status(500).json({ error: 'Erro ao salvar os fluxos' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor backend rodando em http://localhost:${PORT}`);
});
