-- Add poupanca_lote_id to movimentacoes to link resgates to specific poupança lots
ALTER TABLE public.movimentacoes
ADD COLUMN poupanca_lote_id uuid REFERENCES public.poupanca_lotes(id) ON DELETE SET NULL;