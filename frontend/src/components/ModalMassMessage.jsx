import React, { useEffect, useState } from 'react';
import {
  Box, Button, CircularProgress, IconButton,
  LinearProgress, Modal, TextField, Typography
} from '@mui/material';
import { UploadFile, Cancel, Send } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import io from 'socket.io-client';
import { useNotifier } from '../context/Notifier'; // NOVO: Importar o useNotifier

const socket = io('http://localhost:5005');

function ModalMassMessage({ open, onClose }) {
  const [contacts, setContacts] = useState([]);
  const [message, setMessage] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progresso, setProgresso] = useState(0); // Mantido, parece ser para o progresso do envio
  const [ultimoEnviado, setUltimoEnviado] = useState(''); // Mantido

  const notify = useNotifier(); // NOVO: Obter a função notify

  useEffect(() => {
    // Listener para progresso do envio em massa do backend
    const handleMassProgress = ({ progresso: progressoAtual, total, enviado, sucesso, falha, erro }) => {
      // Calcula a porcentagem
      const percentual = total > 0 ? Math.round((progressoAtual / total) * 100) : 0;
      setProgresso(percentual);
      if (enviado) {
        setUltimoEnviado(sucesso ? `Sucesso: ${enviado}` : `Falha: ${enviado} (Falha: ${erro || 'Erro desconhecido'})`);
      }
      // Poderia adicionar um notify aqui para cada sucesso/falha individual se desejado,
      // mas pode ser muito verboso. Um resumo no final é melhor.
    };

    socket.on('massProgress', handleMassProgress); // Usa a função nomeada

    // Listener para quando o envio em massa é finalizado pelo backend
    const handleMassComplete = (data) => {
      setLoading(false);
      setProgresso(100); // Garante que a barra chegue a 100%

      if (data.sucessoGeral) { // Assumindo que o backend envie um status geral
        // A mensagem original do alert era: `✅ Envio finalizado!\n\nSucesso: ${data.enviados}\nFalhas: ${data.falhas}`
        // Vamos simplificar para o notify, os detalhes já estão no console.
        notify(`Envio finalizado! (Sucesso: ${data.enviados ?? 0} / Falhas: ${data.falhas ?? 0})`, 'success');
        if (data.detalhes) {
            if (data.detalhes.enviados) console.table(data.detalhes.enviados);
            if (data.detalhes.falhas) console.table(data.detalhes.falhas);
        }
      } else {
        notify(data.message || 'Ocorreu um erro no envio em massa.', 'error');
      }
      // Considerar se o modal deve fechar automaticamente aqui ou se o usuário fecha manualmente.
      // onClose(); // Se quiser fechar o modal após a notificação.
    };

    socket.on('massComplete', handleMassComplete); // Backend precisa emitir este evento

    return () => {
      socket.off('massProgress', handleMassProgress);
      socket.off('massComplete', handleMassComplete);
    };
  }, [notify]); // Adicionado notify às dependências do useEffect se ele for usado dentro dos handlers de socket

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Ler como array de arrays

        if (rows.length === 0) {
          notify('Planilha vazia ou formato incorreto.', 'warning');
          setContacts([]);
          return;
        }
        
        // Tenta encontrar os cabeçalhos "Número" e "Nome" (case-insensitive e sem acentos)
        const headerRow = rows[0].map(h => String(h).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
        const numeroIndex = headerRow.findIndex(h => h.includes('numero') || h.includes('telefone'));
        const nomeIndex = headerRow.findIndex(h => h.includes('nome'));

        if (numeroIndex === -1) {
          notify('Coluna "Número" ou "Telefone" não encontrada na planilha.', 'error');
          setContacts([]);
          return;
        }

        const loadedContacts = rows.slice(1) // Pula a linha do cabeçalho
          .map(row => {
            const numberValue = row[numeroIndex];
            const nameValue = nomeIndex !== -1 ? row[nomeIndex] : '';
            return {
              number: numberValue ? String(numberValue).replace(/\D/g, '') : '',
              name: nameValue ? String(nameValue) : ''
            };
          }).filter(c => c.number); // Filtra apenas os que têm número

        if (loadedContacts.length === 0) {
          notify('Nenhum contato com número válido encontrado na planilha.', 'info');
        } else {
          notify(`${loadedContacts.length} contatos carregados da planilha!`, 'success');
        }
        setContacts(loadedContacts);

      } catch (error) {
        console.error("Erro ao processar planilha:", error);
        notify('Erro ao processar a planilha. Verifique o formato.', 'error');
        setContacts([]);
      }
    };
    reader.onerror = () => {
        notify('Erro ao ler o arquivo da planilha.', 'error');
        setContacts([]);
    }
    reader.readAsArrayBuffer(file);
    e.target.value = null; // Limpa o input para permitir o mesmo arquivo novamente
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
        // Validação opcional de tamanho/tipo aqui
        setImage(file);
        notify(`Imagem "${file.name}" selecionada.`, 'info');
    }
    e.target.value = null; // Limpa o input
  };

  const handleSend = async () => {
    if (!message.trim() && !image) { // Verifica se há mensagem OU imagem
        notify('Por favor, escreva uma mensagem ou selecione uma imagem.', 'warning');
        return;
    }
    if (contacts.length === 0) {
        notify('Por favor, carregue uma planilha com contatos.', 'warning');
        return;
    }

    setLoading(true);
    setProgresso(0);
    setUltimoEnviado('');
    notify('Iniciando envio em massa...', 'info');

    const formData = new FormData();
    formData.append('message', message);
    formData.append('contacts', JSON.stringify(contacts)); 
    // Adiciona outros campos que seu backend espera, como as opções de envio
    // formData.append('velocidade', velocidadeState); // Exemplo
    // formData.append('pausa', pausaState); // Exemplo

    if (image) {
      formData.append('image', image);
    }

    // A chamada fetch para /api/send-mass agora só inicia o processo no backend.
    // O resultado final e o progresso virão via Socket.IO.
    try {
        const response = await fetch('http://localhost:5005/api/send-mass', { // Certifique-se que a porta está correta
            method: 'POST',
            body: formData,
        });

        const data = await response.json(); // Resposta imediata do backend ao iniciar

        if (!response.ok || !data.success) { // Verifica se o backend conseguiu iniciar o processo
            setLoading(false);
            notify(data.message || 'Falha ao iniciar o processo de envio em massa no servidor.', 'error');
            // Não fechar o modal aqui, pois o usuário pode querer tentar de novo ou ver o erro.
            return;
        }
        // Se chegou aqui, o backend aceitou a tarefa de envio.
        // setLoading(true) já foi setado. A UI agora aguarda os eventos de 'massProgress' e 'massComplete'.
        // A mensagem de "Envio iniciado com sucesso" agora é dada pelo notify acima.
        // O modal não deve fechar aqui, ele fecha quando 'massComplete' chegar ou o usuário cancelar.

    } catch (error) {
        console.error("Erro na requisição para /api/send-mass:", error);
        setLoading(false);
        notify('Erro de conexão ao tentar iniciar o envio em massa.', 'error');
    }
    // Removido: onClose(); // O modal não deve fechar automaticamente ao clicar em enviar
  };

  return (
    <Modal open={open} onClose={() => { if (!loading) onClose(); }}> {/* Permite fechar apenas se não estiver carregando */}
      <Box sx={{
        backgroundColor: 'background.paper', // Usando theme
        p: { xs: 2, sm: 3 }, // Padding responsivo
        width: '90%',
        maxWidth: 600,
        borderRadius: 2, // Consistente com MUI
        boxShadow: 24, // Padrão MUI para modais intensos
        position: 'absolute', // 'absolute' em vez de 'relative' para centralizar com top/left/transform
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        outline: 'none', // Remove o outline padrão do modal
      }}>
        <Typography variant="h6" gutterBottom component="div">📢 Envio em Massa</Typography>

        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Button variant="outlined" component="label" startIcon={<UploadFile />} fullWidth>
            Planilha (.xlsx, .xls)
            <input
              type="file"
              accept=".xls,.xlsx"
              onChange={handleFileUpload}
              hidden
            />
          </Button>

          <Button variant="outlined" component="label" startIcon={<UploadFile />} fullWidth>
            Imagem
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              hidden
            />
          </Button>
        </Box>

        {image && (
          <Box mt={1} mb={2} textAlign="center">
            <Typography variant="caption">📷 Imagem: {image.name}</Typography>
            {/* <img src={URL.createObjectURL(image)} alt="Preview" style={{ maxWidth: '100%', maxHeight: 100, objectFit: 'contain' }} /> */}
          </Box>
        )}

        <TextField
          label="Mensagem"
          multiline
          rows={4}
          fullWidth
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          sx={{ mb: 2 }}
        />

        {contacts.length > 0 && (
          <Box mb={2} sx={{ maxHeight: 100, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
            <Typography variant="subtitle2" gutterBottom>Contatos Carregados: {contacts.length}</Typography>
            {/* Removido o map aqui para não poluir o modal, já tem a contagem */}
            {/* {contacts.map((c, i) => (
              <Typography key={i} variant="caption" display="block">{c.name || 'Sem nome'} - {c.number}</Typography>
            ))} */}
          </Box>
        )}

        {loading && progresso < 100 && ( // Mostra progresso apenas se loading e não 100%
          <Box mt={2} mb={2}>
            <Typography variant="body2" gutterBottom>📤 Enviando... {progresso}%</Typography>
            {ultimoEnviado && <Typography variant="caption" display="block">Status: {ultimoEnviado}</Typography>}
            <LinearProgress variant="determinate" value={progresso} sx={{ mt: 1 }} />
          </Box>
        )}
        {progresso === 100 && !loading && ( // Mensagem de conclusão
             <Typography variant="body2" color="green" sx={{ mt: 2, mb: 2 }}>🎉 Envio concluído!</Typography>
        )}


        <Box mt={3} display="flex" justifyContent="space-between">
          <Button
            variant="contained"
            color="primary"
            onClick={handleSend}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Send />}
          >
            {loading ? 'Enviando...' : `Enviar para ${contacts.length} contatos`}
          </Button>

          <Button
            variant="outlined"
            color="secondary"
            onClick={() => { if (!loading) onClose(); }} // Permite fechar apenas se não estiver carregando
            disabled={loading} // Desabilita cancelar durante o envio
            startIcon={<Cancel />}
          >
            {loading ? 'Aguarde' : 'Cancelar'}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

export default ModalMassMessage;