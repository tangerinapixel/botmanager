# Histórico e Registro de Checkpoints do Git

Este documento contém o registro dos checkpoints, branches e histórico de versionamento do projeto para consultas futuras e restauração segura.

---

## 1. Informações do Checkpoint Atual

* **Hash do Commit:** `2193d49`
* **Data do Commit:** 25 de Outubro de 2026, 13:01:28 (-03:00)
* **Autor:** Roni Moreira <roni@virtualteologico.com.br>
* **Branch Ativa:** `ponto-estavel`
* **Mensagem:** `feat: central de conversas (LiveChat), fila de mensagens, IA conversacional e melhorias de UX`
* **Status:** Árvore de trabalho limpa (`working tree clean`), todas as alterações consolidadas.

---

## 2. Resumo das Alterações Consolidadas neste Checkpoint

### a) Módulo LiveChat (Central de Conversas)
1. **Listagem e Segregação de Conversas:**
   - Visualização por abas: *Todas*, *Privadas* e *Grupos*.
   - Tratamento de nomes, telefones formatados, avatares e contadores de mensagens não lidas.
2. **Suporte Robusto a Grupos (`@g.us`):**
   - Implementado DTO plano em `backend/utils/wwebjsPatcher.js` para `window.WWebJS.getChatModel`.
   - Eliminados erros CDP `-32000` (referências circulares do MobX) e exceções de IndexedDB (`DataError: Failed to execute 'get' on 'IDBObjectStore'`).
   - Carregamento de títulos reais de grupos e suporte a participantes.
3. **Filtro Canônico Anti-Bolhas Fantasmas:**
   - Blacklist de mensagens de protocolo (`e2e_notification`, `notification_template`, `gp2`, `ciphertext`, etc.) em `backend/services/liveChatService.js` e `frontend/src/hooks/useLiveChat.js`.
   - Preservação estrita de mensagens com mídia (`hasMedia: true`) mesmo sem legenda.
4. **Ancoragem Instantânea e Rolagem Inteligente:**
   - Em `frontend/src/components/LiveChat/ChatMessageArea.jsx`, substituição do `useEffect` de scroll pelo `useLayoutEffect` com medição e ajuste *pre-paint* (`container.scrollTop = container.scrollHeight`).
   - Eliminação do *smooth scroll* incômodo na troca de conversas: ao entrar em qualquer chat, a tela abre instantaneamente já posicionada na mensagem mais recente.
   - Rolagem suave reservada exclusivamente para novas mensagens incrementais (quando enviadas pelo operador ou quando o operador já estiver no rodapé).

### b) Arquitetura Backend e Fila de Mensagens
* Criação de serviços modulares em `backend/services/` (`MessageQueueService`, `DiskQueuePersistence`, `DripQueueManager`, `liveChatService`, `whatsappClientManager`, `geminiService`).
* Persistência de fila em disco e recuperação resiliente após reinicializações.
* Integração de memória de contexto e IA conversacional (`aiMemoryRepository`, `conversationalAiService`).

### c) Higiene do Repositório
* `.gitignore` atualizado para ignorar caches de sessão do Puppeteer/WhatsApp (`backend/sessions/`, `temp_user_data/`), arquivos de build pesados (`dist/`) e logs de execução (`*-stdout.txt`, `*-stderr.txt`).
* Remoção definitiva de resíduos temporários do índice Git.

---

## 3. Branches Disponíveis no Repositório

| Branch | Descrição |
| :--- | :--- |
| `ponto-estavel` *(atual)* | Branch de produção estável contendo todo o LiveChat, correções de UX e fila de mensagens |
| `master` | Linha principal de desenvolvimento anterior |
| `projeto-restaurado-ok` | Backup anterior de restauração da aplicação |

---

## 4. Guia Rápido de Comandos Git para Consulta e Restauração

### Para verificar o status atual:
```bash
git status
```

### Para ver o histórico detalhado dos últimos commits:
```bash
git log --oneline -n 10
```

### Para inspecionar as alterações deste checkpoint (`2193d49`):
```bash
git show 2193d49 --stat
```

### Para criar uma nova tag de versão neste ponto:
```bash
git tag -a v2.2.0 -m "Versao 2.2.0 com LiveChat e IA"
```

### Para restaurar a árvore caso alguém faça alterações indesejadas:
```bash
# Descarta alterações não salvas e volta exatamente para este commit:
git reset --hard 2193d49
```

### Para criar uma nova branch a partir deste checkpoint:
```bash
git checkout -b minha-nova-feature 2193d49
```
