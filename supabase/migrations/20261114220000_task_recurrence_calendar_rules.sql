BEGIN;

-- Preserve month-end deadlines. A task due on January 31 should recur on
-- February 28/29 and then return to March 31, instead of drifting to the
-- 28th forever. Non-month-end dates remain on the closest valid day.
CREATE OR REPLACE FUNCTION public.task_recurrence_next_date(
  base_date date,
  recurrence_frequency text
)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN base_date IS NULL THEN NULL
    WHEN recurrence_frequency = 'annual' THEN (base_date + interval '1 year')::date
    WHEN base_date = (date_trunc('month', base_date) + interval '1 month' - interval '1 day')::date
      THEN (date_trunc('month', base_date) + interval '2 months' - interval '1 day')::date
    ELSE (
      date_trunc('month', base_date) + interval '1 month'
      + (
        LEAST(
          EXTRACT(DAY FROM base_date)::integer,
          EXTRACT(DAY FROM (date_trunc('month', base_date) + interval '2 months' - interval '1 day'))::integer
        ) - 1
      ) * interval '1 day'
    )::date
  END;
$$;

COMMIT;
