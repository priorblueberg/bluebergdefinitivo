
CREATE TABLE public.historico_euro (
  data date NOT NULL PRIMARY KEY,
  cotacao_venda numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.historico_euro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Euro history publicly readable"
  ON public.historico_euro FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert euro history"
  ON public.historico_euro FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update euro history"
  ON public.historico_euro FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete euro history"
  ON public.historico_euro FOR DELETE TO authenticated
  USING (true);
