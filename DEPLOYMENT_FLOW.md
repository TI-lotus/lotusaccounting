# Fluxo de ambientes da Lotus

O desenvolvimento da Lotus permanece local. Não existe um terceiro projeto Supabase remoto para `dev`.

## Fluxo oficial

```text
desenvolvimento local
        |
        | push/PR
        v
staging (branch staging + Supabase Lotus Staging + preview Vercel)
        |
        | Pull Request aprovado
        v
produção (branch main + Supabase produção + domínio Vercel)
```

## O que cada etapa publica

- **Local:** código, migrations e configuração são testados na máquina do desenvolvedor. Use `supabase start`, copie os valores locais para `.env` a partir de `supabase status -o env` e nunca faça commit do `.env`.
- **`staging`:** o GitHub Actions executa typecheck, testes, lint e build; depois aplica migrations, Auth/config e Edge Functions no Supabase Staging. A integração Git da Vercel cria o deploy de preview da branch.
- **`main`:** o mesmo pipeline executa novamente e publica migrations, Auth/config e Edge Functions no Supabase de produção. A Vercel publica a versão de produção.

## Promoção recomendada

1. Trabalhe em uma branch local de feature.
2. Rode localmente:

   ```bash
   supabase start
   supabase status -o env
   npm ci
   npm run typecheck
   npm test -- --run
   npm run lint
   npm run build
   ```

3. Abra um Pull Request para `staging`.
4. Valide a aplicação no preview da Vercel e no Supabase Staging.
5. Depois da validação, abra um Pull Request de `staging` para `main`.
6. Faça merge somente após o CI e a revisão. O merge em `main` dispara o deploy de produção.

Para iniciar apenas o frontend depois do Supabase local estar disponível:

```bash
npm run dev
```

## Configuração necessária no GitHub

Criar o secret de repositório `SUPABASE_ACCESS_TOKEN` com um Personal Access Token do Supabase que tenha acesso aos dois projetos. O valor nunca deve ser colocado no código, no `.env` commitado ou em logs.

Criar também os ambientes do GitHub:

- `staging`: sem aprovação manual obrigatória enquanto a equipe estiver validando o fluxo.
- `production`: recomenda-se exigir aprovação de pelo menos um revisor antes do job de deploy.

Dentro de cada ambiente GitHub, criar o secret `SUPABASE_DB_PASSWORD` com a senha de banco correspondente:

- Ambiente `staging`: senha do banco do projeto `Lotus Staging`.
- Ambiente `production`: senha do banco do projeto de produção.

O nome é igual nos dois ambientes, mas os valores são diferentes. O workflow seleciona automaticamente o valor do ambiente que está sendo publicado.

O workflow reutilizável recebe o projeto correto pela branch:

- `staging` -> `slcqnnhhiooonsnaxfid` (`Lotus Staging`)
- `main` -> `peguwukoyprqzgfqxhju` (produção)

## Segredos que continuam fora do Git

Os secrets das Edge Functions são configurados diretamente em cada projeto Supabase e precisam existir nos dois ambientes antes de usar os fluxos que dependem deles:

- `APP_ORIGIN`
- `ASAAS_BASE_URL`
- `ASAAS_API_KEY`
- `ASAAS_WEBHOOK_TOKEN`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `LOTUS_CREDENTIAL_ENCRYPTION_KEY`
- `LOTUS_SCHEDULER_KEY`

O workflow também valida automaticamente a presença dos secrets de runtime antes de aplicar migrations e publicar funções. A validação confere apenas os nomes; os valores nunca são exibidos nos logs.

Para o staging, `ASAAS_API_KEY` deve ser a chave sandbox e `ASAAS_BASE_URL` deve apontar para a API sandbox. O remetente do Resend precisa pertencer a um domínio verificado ou ser um remetente de teste autorizado para a validação inicial.

O staging deve usar credenciais/testes próprios de Asaas e Resend. As credenciais de produção não devem ser copiadas para staging.

## Rollback

- **Frontend:** usar o deployment anterior na Vercel ou reverter o commit e fazer novo merge.
- **Edge Functions/config:** reverter o commit e disparar novamente o workflow da branch correspondente.
- **Migrations:** não apagar migrations aplicadas. Criar uma nova migration corretiva e promovê-la pelo mesmo fluxo.
- **Dados:** restaurar somente após confirmar o incidente e registrar a janela afetada; migrations destrutivas devem ter backup e plano de reversão antes do merge.

## Regra importante

O branch `dev` remoto não participa do pipeline. O ambiente de desenvolvimento é local; `staging` e `main` são os únicos destinos remotos oficiais.
