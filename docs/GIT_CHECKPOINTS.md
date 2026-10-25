# Histórico e Registro de Checkpoints do Git

Este documento contém o registro dos checkpoints, branches e histórico de versionamento do projeto para consultas futuras e restauração segura.

---

## 1. Informações do Checkpoint Atual

* **Hash do Commit:** `9ab941d`
* **Data do Commit:** 25 de Outubro de 2026, 18:10:05 (-03:00)
* **Autor:** Roni Moreira <roni@virtualteologico.com.br>
* **Branch Ativa:** `ponto-estavel`
* **Mensagem:** `fix(etiquetas): consistencia estrita de contatos exportaveis e cofre ultra-leve lidPhoneStore`
* **Status:** Árvore de trabalho limpa (`working tree clean`), todas as alterações consolidadas.

---

## 2. Resumo das Alterações Consolidadas neste Checkpoint

### a) Consistência Estrita entre Popup Modal `(N)` e Planilha Excel (`.xlsx`)
1. **Regra Unificada de Resolução em Lote:**
   - Em `backend/routes/listarEtiquetasComTotal.js` e `backend/routes/exportarEtiquetas.js`, unificação da cadeia de resolução de números de telefone reais:
     `c.us direto` ➔ `WAWebApiContact.getPhoneNumber(widObj)` ➔ `contact.phoneNumber` ➔ `chat.contact.phoneNumber` ➔ cofre `lidPhoneStore`.
2. **Contabilidade e Exportação Idênticas (100% Paridade):**
   - O contador do modal `(N)` agora computa **apenas contatos individuais únicos que possuem telefone exportável válido**, descartando contatos `@lid` anônimos/órfãos que não possuem número associado no WhatsApp.
   - A rota de exportação gera a planilha `.xlsx` com deduplicação rigorosa por número limpo (`replace(/\D/g, '')`), assegurando que o número exibido no modal e a quantidade de linhas na planilha batam com 100% de precisão (validado na Etiqueta 19 com 14 contatos e na Etiqueta 25 com 406 contatos em ambas as rotas).

### b) Cofre Local Ultra-Leve (`lidPhoneStore.js`)
1. **Operação 100% em RAM (`Map`) e Zero Bloat:**
   - Implementado singleton em `backend/utils/lidPhoneStore.js` armazenando mapeamentos em memória RAM para leituras síncronas $O(1)$ sem I/O de disco.
   - Formato minificado em tupla JSON `{"<LID>@lid":["<TELEFONE>","<NOME>"]}` no arquivo `backend/data/lid-phone-map.json` (11.174 registros ocupando apenas 456 KB em disco).
2. **Persistência Assíncrona e Proteção de I/O:**
   - Gravação em disco via `fs.promises.writeFile` com debounce longo (25s) e flag atômica `isDirty`, evitando concorrência ou impacto de CPU/disco em alto tráfego.
3. **Indexação Inteligente e Hidratação:**
   - Hidratação instantânea via Puppeteer no evento `ready` do WhatsApp Web a partir de `WAWebApiContact.lidPnCache`.
   - Extrator regex com validação de formato e contexto (`extractPhoneFromText`) para capturar números digitados por clientes em mensagens recebidas (`backend/services/whatsappClientManager.js`).

### c) Correção de Roteamento SPA (`backend/bot.js`)
1. **Bypass da Rota de Download:**
   - Adicionada exceção explícita na linha 92 do `backend/bot.js` para requisições iniciadas com `/exportar-`, impedindo que o fallback SPA do Express intercepte o download da planilha e retorne o HTML do React.

---

## 3. Histórico de Checkpoints Anteriores

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
