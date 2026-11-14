# Lotus Accounting

Plataforma SaaS para operação de escritórios de contabilidade: clientes,
competências, tarefas, documentos, mensagens e financeiro interno.

## Desenvolvimento

```powershell
npm install
npm run dev
```

Validações obrigatórias antes de enviar para `staging`:

```powershell
npm run typecheck
npm test -- --run
npm run lint
npm run build
```

O lint pode apresentar avisos históricos de Fast Refresh, mas não deve possuir
erros bloqueantes.

## Fluxo de ambientes

- `dev`: desenvolvimento local.
- `staging`: validação integrada com Supabase staging e preview do Vercel.
- `main`: produção, promovida somente após o roteiro de staging.

O deploy de migrations, configurações e Edge Functions é feito pelo pipeline
do GitHub. Secrets e chaves nunca devem ser commitados neste repositório.

## Documentação operacional

- [Runbook do MVP](OPERATIONAL_MVP_RUNBOOK.md): QA por perfil, checklist mensal,
  testes negativos e critério de aprovação.
- [Plano operacional de contabilidade](OPERATIONAL_ACCOUNTING_EXECUTION_PLAN.md):
  ciclo mensal, checklists, documentos, revisão e alertas.
- [Checklist comercial e deploy](COMMERCIAL_MVP_RELEASE_CHECKLIST.md):
  ambientes, secrets, smoke test e rollback.
- [Fluxo de deploy](DEPLOYMENT_FLOW.md): pipeline local → staging → produção.

## Stack

- Vite, React, TypeScript e Tailwind CSS.
- Componentes shadcn/ui e Radix.
- Supabase Auth, Postgres, RLS, Storage e Edge Functions.
- Vercel para o frontend.

Integrações externas existentes no código são tratadas como uma etapa separada;
o roteiro operacional atual valida a plataforma core sem depender delas.
