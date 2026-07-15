# Reestruturação da Lotus — Navegação, Páginas Padrão e Chat Lateral

Vou entregar essa reestruturação em **fases incrementais** porque o escopo é muito grande para um único passo sem quebrar a experiência atual. Cada fase é utilizável por si só e mantém as páginas existentes funcionando.

---

## Fase 1 — Navegação em grupos + Chat lateral fixo (esta iteração)

**Barra de navegação (top nav agrupada)**
Reorganizo `AppSidebar.tsx` (que já é uma barra horizontal) em 7 grupos com menus dropdown:

```text
Início        → Dashboard
Relacionamento → Clientes · Colaboradores · Mensagens
Operação      → Tarefas · Agenda · Documentos
Financeiro    → Visão geral · Pagamentos · Faturas · Conciliação
Automação    → Lia · Agentes · Workflows · Integrações
Crescimento  → Relatórios · Afiliados
Administração → Configurações · Upgrade
```

- Consulta CNPJ **sai** da navegação e vira ação embutida no cadastro/edição de cliente.
- Cada grupo abre em `DropdownMenu` (shadcn) com os itens do grupo; o item ativo destaca o grupo pai.
- Rotas atuais permanecem; adiciono placeholders `/agenda` e `/finance` apenas se necessário nesta fase (senão fica para Fase 2).

**Chat lateral fixo (substitui o balão flutuante)**
Reescrevo `ChatBox.tsx` como painel ancorado à direita:

- Largura padrão `380px`, ocupa da base da `TopBar` até o rodapé da viewport (`top: 64px; bottom: 0; right: 0; position: fixed`).
- Estados: **aberto**, **minimizado** (barra vertical fina de 48px com ícone Lia + título rotacionado) e **fechado** (some, botão flutuante volta só para reabrir).
- Controles no header: minimizar, fechar. Conversa não é perdida ao minimizar.
- Composer: textarea + botão anexar documento (`Paperclip`) + botão enviar + botão destacado **"Falar com humano"** (variant secondary com destaque gilver).
- Layout principal ganha `padding-right` dinâmico quando o chat está aberto (não sobrepõe conteúdo em desktop ≥1280px). Em telas menores vira overlay/tela cheia com backdrop.
- Mantém a integração atual com `lia-chat` edge function e o fundo `lotus-insights.png` no header.

**Ajuste em `DashboardLayout.tsx`**: aplica `pr-[380px]` condicional quando chat aberto em telas grandes.

## Fase 2 — Dashboard priorizado + Cliente 360° + Agenda unificada
- Dashboard: seção superior de **Pendências e riscos** (tarefas em atraso, faturas vencendo, obrigações fiscais próximas, alertas de conciliação) antes dos KPIs financeiros.
- Página `/clients/:id` reformulada como **visão 360°** com abas: Cadastro · Financeiro · Documentos · Tarefas · Obrigações · Mensagens · Atividades.
- Nova página **Agenda** (`/agenda`) unificando eventos de pagamentos, documentos e relatórios (remove calendários locais dessas páginas).
- CNPJ integrado ao form de cliente (botão "Buscar CNPJ" preenche campos).

## Fase 3 — Financeiro consolidado + Documentos focado + Relatórios analíticos
- Área Financeiro com sub-abas: Movimentações, A pagar, A receber, Faturas, Conciliação, Fluxo de caixa.
- Documentos: abas Recebidos · Solicitações · Emitidos · Pendências, agrupamento por cliente/competência, viewer com versionamento.
- Relatórios: análises detalhadas, comparações período a período, relatórios salvos, agendamentos e exportação (sem duplicar cards do Dashboard).

## Fase 4 — Colaboradores + Automação diferenciada
- Colaboradores com abas: Pessoas · Capacidade · Tarefas · Permissões · Reatribuição segura ao desativar.
- **Lia** (chat/insights) — já existe, apenas reforço posicionamento.
- **Agentes**: biblioteca, modelos, versões, execuções, erros, testes, aprovações humanas.
- **Workflows**: editor centralizado em Automação (mover `WorkflowFlow` para `/workflows`), com gatilhos, condições, aprovações, ações.
- **Integrações**: catálogo de sistemas externos, usadas como recursos nos nodes de workflow.

## Fase 5 — Padrão de página + painéis laterais + estados
- Componente `<PageShell>` com slots: título, descrição, ação principal, KPIs resumidos, abas, filtros, busca, conteúdo.
- Tabela como visualização padrão para grandes volumes; cards só quando agregam valor.
- Painel lateral (`Sheet` shadcn) para detalhes de cliente/pagamento/documento/execução com histórico e ações.
- Filtros salvos, ações em massa, estados de loading/erro/vazio/sem-permissão, toasts com **Desfazer** para ações reversíveis.

---

## Detalhes técnicos (Fase 1)

Arquivos alterados:
- `src/components/AppSidebar.tsx` — grupos + dropdowns
- `src/components/ChatBox.tsx` — painel lateral fixo com minimizar/fechar/anexo/humano
- `src/layouts/DashboardLayout.tsx` — reserva espaço à direita quando o chat está aberto
- Novo contexto leve `ChatPanelContext` (ou state via `useState` + `localStorage`) para lembrar se o chat está aberto/minimizado

Sem mudanças de banco nesta fase.

---

Confirma que sigo com a **Fase 1** agora (navegação agrupada + chat lateral fixo) e depois avançamos fase a fase? Ou prefere que eu comece por outra fase?
