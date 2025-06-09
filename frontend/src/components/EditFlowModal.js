import React, { useState, useEffect } from 'react';
import Modal from '@mui/material/Modal';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { updateFlow } from '../services/api';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: '12px'
};

function EditFlowModal({ open, onClose, flow, onFlowUpdated }) {
  const [trigger, setTrigger] = useState('');
  const [response, setResponse] = useState('');
  const [matchType, setMatchType] = useState('equals');
  const [newImage, setNewImage] = useState(null);
  const [flowState, setFlow] = useState(flow);

  useEffect(() => {
    if (flow) {
      setTrigger(flow.trigger);
      setResponse(Array.isArray(flow.response) ? flow.response.join(' || ') : flow.response);
      setMatchType(flow.matchType || 'equals');
      setFlow(flow);
      setNewImage(null);
    }
  }, [flow]);

  const handleSave = async () => {
    let imageUrl = flow.imageUrl;

    if (newImage) {
      const formData = new FormData();
      formData.append('image', newImage);

      try {
        const uploadResponse = await fetch('http://localhost:5001/api/upload-image', {
          method: 'POST',
          body: formData
        });

        const result = await uploadResponse.json();
        imageUrl = result.imageUrl;
      } catch (error) {
        alert('Erro ao enviar imagem');
        return;
      }
    }

    const updatedFlow = {
      ...flow,
      trigger,
      response: response.includes('||') ? response.split('||').map(r => r.trim()) : [response.trim()],
      imageUrl: imageUrl || '',
      matchType
    };

    try {
      await updateFlow(updatedFlow);
      onFlowUpdated(updatedFlow);
      onClose();
    } catch (err) {
      console.error('Erro ao atualizar fluxo:', err);
      alert('Erro ao atualizar fluxo. Veja o console.');
    }
  };

  if (!flow) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={modalStyle}>
        <Typography variant="h6" gutterBottom>Editar Fluxo</Typography>

        <TextField
          fullWidth
          margin="normal"
          label="Gatilho"
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
        />

        <TextField
          fullWidth
          margin="normal"
          multiline
          rows={4}
          label="Resposta (use || para múltiplas)"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
        />

        <div style={{ marginTop: '10px' }}>
          <label style={{ fontWeight: '500', display: 'block', marginBottom: '5px' }}>
            🎯 Tipo de correspondência do gatilho:
          </label>
          <select
            value={matchType}
            onChange={(e) => setMatchType(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '5px', width: '100%' }}
          >
            <option value="equals">Exatamente igual (recomendado)</option>
            <option value="includes">Contém (menos preciso)</option>
          </select>
        </div>

        {flow.imageUrl && (
          <div style={{ marginTop: '10px' }}>
            <strong>Imagem atual:</strong><br />
            <img
              src={`http://localhost:5001${flow.imageUrl}`}
              alt="Imagem do fluxo"
              style={{ maxWidth: '100%', maxHeight: '80px', marginTop: '5px' }}
            />
            <br />
            <Button
              variant="outlined"
              color="error"
              size="small"
              style={{ marginTop: '5px' }}
              onClick={() => setFlow((prev) => ({ ...prev, imageUrl: '' }))}
            >
              Remover Imagem
            </Button>
          </div>
        )}

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setNewImage(e.target.files[0])}
          style={{ marginTop: '10px' }}
        />

        <Box mt={3} display="flex" justifyContent="space-between">
          <Button variant="outlined" onClick={onClose}>Cancelar</Button>
          <Button variant="contained" color="primary" onClick={handleSave}>
            Salvar Alterações
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

export default EditFlowModal;
