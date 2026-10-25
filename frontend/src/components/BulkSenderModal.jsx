import React, { useEffect, useState, useRef } from 'react';
import { Rocket, FileSpreadsheet, Layout, Sliders } from 'lucide-react';
import {
  Modal, Box, Typography, TextField, Checkbox, FormControlLabel,
  Button, IconButton, Tooltip, LinearProgress, Paper
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark, faFileExcel, faPlus, faPaperPlane, faPause,
  faPlay, faStop, faSpinner, faImage, faClock,
  faCircleCheck, faCircleXmark, faTriangleExclamation
} from '@fortawesome/free-solid-svg-icons';
import * as XLSX from 'xlsx';
import io from 'socket.io-client';
import './BulkSenderModal.css';
import { useNotifier } from '../context/Notifier';
import ConfirmDialog from './ConfirmDialog';
import {
  enviarMensagemEmMassa,
  pausarEnvio,
  retomarEnvio,
  pararEnvio
} from '../services/massSenderAPI';

const socket = io('http://localhost:5005');

function BulkSenderModal({ onClose, confirmCloseModal, setConfirmCloseModal }) {
  const notify = useNotifier();
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const [contacts, setContacts] = useState([]);
  const [message, setMessage] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [progresso, setProgresso] = useState(0);
  const [ultimoEnviado, setUltimoEnviado] = useState('');
  const [velocidade, setVelocidade] = useState(3);
  const [pausaAposEnvios, setPausaAposEnvios] = useState(20);
  const [duracaoPausaSegundos, setDuracaoPausaSegundos] = useState(60);
  const [removerDuplicados, setRemoverDuplicados] = useState(false);
  const [modoAmigavel, setModoAmigavel] = useState(false);
  const [modoEscuro, setModoEscuro] = useState(false);
  const [porcentagem, setPorcentagem] = useState(0);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    socket.on('massProgress', ({ progressoAtual, enviado, total, sucesso, erro, porcentagem }) => {
      setProgresso(progressoAtual);
      setPorcentagem(porcentagem || 0);
      if (enviado) {
        setUltimoEnviado(sucesso ? `Sucesso: ${enviado}` : `Falha: ${enviado} (Falha: ${erro || 'Erro desconhecido'})`);
      }
    });

    const handleMassNotification = ({ message: msg, type }) => {
      if (msg && type) {
        notify(msg, type);
      }
    };
    socket.on('massNotification', handleMassNotification);

    return () => {
      socket.off('massProgress');
      socket.off('massNotification', handleMassNotification);
    };
  }, [notify]);

  const limparSomenteEnvio = () => {
    setContacts([]);
    setProgresso(0);
    setUltimoEnviado('');
  };

  const resetarTudo = async () => {
    if (isSending) {
      try {
        await pararEnvio();
      } catch (err) {
        console.error("Erro ao tentar parar envio durante reset:", err);
        notify('Erro ao tentar parar envio pendente durante o reset.', 'warning');
      }
    }

    setContacts([]);
    setMessage('');
    setImage(null);
    setImagePreview(null);
    setProgresso(0);
    setUltimoEnviado('');
    setVelocidade(3);
    setPausaAposEnvios(20);
    setDuracaoPausaSegundos(60);
    setRemoverDuplicados(false);
    setModoAmigavel(false);
    setModoEscuro(false);
    setIsSending(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);

        const newContacts = json
          .map((row) => {
            const numero = String(
              row.numero || row.número || row['Número com DDD'] ||
              row.telefone || row['Telefone'] || ''
            ).replace(/[^\d]/g, '');
            const nome = row.nome || row.Nome || row['Contato'] || '';
            if (!numero) return null;
            return { numero, nome: nome.trim() };
          })
          .filter(Boolean);

        const todos = removerDuplicados
          ? Array.from(new Map(newContacts.map(c => [c.numero, c])).values())
          : newContacts;

        setContacts(todos);
        if (todos.length > 0) {
          notify(`${todos.length} contatos carregados da planilha.`, 'success');
        } else {
          notify('Nenhum contato válido encontrado na planilha.', 'info');
        }
      } catch (error) {
        console.error("Erro ao processar planilha:", error);
        notify('Erro ao processar a planilha. Verifique o formato.', 'error');
      }
    };
    reader.onerror = () => {
      notify('Erro ao ler o arquivo da planilha.', 'error');
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      notify('Por favor, selecione um arquivo de imagem.', 'warning');
      e.target.value = null;
      return;
    }
    setImage(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
    notify(`Imagem "${file.name}" selecionada.`, 'info');
    e.target.value = null;
  };

  const handleEnviar = async () => {
    if (contacts.length === 0) {
      notify('Adicione contatos da planilha antes de enviar.', 'warning');
      return;
    }
    if (!message.trim() && !image) {
      notify('Escreva uma mensagem ou selecione uma imagem para enviar.', 'warning');
      return;
    }
    if (pausaAposEnvios > 0 && duracaoPausaSegundos <= 0) {
      notify('Se "Pausa a cada" for maior que 0, a "Duração da Pausa" também deve ser maior que 0.', 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('contacts', JSON.stringify(contacts));
    formData.append('message', message);
    formData.append('velocidade', velocidade);
    formData.append('pausaCada', pausaAposEnvios);
    formData.append('duracaoPausaSegundos', duracaoPausaSegundos);
    formData.append('modoAmigavel', modoAmigavel);
    formData.append('modoEscuro', modoEscuro);
    formData.append('removerDuplicados', removerDuplicados);
    if (image) formData.append('image', image);

    setIsSending(true);
    notify('Disparando envio em massa...', 'info');

    try {
      const res = await enviarMensagemEmMassa(formData);
      if (res && res.success) {
        notify(res.message || 'Envio iniciado com sucesso!', 'success');
      } else {
        notify(res.message || 'Falha ao iniciar o envio no servidor.', 'warning');
        setIsSending(false);
      }
    } catch (err) {
      console.error("Erro em handleEnviar:", err);
      notify(err.message || 'Erro crítico ao tentar iniciar o envio.', 'error');
      setIsSending(false);
    }
  };

  const handlePausar = async () => {
    try {
      const res = await pausarEnvio();
      if (res && res.success !== undefined) {
        notify(res.message || 'Solicitação de pausa enviada.', res.success ? 'info' : 'warning');
      }
    } catch (err) {
      console.error(err);
      notify('Erro ao solicitar pausa.', 'error');
    }
  };

  const handleRetomar = async () => {
    try {
      const res = await retomarEnvio();
      if (res && res.success !== undefined) {
        notify(res.message || 'Solicitação para retomar envio enviada.', res.success ? 'info' : 'warning');
      }
    } catch (err) {
      console.error(err);
      notify('Erro ao solicitar retomada.', 'error');
    }
  };

  const handleParar = async () => {
    try {
      const res = await pararEnvio();
      if (res && res.success !== undefined) {
        notify(res.message || 'Envio em massa interrompido.', res.success ? 'info' : 'warning');
      }
      limparSomenteEnvio();
      setIsSending(false);
    } catch (err) {
      console.error(err);
      notify('Erro ao parar envio.', 'error');
    }
  };

  const handleCloseRequest = () => {
    const hasDataOrIsSending = contacts.length > 0 || message.trim() !== '' || image || isSending;
    if (hasDataOrIsSending) {
      setConfirmCloseModal(true);
    } else {
      resetarTudo();
      onClose();
    }
  };

  const handleCloseModal = (event, reason) => {
    if (reason === 'backdropClick') return;
    handleCloseRequest();
  };

  return (
    <Modal
      open={true}
      onClose={handleCloseModal}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }
        }
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '95%',
          maxWidth: '1100px',
          maxHeight: '90vh',
          background: 'var(--glass-bg)',
          backdropFilter: 'var(--glass-blur)',
          border: '1px solid var(--glass-border)',
          borderRadius: '18px',
          boxShadow: 'var(--shadow-lg)',
          p: '24px',
          outline: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          overflowY: 'auto',
        }}
      >
        {/* Cabeçalho */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: '14px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Box>
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Rocket size={18} style={{ color: 'var(--accent-primary)' }} /> Envio de Mensagens em Massa
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', mt: '4px' }}>
              Configure a lista de contatos, a mensagem e os intervalos de envio.
            </Typography>
          </Box>
          <IconButton
            onClick={handleCloseRequest}
            sx={{
              color: 'var(--text-muted)',
              width: 32,
              height: 32,
              borderRadius: '8px',
              '&:hover': { backgroundColor: 'var(--bg-hover)', color: 'var(--text-primary)' }
            }}
          >
            <FontAwesomeIcon icon={faXmark} style={{ fontSize: '16px' }} />
          </IconButton>
        </Box>

        {/* Colunas do Modal */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.1fr 1.3fr 1fr' },
            gap: '24px',
            width: '100%',
          }}
        >
          {/* COLUNA 1: Contatos */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileSpreadsheet size={13} style={{ color: 'var(--accent-primary)' }} /> Planilha de Contatos
            </Typography>

            <input
              type="file"
              accept=".xls,.xlsx,.csv"
              ref={fileInputRef}
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />

            <Button
              variant="outlined"
              onClick={() => fileInputRef.current?.click()}
              startIcon={<FontAwesomeIcon icon={faFileExcel} />}
              fullWidth
              sx={{
                color: 'var(--text-secondary)',
                borderColor: 'var(--border-default)',
                height: '40px',
                '&:hover': { borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-hover)' }
              }}
            >
              Upload Planilha
            </Button>

            <TextField
              fullWidth
              multiline
              rows={8}
              InputProps={{ readOnly: true }}
              value={
                contacts.length > 0
                  ? contacts.map(c => `${c.numero}${c.nome ? ' - ' + c.nome : ''}`).join('\n')
                  : ''
              }
              placeholder="Contatos carregados aparecerão aqui..."
            />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px', mt: '4px' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={removerDuplicados}
                    onChange={e => setRemoverDuplicados(e.target.checked)}
                    size="small"
                  />
                }
                label={<Typography sx={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Remover contatos duplicados</Typography>}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={modoAmigavel}
                    onChange={e => setModoAmigavel(e.target.checked)}
                    size="small"
                  />
                }
                label={<Typography sx={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Modo amigável (Olá [Nome])</Typography>}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={modoEscuro}
                    onChange={e => setModoEscuro(e.target.checked)}
                    size="small"
                  />
                }
                label={<Typography sx={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ignorar validação estrita</Typography>}
              />
            </Box>
          </Box>

          {/* COLUNA 2: Mensagem & Controles */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layout size={13} style={{ color: 'var(--accent-primary)' }} /> Conteúdo & Progresso
            </Typography>

            <TextField
              fullWidth
              multiline
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escreva a mensagem que deseja disparar em massa..."
              label="Mensagem"
            />

            {/* Barra de Progresso Customizada e Integrada */}
            <Box sx={{ mt: '4px' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: '6px' }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Progresso do Envio
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: isSending ? 'var(--accent-success)' : 'var(--text-muted)' }}>
                  {progresso} / {contacts.length} ({porcentagem}%)
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={porcentagem}
                sx={{
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: isSending ? 'var(--accent-success)' : 'var(--accent-primary)',
                    borderRadius: 999,
                  }
                }}
              />
              {ultimoEnviado && (
                <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', mt: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Último: {ultimoEnviado}
                </Typography>
              )}
            </Box>

            {/* Ações de Disparo */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', mt: '4px' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleEnviar}
                disabled={isSending || contacts.length === 0}
                startIcon={isSending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
                fullWidth
              >
                {isSending ? 'Enviando' : 'Enviar'}
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={handleParar}
                disabled={!isSending}
                startIcon={<FontAwesomeIcon icon={faStop} />}
                fullWidth
              >
                Parar
              </Button>
              <Button
                variant="outlined"
                color="warning"
                onClick={handlePausar}
                disabled={!isSending}
                startIcon={<FontAwesomeIcon icon={faPause} />}
                fullWidth
              >
                Pausar
              </Button>
              <Button
                variant="outlined"
                color="primary"
                onClick={handleRetomar}
                disabled={!isSending}
                startIcon={<FontAwesomeIcon icon={faPlay} />}
                fullWidth
              >
                Retomar
              </Button>
            </Box>
          </Box>

          {/* COLUNA 3: Configurações & Imagem */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sliders size={13} style={{ color: 'var(--accent-primary)' }} /> Opções & Mídia
            </Typography>

            <TextField
              fullWidth
              label="Intervalo entre Mensagens (segundos)"
              type="number"
              value={velocidade}
              onChange={(e) => setVelocidade(Math.max(1, parseInt(e.target.value) || 1))}
              InputProps={{ inputProps: { min: 1 } }}
              size="small"
            />

            <Box sx={{ display: 'flex', gap: '8px' }}>
              <TextField
                label="Pausa a cada (envios)"
                type="number"
                value={pausaAposEnvios}
                onChange={(e) => setPausaAposEnvios(Math.max(0, parseInt(e.target.value) || 0))}
                InputProps={{ inputProps: { min: 0 } }}
                size="small"
                sx={{ flex: 1 }}
              />
              <TextField
                label="Duração da Pausa (s)"
                type="number"
                value={duracaoPausaSegundos}
                onChange={(e) => setDuracaoPausaSegundos(Math.max(0, parseInt(e.target.value) || 0))}
                InputProps={{ inputProps: { min: 0 } }}
                size="small"
                disabled={pausaAposEnvios <= 0}
                sx={{ flex: 1 }}
              />
            </Box>

            <input
              type="file"
              accept="image/*"
              ref={imageInputRef}
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />

            <Button
              variant="outlined"
              onClick={() => imageInputRef.current?.click()}
              startIcon={<FontAwesomeIcon icon={faImage} />}
              fullWidth
              sx={{
                color: 'var(--text-secondary)',
                borderColor: 'var(--border-default)',
                height: '40px',
                '&:hover': { borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-hover)' }
              }}
            >
              Anexar Imagem
            </Button>

            <Paper
              variant="outlined"
              sx={{
                border: '1.5px dashed rgba(255,255,255,0.12)',
                borderRadius: '12px',
                height: '142px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.02)',
                overflow: 'hidden',
                p: '8px',
                boxSizing: 'border-box',
              }}
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="preview"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }}
                />
              ) : (
                <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                  Nenhuma imagem selecionada
                </Typography>
              )}
            </Paper>
          </Box>
        </Box>

        {/* Rodapé do Modal */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', mt: '8px', pt: '16px', borderTop: '1px solid var(--border-subtle)' }}>
          <Button
            variant="outlined"
            onClick={handleCloseRequest}
            sx={{
              color: 'var(--text-secondary)',
              borderColor: 'var(--border-default)',
              '&:hover': { borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-hover)' }
            }}
          >
            Fechar Janela
          </Button>
        </Box>

        <ConfirmDialog
          open={confirmCloseModal}
          onClose={() => setConfirmCloseModal(false)}
          onConfirm={() => {
            handleParar();
            resetarTudo();
            onClose();
            setConfirmCloseModal(false);
          }}
          title="Confirmar Fechamento"
          message="Você tem um envio em andamento ou dados não salvos. Tem certeza que deseja fechar? O progresso será perdido."
          confirmText="Sim, fechar"
          cancelText="Cancelar"
        />
      </Box>
    </Modal>
  );
}

export default BulkSenderModal;