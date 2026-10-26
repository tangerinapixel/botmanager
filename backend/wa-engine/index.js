// backend/wa-engine/index.js
// Ponto de entrada público do subsistema WAEngine.
// Exporta a instância central do WAEngine com todos os adaptadores e módulos anexados.

const WAEngine = require('./WAEngine');
const ChatAdapter = require('./adapters/chatAdapter');
const MediaAdapter = require('./adapters/mediaAdapter');
const MessageAdapter = require('./adapters/messageAdapter');
const LabelLidAdapter = require('./adapters/labelLidAdapter');
const WAStoreHealthCheck = require('./diagnostics/waStoreHealthCheck');
const ContractCatalog = require('./diagnostics/contractCatalog');

WAEngine.WAEngine = WAEngine;
WAEngine.ChatAdapter = ChatAdapter;
WAEngine.MediaAdapter = MediaAdapter;
WAEngine.MessageAdapter = MessageAdapter;
WAEngine.LabelLidAdapter = LabelLidAdapter;
WAEngine.WAStoreHealthCheck = WAStoreHealthCheck;
WAEngine.ContractCatalog = ContractCatalog;

module.exports = WAEngine;
