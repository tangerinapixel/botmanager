import React, { useState } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Button
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import ImageIcon from '@mui/icons-material/Image';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditFlowModal from './EditFlowModal';
import ConfirmDialog from './ConfirmDialog';
import { useNotifier } from '../context/Notifier';

function FlowsGridList({ flows, onDeleteFlow, onUpdateFlow, respostasAtivas, toggleRespostas }) {
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [flowToDelete, setFlowToDelete] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const notify = useNotifier();

  const handleEdit = (flow) => {
    setEditingFlow(flow);
    setModalOpen(true);
  };

  const handleDeleteClick = (flow) => {
    setFlowToDelete(flow);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!flowToDelete) return;

    try {
      const response = await fetch(`/api/fluxos/${flowToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        //const result = await response.json();
        onDeleteFlow(flowToDelete.id);
        notify('✅ Fluxo removido com sucesso!', 'success');
      } else {
        const error = await response.json();
        notify(`❌ Erro ao deletar: ${error.message}`, 'error');
      }
    } catch (err) {
      console.error('Erro ao deletar fluxo:', err);
      notify('❌ Erro inesperado ao deletar o fluxo.', 'error');
    } finally {
      setDialogOpen(false);
      setFlowToDelete(null);
    }
  };

  const handleSave = async (updatedFlow) => {
    try {
      const response = await fetch(`/api/fluxos/${updatedFlow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFlow),
      });

      if (response.ok) {
        const result = await response.json();
       // notify(result.message || '✅ Fluxo atualizado com sucesso!', 'success');
        onUpdateFlow(updatedFlow);
        setEditingFlow(null);
        setModalOpen(false);
      } else {
        const error = await response.json();
        notify(`❌ Erro ao atualizar: ${error.message}`, 'error');
      }
    } catch (err) {
      console.error('Erro ao atualizar fluxo:', err);
      notify('❌ Erro inesperado ao atualizar o fluxo.', 'error');
    }
  };

  const displayedFlows = showAll ? flows : flows.slice(0, 3);

  return (
    <>
      <Typography variant="h6" gutterBottom>Fluxos Criados</Typography>

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, justifyContent: 'space-between' }}>
        <Typography variant="subtitle1">⚙️ Respostas Automáticas</Typography>
        <label className="switch">
          <input type="checkbox" checked={respostasAtivas} onChange={toggleRespostas} />
          <span className="slider round"></span>
        </label>
      </div>

      <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '4px', paddingLeft: '4px', paddingBottom: '12px'}}>
        <Grid container spacing={1}>
          {displayedFlows.map((flow) => (
            <Grid key={flow.id} xs={12}>
              <Paper elevation={0} style={{ padding: 16, position: 'relative', border: '1px solid rgba(204, 204, 204, 0.34)'}}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <ChatIcon style={{ color: 'darkgray', marginRight: 8 }} />
                  <Typography variant="subtitle1" fontWeight="bold">
                    {flow.trigger}
                  </Typography>
                </div>

                <Typography
                  variant="body2"
                  style={{
                    marginBottom: 12,
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxHeight: '4.5em',
                  }}
                >
                  {Array.isArray(flow.response)
                    ? flow.response.join(' | ')
                    : flow.response}
                </Typography>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  {flow.imageUrl && <ImageIcon style={{ color: 'gray' }} />}
                  <button onClick={() => handleEdit(flow)} className="btn-action" title="Editar fluxo">
                    <EditOutlinedIcon style={{ fontSize: 20 }} />
                  </button>
                  <button onClick={() => handleDeleteClick(flow)} className="btn-action" title="Remover fluxo">
                    <DeleteOutlineIcon style={{ fontSize: 20 }} />
                  </button>
                </div>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </div>

      {flows.length > 4 && (
        <div style={{ marginTop: 10, textAlign: 'center' }}>
          <Button variant="text" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Ver menos' : 'Ver mais'}
          </Button>
        </div>
      )}

      <EditFlowModal
        open={isModalOpen}
        onClose={() => setModalOpen(false)}
        flow={editingFlow}
        onSave={handleSave}
        onFlowUpdated={onUpdateFlow}
      />

      <ConfirmDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={confirmDelete}
        title="Confirmar Remoção"
        message="Tem certeza que deseja remover este fluxo?"
      />
    </>
  );
}

export default FlowsGridList;
