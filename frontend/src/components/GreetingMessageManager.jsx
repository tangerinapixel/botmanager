import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Grid, Paper, IconButton } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ChatIcon from '@mui/icons-material/Chat';

function GreetingMessageManager({ greetings, onAddGreeting, onEditGreeting, onDeleteGreeting }) {
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null);

  const handleSave = () => {
    if (editing) {
      onEditGreeting(editing.id, message);
      setEditing(null);
    } else {
      onAddGreeting({ id: Date.now().toString(), message });
    }
    setMessage('');
  };

  const handleEdit = (greeting) => {
    setMessage(greeting.message);
    setEditing(greeting);
  };

  return (
    <Box style={{ padding: '10px' }}>
      <Typography variant="h6">Gerenciar Mensagens de Saudação</Typography>

      <TextField
        label="Nova mensagem de saudação"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        fullWidth
        margin="normal"
        multiline
        minRows={3}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
          }
        }}
      />

      <Button variant="contained" color="primary" onClick={handleSave}>
        {editing ? 'Salvar Alterações' : 'Adicionar'}
      </Button>

      <Grid container spacing={2} style={{ marginTop: '20px' }}>
      {greetings.map((greeting, index) => (
  <Grid xs={12} key={greeting.id}>
    <Paper elevation={0} style={{ padding: 16,  border: '1px solid rgba(204, 204, 204, 0.34)' }}>
      {/* Cabeçalho com ícone e número da mensagem */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <ChatIcon style={{ color: 'darkgray', marginRight: 8 }} />
        <Typography variant="subtitle2" fontWeight="bold">
          Msg {String.fromCharCode(65 + index)} {/* A = 65, B = 66... */}
        </Typography>
      </div>

      {/* Mensagem com limite de linhas */}
      <Typography
        variant="body2"
        style={{
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxHeight: '4.5em',
          marginBottom: 8,
        }}
      >
        {greeting.message}
      </Typography>

      {/* Botões de ação */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>

      <button onClick={() => handleEdit(greeting)} className="btn-action" title="Editar saudação">
  <EditOutlinedIcon style={{ fontSize: 20 }} />
</button>


<button onClick={() => onDeleteGreeting(greeting.id)} className="btn-action" title="Remover saudação">
  <DeleteOutlineIcon style={{ fontSize: 20 }} />
</button>

      </div>
    </Paper>
  </Grid>

        ))}
      </Grid>
    </Box>
  );
}

export default GreetingMessageManager;
