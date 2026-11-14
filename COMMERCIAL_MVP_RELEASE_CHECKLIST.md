# Lotus Accounting Commercial MVP Release Checklist

## Ambientes

- Branch de release: `mvp-commercial-release`.
- Frontend: Vercel com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Backend: Supabase staging e production separados.
- Auth URLs: dominio final, `/auth`, `/auth?reset=1` e URL local de desenvolvimento.
- Storage: buckets privados de documentos e avatars conferidos.

## Secrets Supabase

Configure por ambiente, nunca no frontend:

- `APP_ORIGIN`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOTUS_CREDENTIAL_ENCRYPTION_KEY`
- `LOTUS_SCHEDULER_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `ASAAS_API_KEY`
- `ASAAS_BASE_URL`
- `ASAAS_WEBHOOK_TOKEN`
- `SERPRO_ACCESS_TOKEN`
- `SERPRO_CNPJ_BASE_URL`
- `INTER_BASE_URL`

As credenciais específicas de cada conta Banco Inter ficam em `integration_credentials`, via tela de integrações: `client_id`, `client_secret`, `conta_corrente`, `certificate_pem`, `private_key_pem` e, quando necessário, `base_url`.

## Deploy

1. Rodar `npm run typecheck`.
2. Rodar `npm test -- --run`.
3. Rodar `npm run build`.
4. Aplicar migrations no staging.
5. Publicar Edge Functions:
   - `create-billing-checkout`
   - `asaas-webhook`
   - `sync-billing-status`
   - `serpro-query-cnpj`
   - `client-self-signup`
   - `claim-client-access`
   - `enqueue-integration-job`
   - `process-integration-jobs`
   - `process-domain-events`
   - `run-integration-scheduler`
   - `store-integration-credential`
   - `revoke-integration-credentials`
6. Configurar `asaas-webhook` e `run-integration-scheduler` sem JWT.
7. Configurar cron protegido por `LOTUS_SCHEDULER_KEY`.
8. Repetir o processo em production somente depois do smoke test em staging.

## Smoke test obrigatório — plataforma core

- Criar conta admin e confirmar e-mail.
- Ativar MFA/TOTP.
- Criar colaborador e cliente por convite.
- Criar acesso de cliente pela opcao "Sou cliente" usando e-mail cadastrado na empresa.
- Validar que "Sou cliente" nao envia e-mail de confirmacao nativo do Supabase e nao cria workspace.
- Cadastrar cliente com CNPJ normalizado.
- Validar que cliente não enxerga dados de outro cliente.
- Validar que colaborador sem permissão não acessa financeiro/integrações.

As integrações externas (SERPRO, Asaas, Banco Inter, WhatsApp e e-mail
transacional) ficam fora da aprovação desta etapa. Elas só entram em um smoke
test separado depois que a plataforma core passar os três roteiros do
`OPERATIONAL_MVP_RUNBOOK.md`.

## Rollback

- Frontend: promover a versão Vercel anterior.
- Edge Functions: redeploy da versão anterior das functions.
- Banco: migrations novas são aditivas; em rollback lógico, pausar cron, revogar webhooks externos e ocultar UI de billing/integrações via plano.
- Provedores: desativar webhook Asaas, pausar credenciais Inter/SERPRO e preservar eventos recebidos para reprocessamento.
