# Histórico e Registro de Checkpoints do Git

Este documento contém o registro dos checkpoints, branches e histórico de versionamento do projeto para consultas futuras e restauração segura.

---

## 1. Informações do Checkpoint Atual

* **Versão:** `2.1.7`
* **Hash do Commit:** `dab5f3a`
* **Data do Commit:** 25 de Outubro de 2026, 21:03:03 (-03:00)
* **Autor:** Roni Moreira <roni@virtualteologico.com.br>
* **Branch Ativa:** `ponto-estavel`
* **Mensagem:** `feat(livechat): suporte a envio e renderizacao de imagens, cache inteligente e correcoes v2.1.7`
* **Status:** Árvore de trabalho limpa (`working tree clean`), todas as alterações consolidadas.

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

### e) Atualização de Versão
- Versão incrementada para `2.1.7` em `package.json`, `backend/package.json` e `preloader/loading.html`.

---

## 3. Histórico de Checkpoints Anteriores

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
