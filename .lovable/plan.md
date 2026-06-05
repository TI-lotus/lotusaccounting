# Sincronização CRUD com Supabase

## Objetivo
Substituir todo o `DataContext` baseado em mocks por leituras/escritas reais no Supabase, escopado por `tenant_id` do usuário logado, com auto-criação de tenant no signup.

## 1. Migração de schema (estendendo tabelas existentes)

Será uma única migração que:

**`tenants`** — adiciona `name text`, `owner_user_id uuid`.

**`profiles`** — garante `tenant_id`, `full_name text`, `avatar_url text`, `role text default 'owner'`.

**`companies` (clientes)** — adiciona:
`tax_regime text`, `service_fee numeric`, `city text`, `state text`, `status text default 'active'`, `responsible_user_id uuid`.

**`tasks`** — recriada com colunas completas:
`title`, `description`, `type` (monthly/annual/one_time), `status` (pending/in_progress/completed/overdue), `priority` (low/medium/high), `due_date date`, `category text`, `company_id uuid`, `assigned_to uuid`, `completed_at timestamptz`, `tenant_id`, `created_by`.

**`documents`** — adiciona `name text`, `original_file_name text`, `amount numeric`, `doc_date date`, `month int`, `year int`, `read_at timestamptz`, `classified_automatically bool`, `classification_confidence numeric`.

**`invoices`/`payments`** — adiciona `description text`, `category text`, `direction text` (entrada/saida) em payments.

**`messages`/`conversations`** — adiciona `title text` em conversations.

Todas as colunas novas vão como nullable/with default, sem quebrar dados existentes.

### Tenant automático
- Função `handle_new_user` atualizada: cria um `tenants` row, cria `profiles` com esse `tenant_id`, e insere `user_roles` com `'admin'` (papel app_role).
- Garante GRANTs para `authenticated`/`service_role` em todas as colunas/tabelas novas.

### RLS
- Mantém o padrão atual (`tenant_id = current_user_tenant_id()` AND ownership/admin).
- Novas colunas herdam as policies existentes.

## 2. Refatoração do `DataContext`

- Remove **todos** os mocks.
- Substitui por hooks que chamam Supabase:
  - `useEffect` carrega `clients`, `tasks`, `documents`, `payments`, `messages` filtrados pelo `tenant_id` (via RLS, basta `select *`).
  - `add/update/delete` viram `async` e fazem `supabase.from(...).insert/update/delete`.
  - `tenant_id` é injetado automaticamente; `created_by`/`uploaded_by`/`assigned_to` quando aplicável.
- Mapeia nomes de coluna do banco (snake_case) ↔ tipos do front (camelCase).
- Toasts de sucesso/erro centralizados.
- Realtime opcional fica de fora desta fase (mantemos refetch).

## 3. Páginas afetadas

`Clients.tsx`, `ClientDetail.tsx`, `Tasks.tsx`, `Documents.tsx`, `Payments.tsx`, `Messages.tsx`, `Index.tsx` (dashboard), `Staff.tsx`, `Settings.tsx`.

Mudanças por página:
- Tornar handlers `async` quando chamam mutação.
- Adicionar estado de loading inicial.
- Ajustar campos que dependiam de relações inexistentes (ex.: `responsibleUserName`) → buscar via join na consulta inicial.
- `Staff` lê de `profiles` do mesmo tenant.

## 4. Auth
- `Auth.tsx`: signup continua igual; o trigger no banco cria tenant + profile.
- Após login, `DataContext` aguarda `session` antes de buscar.

## 5. Dados mock
- Removidos por completo do código.
- App inicia vazio; o usuário cria seus próprios registros.

## Detalhes técnicos
- Tipos do Supabase serão regenerados após a migração antes do código novo entrar.
- `DataContext` exporta a mesma API pública (mesmas funções) para minimizar mudanças nas páginas.
- Datas convertidas com `new Date().toISOString()` na escrita; formatação pt-BR mantida na leitura.
- `useAuth().session` é a fonte de verdade; sem sessão → arrays vazios e nenhuma chamada.

## Fora de escopo desta entrega
- Upload real de arquivos para Storage (documentos continuam com metadata; arquivo fica para etapa futura).
- Realtime subscriptions.
- Importação/seed dos dados mock antigos.