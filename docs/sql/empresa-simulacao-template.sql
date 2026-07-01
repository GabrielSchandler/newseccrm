-- Configuracao por empresa do bloco de seguranca contratual da simulacao.
-- Rode este arquivo no SQL Editor do Supabase.

begin;

alter table public.companies
  add column if not exists simulation_guarantee_title text,
  add column if not exists simulation_guarantee_lead text,
  add column if not exists simulation_guarantee_clause_label text,
  add column if not exists simulation_guarantee_clause_text text;

-- Mantem a clausula atual somente na empresa GRS.
-- Empresas novas, como Kairos, ficam sem texto especifico ate voce preencher
-- em Gestao > Empresa > Texto da simulacao.
update public.companies
set
  simulation_guarantee_title = 'Seguranca contratual',
  simulation_guarantee_lead = 'Nossa prestacao de servico conta com protecao contratual especifica, com previsao de devolucao integral do valor investido nas hipoteses previstas em contrato.',
  simulation_guarantee_clause_label = 'Clausula 3.6 do contrato',
  simulation_guarantee_clause_text = '3.6 - A CONTRATADA garante a plena execucao dos servicos contratados, comprometendo-se a promover, conforme o caso, a reducao das parcelas, a quitacao do debito, a restituicao de encargos eventualmente cobrados de forma indevida, ou, nao sendo apresentada qualquer uma das opcoes mencionadas, a devolucao integral do valor investido pela CONTRATANTE a titulo de contratacao dos servicos.',
  updated_at = now()
where id = 'ef4f2233-f4e9-43e8-ab6d-1bb41513d39d'
  and (
    simulation_guarantee_title is null
    or simulation_guarantee_lead is null
    or simulation_guarantee_clause_label is null
    or simulation_guarantee_clause_text is null
  );

commit;
