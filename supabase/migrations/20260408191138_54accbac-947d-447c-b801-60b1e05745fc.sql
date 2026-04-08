
-- Table: historico_ipca (official monthly IPCA data)
CREATE TABLE public.historico_ipca (
  data_referencia date NOT NULL PRIMARY KEY,
  competencia date NOT NULL UNIQUE,
  variacao_mensal numeric NOT NULL,
  fator_mensal numeric NOT NULL,
  data_publicacao date,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.historico_ipca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "IPCA history publicly readable"
  ON public.historico_ipca FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert IPCA history"
  ON public.historico_ipca FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update IPCA history"
  ON public.historico_ipca FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete IPCA history"
  ON public.historico_ipca FOR DELETE TO authenticated USING (true);

-- Table: historico_ipca_projecao (IPCA projections between publications)
CREATE TABLE public.historico_ipca_projecao (
  competencia date NOT NULL PRIMARY KEY,
  variacao_projetada numeric NOT NULL,
  fator_projetado numeric NOT NULL,
  fonte text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.historico_ipca_projecao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "IPCA projection publicly readable"
  ON public.historico_ipca_projecao FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert IPCA projection"
  ON public.historico_ipca_projecao FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update IPCA projection"
  ON public.historico_ipca_projecao FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete IPCA projection"
  ON public.historico_ipca_projecao FOR DELETE TO authenticated USING (true);
