const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Busca os fluxos salvos
export async function fetchFlows() {
  try {
    const response = await fetch(`${API_URL}/api/fluxos`);
    if (!response.ok) throw new Error("Erro ao buscar fluxos");
    const data = await response.json();
    return data.flows;
  } catch (error) {
    console.error("Erro ao buscar fluxos:", error);
    throw error;
  }
}

// Conecta ao servidor e verifica o status
export async function connectToServer() {
  try {
    const response = await fetch(`${API_URL}/api/status`);
    if (!response.ok) throw new Error("Erro ao conectar ao servidor");
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Erro ao conectar ao servidor:", error);
    throw error;
  }
}

// Adiciona um novo fluxo
export async function addFlow(newFlow) {
  try {
    const response = await fetch(`${API_URL}/api/adicionar-fluxo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fluxo: newFlow }),
    });

    if (!response.ok) throw new Error(`Erro ao adicionar fluxo: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error("Erro ao adicionar fluxo:", error);
    throw error;
  }
}

// Deleta um fluxo
export async function deleteFlow(id) {
  try {
    const response = await fetch(`${API_URL}/api/fluxos/${id}`,
      {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Erro ao deletar fluxo: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Erro ao deletar fluxo:", error);
    throw error;
  }
}

// Atualiza um fluxo existente
export async function updateFlow(updatedFlow) {
  try {
    const response = await fetch(`${API_URL}/api/fluxos/${updatedFlow.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedFlow),
    });

    if (!response.ok) throw new Error(`Erro ao atualizar fluxo: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error("Erro ao atualizar fluxo:", error);
    throw error;
  }
}

export async function addGreeting(newGreeting) {
  try {
    const response = await fetch(`${API_URL}/api/greetings`,{
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newGreeting),
    });

    if (!response.ok) throw new Error("Erro ao adicionar saudação");
    return await response.json();
  } catch (error) {
    console.error("Erro ao adicionar saudação:", error);
    throw error;
  }
}
export const deleteGreetingAPI = async (id) => {
  const response = await fetch(`${API_URL}/api/greetings/${id}`, {
    method: 'DELETE',
  });
  return response.json();
};
export async function uploadImage(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);

  try {
    const response = await fetch(`${API_URL}/api/upload-image`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) throw new Error("Erro ao fazer upload da imagem");
    return await response.json(); // ← Retorna { imageUrl }
  } catch (error) {
    console.error("Erro ao enviar imagem:", error);
    throw error;
  }
}

