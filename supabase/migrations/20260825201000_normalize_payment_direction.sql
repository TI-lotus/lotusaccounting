UPDATE public.payments
SET direction = CASE
  WHEN direction = 'income' THEN 'entrada'
  WHEN direction = 'expense' THEN 'saida'
  ELSE direction
END
WHERE direction IN ('income', 'expense');

ALTER TABLE public.payments
  ALTER COLUMN direction SET DEFAULT 'entrada';
