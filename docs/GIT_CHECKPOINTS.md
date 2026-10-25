# Histórico e Registro de Checkpoints do Git

Este documento contém o registro dos checkpoints, branches e histórico de versionamento do projeto para consultas futuras e restauração segura.

---

## 1. Informações do Checkpoint Atual

* **Hash do Commit:** `f312b2e`
* **Data do Commit:** 25 de Outubro de 2026, 14:37:03 (-03:00)
* **Autor:** Roni Moreira <roni@virtualteologico.com.br>
* **Branch Ativa:** `ponto-estavel`
* **Mensagem:** `fix(livechat): blindagem de edge cases em grupos, remocao de race condition e novo loader dinamico`
* **Status:** Árvore de trabalho limpa (`working tree clean`), todas as alterações consolidadas.

---

## 2. Resumo das Alterações Consolidadas neste Checkpoint

### a) Blindagem de Grupos e Comunidades (Edge Cases)
1. **Exposição de Flags de Comunidade:**
   - Em `backend/utils/wwebjsPatcher.js`, implementada a exposição segura de `isParentGroup`, `groupType`, `isCommunity` e `isCommunityAnnouncementGroup` nos DTOs de `window.WWebJS.getChatModel` e `window.WWebJS.getChats`.
   - Na criação de objetos via `ChatFactory.create`, as propriedades são preservadas diretamente na instância do Chat (evitando que o método `_patch` interno da biblioteca descarte os atributos).
2. **Higienização de Contêineres-Pai e Grupos Órfãos:**
   - Em `backend/services/liveChatService.js`, descarte estrito de contêineres-pai de comunidade (`isParentGroup === true` ou `groupType === 'COMMUNITY'`), que não são salas de conversas reais.
   - Descarte de grupos órfãos de chamadas/notificações com nome genérico (`"Grupo"` e `isReadOnly === true`), reduzindo a lista de grupos para apenas os grupos válidos e salas de avisos ativas.

### b) Eliminação de Race Condition no Frontend
1. **Trava de Concorrência Assíncrona:**
   - Em `frontend/src/hooks/useLiveChat.js`, implementada referência sincronizada `activeJidRef.current = jid`.
   - Na troca de conversas (`selectChat`), limpeza atômica imediata das mensagens anteriores (`setMessages([])`) quando o novo contato não está no cache, evitando sobreposição de conteúdo visual.
   - Na chegada de dados assíncronos (`fetchMessagesForJid`), validação estrita de `if (activeJidRef.current === jid)` antes de aplicar `setMessages`, impedindo que respostas concorrentes sobrescrevam a tela do chat ativo.
   - Proteção de cache em memória (`messagesCacheByJid`): apenas arrays com mensagens reais (`length > 0`) são armazenados, prevenindo o bloqueio permanente de contatos.

### c) Novo Loader Dinâmico e Feedback Visual de Mensagens
1. **Spinner com Halo Gradiente e Pulso:**
   - Em `frontend/src/components/LiveChat/ChatMessageArea.jsx` e `frontend/src/components/LiveChat/LiveChat.css`, substituição do texto estático *"Carregando histórico de mensagens..."* por um loader visual moderno.
   - Anel externo com halo gradiente neon (`#38bdf8` ➔ `#6366f1`) acelerado por GPU (`@keyframes liveChatSpin`).
   - Ícone central `MessageSquare` com animação de pulso e brilho (`@keyframes liveChatPulse`).
   - Rótulo *"Carregando mensagens"* acompanhado de micro-animação de onda nos 3 pontos (`@keyframes liveChatDotWave`).
   - Transição suave de entrada com *fade-in*.
2. **Feedback Visual de Estado Vazio:**
   - Exibição de card limpo e amigável quando `messages.length === 0` (diferenciando grupos de conversas privadas) para que o operador saiba que não há mensagens recentes em vez de ver uma tela em branco.

---

## 3. Histórico de Checkpoints Anteriores

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
