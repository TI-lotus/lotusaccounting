CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'collaborator', 'client');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  owner_user_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  name text,
  role text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text,
  phone text,
  job_title text,
  account_type text NOT NULL DEFAULT 'client',
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  company_id uuid,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  cnpj text,
  email text,
  phone text,
  tax_regime text,
  service_fee numeric DEFAULT 0,
  city text,
  state text,
  status text DEFAULT 'active',
  responsible_user_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  document_type text,
  status text DEFAULT 'pending',
  file_path text,
  name text,
  original_file_name text,
  amount numeric,
  doc_date date,
  month int,
  year int,
  read_at timestamptz,
  classified_automatically boolean DEFAULT false,
  classification_confidence numeric,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  number text,
  amount numeric NOT NULL,
  status text DEFAULT 'pending',
  issued_at timestamptz,
  due_date date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  status text DEFAULT 'pending',
  method text,
  paid_at timestamptz,
  description text,
  category text,
  direction text DEFAULT 'entrada',
  due_date date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by uuid,
  title text,
  description text,
  task_type text,
  status text DEFAULT 'pending',
  priority text DEFAULT 'medium',
  category text,
  due_date timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  channel text,
  title text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  message text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  monthly_fee numeric,
  billing_cycle text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  type text,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid,
  entity text,
  entity_id uuid,
  action text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

CREATE INDEX IF NOT EXISTS idx_companies_tenant_id ON public.companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON public.documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_id ON public.tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON public.payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON public.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON public.messages(tenant_id);
