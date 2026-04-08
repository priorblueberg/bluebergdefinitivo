UPDATE public.historico_ipca
SET data_publicacao = (competencia + INTERVAL '1 month' + INTERVAL '10 days')::date
WHERE data_publicacao IS NULL;