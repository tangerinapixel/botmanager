// backend/wa-engine/diagnostics/contractCatalog.js
// Catálogo formal de módulos e contratos internos da Meta (Comet / window.require)
// utilizados pelo WhatsApp Web e pelo bot.

module.exports = [
  {
    module: 'WAWebCollections',
    domain: 'Core / Store',
    severity: 'CRITICAL',
    description: 'Coleções centrais do WhatsApp (Chat, Msg, Contact, Label)',
    checks: [
      { property: 'Chat', type: 'object' },
      { property: 'Msg', type: 'object' },
      { property: 'Contact', type: 'object' },
      { property: 'Label', type: 'object' }
    ]
  },
  {
    module: 'WAWebSendMsgChatAction',
    domain: 'Mensagens',
    severity: 'CRITICAL',
    description: 'Pipeline de despacho e envio de mensagens para o chat',
    checks: [
      { property: 'addAndSendMsgToChat', type: 'function' }
    ]
  },
  {
    module: 'WAWebPrepRawMedia',
    domain: 'Mídia',
    severity: 'CRITICAL',
    description: 'Processamento e preparação de mídias (imagens, áudios, vídeos)',
    checks: [
      { property: 'prepRawMedia', type: 'function' }
    ]
  },
  {
    module: 'WAWebMediaOpaqueData',
    domain: 'Mídia',
    severity: 'CRITICAL',
    description: 'Encapsulamento de blobs de arquivos para upload',
    checks: [
      { property: 'createFromData', type: 'function' }
    ]
  },
  {
    module: 'WAWebMediaStorage',
    domain: 'Mídia',
    severity: 'HIGH',
    description: 'Armazenamento e consolidação de objetos de mídia em memória',
    checks: [
      { property: 'getOrCreateMediaObject', type: 'function' }
    ]
  },
  {
    module: 'WAWebMediaInMemoryBlobCache',
    domain: 'Mídia / Cache',
    severity: 'MEDIUM',
    description: 'Cache em RAM de blobs decriptados para recuperação instantânea',
    checks: [
      { property: 'InMemoryMediaBlobCache', type: 'object' }
    ]
  },
  {
    module: 'WAWebCmd',
    domain: 'Ações de Mensagem',
    severity: 'HIGH',
    description: 'Comandos de exclusão e revogação de mensagens no chat',
    checks: [
      { property: 'Cmd.sendDeleteMsgs', type: 'function', path: 'Cmd.sendDeleteMsgs' },
      { property: 'Cmd.sendRevokeMsgs', type: 'function', path: 'Cmd.sendRevokeMsgs' }
    ]
  },
  {
    module: 'WAWebChatClearBridge',
    domain: 'Gestão de Conversas',
    severity: 'MEDIUM',
    description: 'Limpeza de mensagens de conversa (Clear Chat)',
    checks: [
      { property: 'sendClear', type: 'function' }
    ]
  },
  {
    module: 'WAWebDeleteChatAction',
    domain: 'Gestão de Conversas',
    severity: 'MEDIUM',
    description: 'Exclusão completa de conversa da lista de recentes',
    checks: [
      { property: 'sendDelete', type: 'function' }
    ]
  },
  {
    module: 'WAWebWidFactory',
    domain: 'Identidade / JID',
    severity: 'HIGH',
    description: 'Fábrica de identificadores WID/JID (c.us, g.us, lid)',
    checks: [
      { property: 'createWid', type: 'function' },
      { property: 'asUserWidOrThrow', type: 'function' }
    ]
  },
  {
    module: 'WAWebApiContact',
    domain: 'Contatos / LID',
    severity: 'HIGH',
    description: 'Resolução de número de telefone a partir de LID',
    checks: [
      { property: 'getPhoneNumber', type: 'function' }
    ]
  },
  {
    module: 'WAWebMsgKey',
    domain: 'Mensagens / Criptografia',
    severity: 'HIGH',
    description: 'Geração de chaves únicas de mensagens',
    checks: [
      { property: 'newId', type: 'function' }
    ]
  }
];
