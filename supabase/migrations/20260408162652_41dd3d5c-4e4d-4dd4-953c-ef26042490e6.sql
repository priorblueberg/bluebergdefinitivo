
-- Criar tabela historico_dolar
CREATE TABLE public.historico_dolar (
  data date NOT NULL PRIMARY KEY,
  cotacao_venda numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.historico_dolar ENABLE ROW LEVEL SECURITY;

-- Leitura pública (mesmo padrão de historico_selic, historico_tr)
CREATE POLICY "Dolar history publicly readable"
  ON public.historico_dolar
  FOR SELECT
  USING (true);

-- Inserção por autenticados (usado pela edge function via service role)
CREATE POLICY "Authenticated users can insert dolar history"
  ON public.historico_dolar
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Update por autenticados
CREATE POLICY "Authenticated users can update dolar history"
  ON public.historico_dolar
  FOR UPDATE
  TO authenticated
  USING (true);

-- Delete por autenticados
CREATE POLICY "Authenticated users can delete dolar history"
  ON public.historico_dolar
  FOR DELETE
  TO authenticated
  USING (true);
