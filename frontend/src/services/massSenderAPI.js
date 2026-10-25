// src/services/massSenderAPI.js

const BASE_URL = 'http://localhost:5005/api';

export const enviarMensagemEmMassa = async (formData) => {
  try {
    const response = await fetch(`${BASE_URL}/send-mass`, {
      method: 'POST',
      body: formData,
    });
    return await response.json();
  } catch (error) {
    console.error('Erro ao enviar mensagens:', error);
    return { success: false, message: 'Erro ao conectar com o servidor' };
  }
};

export const pausarEnvio = async () => {
  try {
    const response = await fetch(`${BASE_URL}/pause-mass`, {
      method: 'POST',
    });
    return await response.json();
  } catch (error) {
    console.error('Erro ao pausar envio:', error);
    return { success: false, message: 'Erro ao pausar envio' };
  }
};

export const retomarEnvio = async () => {
  try {
    const response = await fetch(`${BASE_URL}/resume-mass`, {
      method: 'POST',
    });
    return await response.json();
  } catch (error) {
    console.error('Erro ao retomar envio:', error);
    return { success: false, message: 'Erro ao retomar envio' };
  }
};

export const pararEnvio = async () => {
  try {
    const response = await fetch(`${BASE_URL}/stop-mass`, {
      method: 'POST',
    });
    return await response.json();
  } catch (error) {
    console.error('Erro ao parar envio:', error);
    return { success: false, message: 'Erro ao parar envio' };
  }
};
