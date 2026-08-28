ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS responsible_user_name text;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_to_name text;

UPDATE public.companies c
SET responsible_user_name = COALESCE(NULLIF(c.responsible_user_name, ''), u.name)
FROM public.users u
WHERE c.responsible_user_id = u.id
  AND NULLIF(COALESCE(c.responsible_user_name, ''), '') IS NULL;

UPDATE public.tasks t
SET assigned_to_name = COALESCE(NULLIF(t.assigned_to_name, ''), u.name)
FROM public.users u
WHERE t.assigned_to = u.id
  AND NULLIF(COALESCE(t.assigned_to_name, ''), '') IS NULL;
