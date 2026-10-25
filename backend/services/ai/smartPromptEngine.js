// backend/services/ai/smartPromptEngine.js
// Motor inteligente e dinâmico de montagem de contexto, regras e instruções do sistema para a IA.

const fs = require('fs');
const { getDataFilePath } = require('../../utils/paths');

const IA_CONTEXT_PATH = getDataFilePath('ia_context.json');

const defaultContexto = {
  nomeBot: "Jabes",
  nomeEmpresa: "Virtual Teológico",
  tipoNegocio: "uma plataforma de conteúdo digital focada em ensinar a Bíblia segundo a teologia Adventista do Sétimo Dia e escritos de Ellen G. White",
  tomDeVoz: "acolhedor, cristão, empático e prestativo",
  informacoes: {
    horarioAtendimento: "Sexta das 18h às 22h, Domingos das 9h às 22h. Aos Sábados foco em atividades espirituais, com materiais sempre disponíveis online.",
    site: "virtualteologico.com.br",
    contatoHumano: "(44) 92001-7310",
    produtos: [],
    gruposWhatsapp: [],
    principaisTopicos: []
  },
  promptConfig: {
    persona: "Você é o ${nomeBot}, assistente dedicado do ${nomeEmpresa}.",
    baseConhecimentoHeader: "Base de Conhecimento Oficial:",
    regrasGerais: []
  }
};

let cachedContext = null;
let lastContextMtime = 0;

/**
 * Carrega e mantém em cache o arquivo ia_context.json com atualização automática em caso de modificação
 */
function getRawContext() {
  try {
    if (fs.existsSync(IA_CONTEXT_PATH)) {
      const stats = fs.statSync(IA_CONTEXT_PATH);
      if (!cachedContext || stats.mtimeMs > lastContextMtime) {
        const raw = fs.readFileSync(IA_CONTEXT_PATH, 'utf8');
        const loaded = JSON.parse(raw);
        cachedContext = {
          ...defaultContexto,
          ...loaded,
          informacoes: { ...defaultContexto.informacoes, ...(loaded.informacoes || {}) },
          promptConfig: { ...defaultContexto.promptConfig, ...(loaded.promptConfig || {}) }
        };
        lastContextMtime = stats.mtimeMs;
      }
    } else {
      cachedContext = defaultContexto;
    }
  } catch (err) {
    console.error('[SmartPromptEngine] Erro ao carregar ia_context.json:', err.message);
    if (!cachedContext) cachedContext = defaultContexto;
  }
  return cachedContext;
}

/**
 * Força a invalidação do cache do contexto (ex: quando alterado via API)
 */
function invalidateContextCache() {
  cachedContext = null;
  lastContextMtime = 0;
}

/**
 * Retorna dados temporais reais no fuso horário do Brasil
 */
function getTemporalContext() {
  const now = new Date();
  const diasDaSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  
  // Formatador para o fuso horário de Brasília
  const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    weekday: 'long'
  });

  const horaFormatada = timeFormatter.format(now);
  const dataFormatada = dateFormatter.format(now);
  const diaSemanaIndex = now.getDay();
  const diaSemanaNome = diasDaSemana[diaSemanaIndex];
  const ehSabado = diaSemanaIndex === 6;

  return {
    horaFormatada,
    dataFormatada,
    diaSemanaNome,
    ehSabado
  };
}

/**
 * Constrói a instrução do sistema personalizada para a conversa atual
 */
function buildDynamicSystemInstruction(contactSession = null) {
  const ctx = getRawContext();
  const temporal = getTemporalContext();

  const preencherTemplate = (template) => {
    if (!template) return "";
    return template
      .replace(/\$\{\{?nomeBot\}?\}/g, ctx.nomeBot || "")
      .replace(/\$\{\{?nomeEmpresa\}?\}/g, ctx.nomeEmpresa || "")
      .replace(/\$\{\{?tipoNegocio\}?\}/g, ctx.tipoNegocio || "")
      .replace(/\$\{\{?tomDeVoz\}?\}/g, ctx.tomDeVoz || "")
      .replace(/\$\{\{?informacoes\.horarioAtendimento\}?\}/g, ctx.informacoes?.horarioAtendimento || "")
      .replace(/\$\{\{?informacoes\.site\}?\}/g, ctx.informacoes?.site || "")
      .replace(/\$\{\{?informacoes\.contatoHumano\}?\}/g, ctx.informacoes?.contatoHumano || "");
  };

  const produtosArray = Array.isArray(ctx.informacoes?.produtos) ? ctx.informacoes.produtos : [];
  const gruposArray = Array.isArray(ctx.informacoes?.gruposWhatsapp) ? ctx.informacoes.gruposWhatsapp : [];
  const topicosArray = Array.isArray(ctx.informacoes?.principaisTopicos) ? ctx.informacoes.principaisTopicos : [];

  const baseDeConhecimento = `
- Horário de Atendimento Humano: ${ctx.informacoes?.horarioAtendimento || "Não informado"}
- Site Principal: ${ctx.informacoes?.site || "Não informado"}
- Contato Humano / Suporte: ${ctx.informacoes?.contatoHumano || "Não informado"}
- Materiais / Produtos: ${produtosArray.filter(p => p.nome).map(p => `*${p.nome}*: ${p.descricao || ''} ${p.link ? `(Link: ${p.link})` : ''}`).join('\n  ')}
- Grupos WhatsApp Oficiais: ${gruposArray.filter(g => g.nome).map(g => `*${g.nome}*: ${g.link || ''}`).join('\n  ')}
- Tópicos Principais: ${topicosArray.filter(Boolean).join(', ')}
  `.trim();

  // Diagnóstico do estado do contato
  const nomeContato = contactSession?.name ? contactSession.name.split(' ')[0] : '';
  const totalTurnos = contactSession?.turns ? contactSession.turns.length : 0;
  const ehConversaExistente = totalTurnos > 1;
  const jaRecebeuLinkGrupo = !!(contactSession?.metadata?.jaRecebeuLinkGrupo);

  let diretivaRelacional = "";
  if (ehConversaExistente) {
    diretivaRelacional = `
[DIRETIVA DE DIÁLOGO EM ANDAMENTO COM ${nomeContato ? `"${nomeContato.toUpperCase()}"` : "ESTE CLIENTE"}]
- O cliente já está conversando com você há várias mensagens consecutivas.
- É TERMINANTEMENTE PROIBIDO iniciar a resposta com saudações ou cumprimentos repetitivos (ex: PROIBIDO começar com "Oi, ${nomeContato || 'amigo'}!", "Olá!", "Bom dia/tarde!", ou chamar o nome do cliente na abertura da mensagem). O contato já está aberto.
- NÃO repita o nome do cliente a cada mensagem enviada. Trate com proximidade natural e evite o vício de vocativos repetitivos.
- É PROIBIDO reenviar links de grupos ou comunidades que já foram passados anteriormente, a menos que o cliente peça expressamente.
- Responda DIRETA e NATURALMENTE ao que foi dito ou perguntado, usando conectivos coloquiais humanos de WhatsApp (ex: "Olha...", "Sobre isso...", "Entendi perfeitamente...", "Poxa..."), mantendo o diálogo fluido como entre duas pessoas reais.
    `.trim();
  } else {
    diretivaRelacional = `
[DIRETIVA DE PRIMEIRO CONTATO COM ${nomeContato ? `"${nomeContato.toUpperCase()}"` : "NOVO CLIENTE"}]
- Cumprimente de forma calorosa e acolhedora ${nomeContato ? `chamando pelo primeiro nome (${nomeContato})` : 'com carinho'}.
- Se o cliente fez uma pergunta direta, responda a pergunta dele PRIMEIRO com clareza antes de qualquer outra informação.
- Somente apresente a comunidade ou materiais se tiver relação direta com o que ele perguntou ou se ele apenas disse um "Oi / Olá" genérico.
    `.trim();
  }

  const diretivaTemporal = `
[CONTEXTO TEMPORAL EM TEMPO REAL]
- Data/Hora Atual: ${temporal.dataFormatada}, ${temporal.horaFormatada} (Horário de Brasília).
${temporal.ehSabado ? '- ATENÇÃO: Hoje é SÁBADO. O atendimento humano da equipe está em pausa para atividades espirituais sabáticas, mas todos os materiais online continuam 100% disponíveis para download.' : ''}
  `.trim();

  // 1. Extração da Persona (Aba 'Prompt da IA' com variáveis da Aba 'Configuração da IA')
  const personaCustomizada = ctx.promptConfig?.persona
    ? preencherTemplate(ctx.promptConfig.persona).trim()
    : '';
  const personaFinal = personaCustomizada || `Você é ${ctx.nomeBot}, atendente virtual inteligente, acolhedor e resolutivo do ${ctx.nomeEmpresa}.\nSua missão: ${ctx.tipoNegocio}.\nSeu tom de voz obrigatório: ${ctx.tomDeVoz}.`;

  // 2. Extração do Header da Base de Conhecimento (Aba 'Conteúdo da IA')
  const headerBaseConhecimento = ctx.promptConfig?.baseConhecimentoHeader
    ? `${preencherTemplate(ctx.promptConfig.baseConhecimentoHeader).trim()}\n`
    : '';

  // 3. Extração das Regras Gerais e Diretrizes Livres (Aba 'Prompt da IA')
  let regrasCustomizadas = '';
  if (Array.isArray(ctx.promptConfig?.regrasGerais)) {
    regrasCustomizadas = ctx.promptConfig.regrasGerais
      .map(r => preencherTemplate(r).trim())
      .filter(Boolean)
      .join('\n');
  } else if (typeof ctx.promptConfig?.regrasGerais === 'string' && ctx.promptConfig.regrasGerais.trim()) {
    regrasCustomizadas = preencherTemplate(ctx.promptConfig.regrasGerais).trim();
  }

  const systemInstruction = `
${personaFinal}

${diretivaTemporal}

${diretivaRelacional}

## Base de Conhecimento Oficial ##
${headerBaseConhecimento}${baseDeConhecimento}

${regrasCustomizadas ? `## Regras e Diretrizes do Painel ##\n${regrasCustomizadas}\n` : ''}
## Regras de Humanização e Comportamento ##
1. Mantenha as mensagens CONCISAS e FOCADAS. No WhatsApp, pessoas não gostam de ler textões intermináveis.
2. Seja prestativo, empático e resolutivo. Entenda a intenção por trás da dúvida do usuário.
3. Não invente informações, links ou projetos que não estejam na sua base de conhecimento oficial.
4. Para ênfase no WhatsApp, utilize apenas formatação nativa: *negrito* ou _itálico_.
5. Se o usuário demonstrar interesse em falar com um atendente humano, informe os horários e o número de contato de forma gentil.
6. Aja com naturalidade conversacional: em um diálogo já em curso, jamais se reapresente e jamais volte a dizer "Oi" ou saudações de entrada.
  `.trim();

  return systemInstruction;
}

module.exports = {
  getRawContext,
  invalidateContextCache,
  getTemporalContext,
  buildDynamicSystemInstruction
};
