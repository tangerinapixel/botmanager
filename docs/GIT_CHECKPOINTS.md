# Histórico e Registro de Checkpoints do Git

Este documento contém o registro dos checkpoints, branches e histórico de versionamento do projeto para consultas futuras e restauração segura.

---

## 1. Informações do Checkpoint Atual

* **Versão:** `2.2.0`
* **Hash do Commit:** `88c0315`
* **Data do Checkpoint:** 26 de Outubro de 2026, 01:40:00 (-03:00)
* **Autor:** Roni Moreira <roni@virtualteologico.com.br>
* **Branch Ativa:** `ponto-estavel`
* **Mensagem:** `ci(actions): esteira de build e publicacao automatica de releases na nuvem`
* **Status:** GitHub Actions workflow (.github/workflows/release.yml) configurado para build e release na nuvem.

---

## 2. Resumo das Alterações Consolidadas neste Checkpoint (Auto-Update com Popup Modal)

### a) Motor Central no Processo Electron (`updater/updateManager.js` e `updater/updateLogger.js`)
- Configuração do `electron-updater` apontando para o repositório GitHub `tangerinapixel/botmanager`.
- Controle de download não-intrusivo (`autoDownload = false`), permitindo consentimento prévio do cliente.
- Transmissão em tempo real de eventos: `checking`, `update-available`, `download-progress` (com %, velocidade e bytes transferidos), `update-downloaded` e `error`.
- Suporte a instalação atômica via `quitAndInstall()` e simulação de teste via `updater:simulate-update`.

### b) Camada de Segurança e ContextBridge (`preload.js`)
- Exposição estrita de canais no `contextBridge.electronAPI.updater`.
- Handlers assíncronos: `checkForUpdates()`, `startDownload()`, `quitAndInstall()`, `getCurrentVersion()` e listeners de eventos.

### c) Interface Visual do Modal (`frontend/src/components/UpdateModal/`)
- `UpdateModal.jsx` e `UpdateModal.css`: Modal flutuante elegante com tema Dark, Glassmorphism e micro-animações.
- Suporte a 4 estados dinâmicos:
  1. *Nova Versão Disponível* (com versão atual, nova versão, changelog formatado e botões de ação).
  2. *Baixando Atualização* (barra de progresso com shimmer, velocidade e opção de continuar em segundo plano).
  3. *Pronto para Instalar* (mensagem amigável e botão de reiniciar e aplicar a atualização).
  4. *Falha de Conexão* (aviso amigável e opção de tentar novamente).
- `Sidebar.jsx`: Atalho visual com ícone de sincronização e número de versão no rodapé.

### a) Vendor Soberano do WhatsApp-Web.js (`backend/vendor/wwebjs`)
- Código-fonte essencial de `whatsapp-web.js` (463.93 KB) 100% versionado no Git sem subpastas `node_modules` nem arquivos compilados.
- Script de espelhamento limpo `backend/wa-engine/syncVendor.js` adicionado ao `postinstall` do `backend/package.json` sem depender de symlinks instáveis no Windows.

### b) Adaptadores Modulares de Domínio (`backend/wa-engine/adapters/`)
- Desacoplamento completo dos 5 patches históricos de `wwebjsPatcher.js`:
  1. `chatAdapter.js`: Patch 1 (`window.WWebJS.getChatModel` flat DTO), Patch 2 (multi-store fallback com `WAWebChatCollection`) e Patch 3 (override de `client.getChats` via `ChatFactory` com garantia de objetos Chat nativos).
  2. `mediaAdapter.js`: Patch 4 (higienização profunda de `MediaData` expurgando `__x_id` e metadados que corrompiam o `MsgKey`).
  3. `messageAdapter.js`: Patch 5 (recuperação resiliente de mensagens enviadas a partir da coleção `chat.msgs` em caso de dessincronização).
  4. `labelLidAdapter.js`: Resolução de número de telefone a partir de LID via `WAWebApiContact`.

### c) Auto-Diagnóstico Não-Bloqueante dos Contratos Meta Comet (`backend/wa-engine/diagnostics/`)
- `contractCatalog.js`: Catálogo com 12 contratos internos da Meta (Comet / `window.require`) com mapeamento de severidade e tipos de retorno.
- `waStoreHealthCheck.js`: Auditoria 100% não-bloqueante e protegida por `try/catch` defensivo, inspecionando versão ativa do WhatsApp Web e contratos sem efeitos colaterais.
- Endpoint de monitoramento: `GET /api/system/wa-health`.
- `backend/utils/wwebjsPatcher.js` preservado como Facade 100% retrocompatível delegando para `WAEngine.applyAll(client)`.

---

## 2. Resumo das Alterações Consolidadas neste Checkpoint (v2.1.7)

### a) Renderização de Imagens no Live Chat (`ChatMessageArea.jsx` e `LiveChat.css`)
1. **Renderização Otimizada e Estável:**
   - Mensagens visuais (`image` e `sticker`) renderizadas com `loading="lazy"` e dimensões fixas no CSS para mitigar *layout shifts*.
   - Tratamento de erro (`onError`) com exibição de placeholder elegante (`📷 Imagem indisponível no histórico`).
2. **Ancoragem Inteligente de Rolagem:**
   - No evento `onLoad` das imagens, verifica a distância do rodapé (`distanceFromBottom < 220`). Se o operador já estava no final da conversa, recalcula suavemente `scrollTop = scrollHeight`, impedindo cortes visuais.
3. **Modal Lightbox / Ampliação:**
   - Clique na imagem abre modal em tela cheia com visualização ampliada, suporte a tecla `Escape`, botão para download local e legenda formatada do WhatsApp.

### b) Envio de Imagens pelo Input do Chat (`ChatInput.jsx` e `useLiveChat.js`)
1. **Toolbar e Anexos:**
   - Botão de anexar com seletor `<input type="file" accept="image/*">` integrado na barra de digitação.
   - Suporte completo ao evento `onPaste` (`Ctrl + V`) para colar prints e imagens da área de transferência instantaneamente.
2. **Pré-visualização e Conformidade CSP:**
   - Miniatura com nome do arquivo, tamanho formatado e botão de remoção rápida `(X)`.
   - Utilização de `FileReader.readAsDataURL` para gerar Data URLs (`data:image/...;base64,...`), garantindo compatibilidade estrita com a diretiva de segurança CSP do Electron/Express.
   - Permite envio com ou sem texto de legenda (botão enviar habilitado na presença de imagem).

### c) Cache Inteligente de Mídia e Backend Seguro (`liveChatService.js`, `liveChatRoutes.js`, `bot.js`)
1. **Extração de Mídia sem Estouro CDP:**
   - Rota `GET /api/live-chat/media/:jid/:messageId` com cabeçalhos HTTP de cache imutável (`max-age=604800`).
   - Extração pontual via Puppeteer consultando diretamente a Store (`WAWebCollections.Msg`) e `InMemoryMediaBlobCache` sem chamar `getMessageById` bruto, eliminando o erro CDP `-32000`.
2. **Zero Download Redundante no Envio:**
   - Ao enviar imagem pela rota `POST /api/live-chat/send`, o arquivo temporário é copiado diretamente para `backend/data/media_cache/<id>.<ext>`, disponibilizando a imagem no cache imediatamente.
3. **Política Anti-Bloat:**
   - Função automática `pruneMediaCache()` que remove silenciosamente mídias do cache com mais de 7 dias ou mantém no máximo os 200 arquivos mais recentes.
4. **Header CSP Atualizado:**
   - Atualizado em `backend/bot.js` para `img-src 'self' data: blob:;`.

### d) Patch Crítico de Mídia no WhatsApp Web v2.3000+ (`wwebjsPatcher.js`)
1. **Eliminação do Erro `Data passed to getter must include an id property`:**
   - Descoberta e isolada a causa raiz: `window.WWebJS.processMediaData` retornava um Model `MediaData` com a propriedade interna `__x_id: '1'`. Ao espalhar `...mediaOptions` no construtor da mensagem, o `MsgKey` era corrompido, fazendo os getters do WhatsApp (`getSender` / `getValidatedSender`) falharem.
   - Implementado o **Patch 4** em `wwebjsPatcher.js` expurgando `__x_id`, `parent`, `collection` e `revisionNumber` antes da criação da mensagem, viabilizando o envio de imagens com 100% de sucesso.

### f) Envio Nativo de Imagem (`type: 'image'`) e Preservação de Extensão no Multer (`liveChatRoutes.js`, `liveChatService.js`, `wwebjsPatcher.js`)
1. **Multer com DiskStorage e Extensões Preservadas (`liveChatRoutes.js`):**
   - Substituição de `multer({ dest: uploadsDir })` por `multer.diskStorage` que preserva rigorosamente a extensão original (`.jpg`, `.png`, etc.) no disco, impedindo que arquivos sem extensão façam o `mime.getType` retornar `null`.
2. **Construção Segura e Tipada de `MessageMedia` (`liveChatService.js`):**
   - Extração do MIME type e nome de arquivo válidos com fallback estrito (`image/jpeg`, `image/png`, `image/webp`).
   - Construção explícita via `new MessageMedia(mimetype, b64data, filename)` e envio com `sendMediaAsDocument: false` e vinculação de `options.media = media`.
3. **Patch 4 Aprimorado e Patch 5 de Retorno Resiliente (`wwebjsPatcher.js`):**
   - Forçamento estrito de `mediaData.type = 'image'` em `attributes` e método `set('type', 'image')`.
   - **Patch 5:** Resiliência no retorno do `sendMessage`, recuperando a mensagem enviada a partir da coleção de mensagens do chat se `Msg.get` ainda não tiver sincronizado, garantindo o `messageId` exato no frontend e cache de disco.

---

## 3. Histórico de Checkpoints Anteriores

* **`dab5f3a`** - (2026-10-25) `feat(livechat): suporte a envio e renderizacao de imagens, cache inteligente e correcoes v2.1.7`
* **`9ab941d`** - (2026-10-25) `fix(etiquetas): consistencia estrita de contatos exportaveis e cofre ultra-leve lidPhoneStore`
* **`f340bcd`** - (2026-10-25) `fix(livechat): blindagem de edge cases em grupos, remocao de race condition e novo loader dinamico`
* **`21dfac9`** - (2026-10-25) `docs: registro de checkpoints e histórico do Git para consulta futura`
* **`2193d49`** - (2026-10-25) `feat: central de conversas (LiveChat), fila de mensagens, IA conversacional e melhorias de UX`
* **`b059e8e`** - (2025-07-12) `Novo ponto de partida estável`
* **`0987628`** - (2025-06-11) `logica loader de confirmação de licença atualizada`

---

## 4. Branches Disponíveis no Repositório

| Branch | Descrição |
| :--- | :--- |
| `ponto-estavel` *(atual)* | Branch de produção estável contendo todo o LiveChat, correções de UX, loader moderno e fila de mensagens |
| `master` | Linha principal de desenvolvimento anterior |
| `projeto-restaurado-ok` | Backup anterior de restauração da aplicação |

---

## 5. Guia Rápido de Comandos Git para Consulta e Restauração

### Para verificar o status atual:
```bash
git status
```

### Para ver o log recente resumido:
```bash
git log --oneline -n 10
```

### Para criar um novo commit de checkpoint:
```bash
git add .
git commit -m "tipo(escopo): descrição clara da alteração"
```

### Para restaurar com segurança caso precise voltar ao ponto anterior:
```bash
# Volta arquivos do diretório de trabalho mantendo o histórico
git checkout f312b2e -- .
```
