# Arquitetura e Manual de Manutenção: Conexão WhatsApp

Este documento serve como guia técnico definitivo para entender, manter e evoluir o ecossistema de conexão com o WhatsApp nesta aplicação. Ele detalha a engenharia por trás da estabilização da sessão, o ciclo de vida do cliente, os mecanismos de resiliência e as instruções passo a passo para futuras manutenções.

---

## 1. Visão Geral da Arquitetura

A conexão com o WhatsApp não utiliza a API oficial da Meta (WhatsApp Cloud API / On-Premises), mas sim uma automação orientada ao **WhatsApp Web** por meio da biblioteca `whatsapp-web.js` em conjunto com o motor de navegação **Puppeteer / Chromium**.

### Pilares do Ecossistema:
1. **Orquestrador de Servidor (`backend/bot.js`):** Inicializa o servidor Express e Socket.IO em dois estágios (Early Binding na porta HTTP e posterior carregamento pesado dos serviços de negócio e WhatsApp).
2. **Gerenciador de Conexão (`backend/services/whatsappClientManager.js`):** Controla o ciclo de vida do cliente, instancia o Puppeteer com flags otimizadas, gerencia o pareamento por QR Code, monitora a saúde da aba com o Watchdog e orquestra auto-reconexões seguras.
3. **Alinhamento com a Versão Ativa do WhatsApp Web:** Permite o carregamento nativo e atualizado da interface web servida pela Meta, eliminando as desconexões forçadas por obsolescência que ocorrem quando se tenta fixar arquivos HTML antigos.
4. **Armazenamento de Sessão (`.wwebjs_auth/`):** Persiste os tokens criptográficos de autenticação do usuário (LocalAuth) no diretório `userData` (`AppData`), permitindo que o bot reconecte automaticamente após reinicializações sem exigir nova leitura de QR Code.
5. **Processador e Fila de Mensagens (`backend/handlers/messageHandler.js`, `MessageQueueService.js` e `DiskQueuePersistence.js`):** Desacopla o fluxo de atendimento da infraestrutura de conexão através de fila assíncrona com persistência em disco, concorrência unitária e cooldown entre jobs, protegendo a ponte IPC do Puppeteer contra rajadas de mensagens e suportando contatos `@c.us` e `@lid`.
6. **Barramento em Tempo Real (`backend/socketEvents.js` e Frontend):** Notifica o painel React/Electron sobre o estado atual da conexão (`ready`, `loading`, `qr`, `disconnected`, `fatal_error`, `no_internet`).

---

## 2. Ciclo de Vida da Conexão

```
[ Inicialização do Backend ]
             │
             ▼
[ whatsappClientManager.initialize() ]
             │
             ▼
  Verifica e remove SingletonLock
             │
             ▼
  Lança Chromium (Puppeteer) com Flags de Segundo Plano e User-Agent Padrão
             │
             ▼
  Carrega https://web.whatsapp.com/ (Versão Ativa Oficial da Meta)
             │
             ▼
    ┌───────────────────────────┐
    │  Existe sessão em disco?  │
    └─────────────┬─────────────┘
          Sim     │     Não
         ┌────────┴────────┐
         ▼                 ▼
  [ Restaurando ]    [ Evento 'qr' ]
  (Loading Screen)   (Exibe QR Code no painel)
         │                 │
         │           Celular escaneia
         │                 │
         └────────┬────────┘
                  ▼
         [ Evento 'ready' ]
         (Dispositivo Conectado)
                  │
        ┌─────────┴────────────────────────┐
        ▼                                  ▼
[ Ativa Watchdog ]              [ Agenda Varredura Offline ]
(Checa a cada 30s;               (Após 10s: lê pendências e
 25s timeout; 3 falhas)           inicia fila de gotejamento)
```

---

## 3. Gestão de Versão do WhatsApp Web e a Lição do "Logout aos 5 Minutos"

### A Descoberta da Tolerância de 300 Segundos da Meta:
Durante os testes de estabilidade, identificou-se que qualquer tentativa de forçar uma versão defasada do WhatsApp Web via interceptação local de HTML (por exemplo, congelando um arquivo `.html` de meses anteriores) faz com que a sessão caia exatamente aos **5 minutos (300 segundos)** com o evento `LOGOUT`.

* **Como a Meta opera:** Os servidores de borda da Meta aceitam temporariamente a conexão de um cliente companion desatualizado para permitir sincronização emergencial. Contudo, existe um timer rígido de 5 minutos: caso o cliente não esteja na build compatível com os servidores, o servidor emite uma instrução interna de despareamento (`Cmd.logout`), forçando a desconexão e a exibição de novo QR Code.
* **A Solução Atual:** O bot opera sem travas artificiais de versão antiga no código, permitindo que a biblioteca `whatsapp-web.js` receba a build mais recente diretamente da infraestrutura da Meta.

---

## 4. Engenharia de Resiliência e Prevenção de Desconexões

A auditoria contínua do sistema implementou mecanismos de alta confiabilidade contra quedas indesejadas:

### A. Watchdog com Tolerância Inteligente
* **Intervalo de Teste:** A cada 30 segundos.
* **Janela de Resposta:** 25 segundos (tempo suficiente para acomodar a simulação humana de digitação que leva até 15s).
* **Régua de Falhas:** O cliente só é considerado travado se falhar em **3 testes consecutivos** (~90 segundos de tolerância acumulada).
* **Inibição em Estados Inválidos:** Se o cliente não estiver no estado `READY` ou estiver em desconexão voluntária, o teste é sumariamente ignorado.

### B. Blindagem da Pasta de Sessão (`.wwebjs_auth`)
* **Regra de Ouro:** A pasta de autenticação **nunca** é apagada em desconexões transitórias, erros de socket ou quedas de internet.
* **Quando a pasta é apagada:**
  1. No evento explícito `auth_failure` (quando o celular revoga a conexão através do aplicativo móvel).
  2. No método `restart()` (quando o usuário clica deliberadamente no botão "Desconectar" na interface).

### C. Flags do Chromium e Assinatura de Navegador
Para evitar que o Windows ou o próprio Chromium congelem a aba do WhatsApp em segundo plano:
* `--disable-background-timer-throttling`: Garante a cadência ininterrupta dos temporizadores de JavaScript.
* `--disable-backgrounding-occluded-windows`: Mantém a prioridade da janela mesmo sem foco visual.
* `--disable-renderer-backgrounding`: Impede que a thread de renderização seja suspensa.
* `--disable-gpu`: Desliga aceleração gráfica redundante para modo headless, economizando até 150 MB de RAM e prevenindo crashes de driver de vídeo.
* `userAgent`: Padronizado para assinatura moderna e legítima do Chrome para Windows, evitando disparar heurísticas de anomalia na Meta.

### D. Tratamento de Contatos LID (`@lid`) vs Ruídos Reais
No ecossistema moderno do WhatsApp:
* **Identificadores `@lid` (Linked IDs):** São identificadores utilizados pelo WhatsApp para proteger o número de telefone de usuários reais em determinados tipos de conta. **O bot suporta e atende plenamente esses contatos**, garantindo que nenhum cliente fique sem resposta.
* **Filtros Estritos de Exclusão:** O sistema descarta apenas entidades que não representam conversas diretas de atendimento:
  * Grupos (`@g.us`)
  * Canais oficiais (`@newsletter`)
  * Listas de transmissão e mensagens de status (`@broadcast` e `status@broadcast`)
  * Endereços nulos ou do sistema (`0@c.us`)

### E. Isolamento de Erros de Negócio
No arquivo `messageHandler.js`, erros de lógica (como instabilidade temporária na API do Gemini, falhas ao baixar mídias externas ou formatação de texto) são capturados e tratados localmente. Eles **não** são repassados para a função de erro crítico da conexão, assegurando que o bot continue online.

---

## 5. Procedimentos para Futuras Manutenções

### Procedimento 1: Como Forçar um Novo Pareamento por QR Code Limpo?
Se for necessário trocar de número de telefone ou limpar completamente a sessão:
1. Pela interface: Clique em "Desconectar" ou "Reiniciar Bot". O sistema executará a limpeza automática da pasta de autenticação.
2. Por intervenção manual (caso o backend esteja desligado):
   * Finalize os processos do Node e do Chrome relacionados ao bot.
   * Exclua a pasta `.wwebjs_auth` localizada dentro de `%APPDATA%\seu-whatsapp-bot\` (ou localmente em modo dev).
   * Inicie o bot. Um novo QR Code será gerado imediatamente.

### Procedimento 2: Como Inspecionar se o Watchdog está Atuando?
Acompanhe os logs no console do backend. O padrão saudável exibe a cada 30 segundos:
```
[HH:MM:SS] [Watchdog] Verificando saúde do cliente WhatsApp...
[HH:MM:SS] [Watchdog] Cliente WhatsApp está saudável (Estado: CONNECTED).
```
Caso o sistema esteja ocupado processando mídias pesadas ou fila offline, você poderá notar avisos de tolerância transitórios:
```
[HH:MM:SS] ⚠️ [Watchdog] Verificação lenta ou sem resposta (1/3)...
```
Na rodada seguinte, quando a thread for liberada, o contador será automaticamente zerado para `(0/3)`, sem interrupção do serviço.

---

## 6. Mapeamento de Arquivos e Responsabilidades

| Arquivo | Finalidade Principal |
| :--- | :--- |
| `backend/services/whatsappClientManager.js` | Núcleo de conexão, Watchdog, flags do Puppeteer e controle de sessão. |
| `backend/handlers/messageHandler.js` | Triagem de mensagens, suporte a `@c.us` e `@lid`, integração com Gemini, fluxos e digitação humanizada. |
| `backend/services/MessageQueueService.js` | Motor de fila assíncrona com controle de concorrência, cooldown entre mensagens e desacoplamento do Event Loop. |
| `backend/services/DiskQueuePersistence.js` | Persistência atômica da fila em disco para retomada de mensagens não processadas após reinícios. |
| `backend/services/DripQueueManager.js` | Módulo legado de gotejamento preservado para compatibilidade. |
| `backend/handlers/saudacaoService.js` | Envio de mensagens de boas-vindas com histórico permanente por contato. |
| `backend/utils/wwebjsPatcher.js` | Injeção defensiva de suporte para métodos de chats e coleções. |
| `backend/routes/sendMassRoute.js` | Controle e execução de lotes de mensagens em massa. |
| `backend/routes/exportarGrupos.js` | Rota para exportação em Excel dos participantes de grupos. |
| `backend/routes/exportarEtiquetas.js` | Rota para exportação em Excel dos contatos com etiquetas. |
| `backend/routes/listarEtiquetasComTotal.js` | Listagem agregada de etiquetas para seleção no frontend. |
| `backend/socketEvents.js` | Ponte de WebSockets para sincronizar status de conexão com o painel visual. |
