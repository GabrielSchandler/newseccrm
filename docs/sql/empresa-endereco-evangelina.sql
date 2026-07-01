-- Atualiza o endereco da empresa usado no rodape da simulacao/PDF.
-- Rode no Supabase SQL Editor.

update public.companies
set
  street = 'R. Evangelina',
  number = '321',
  district = 'Vila Carrão',
  city = 'São Paulo',
  state = 'SP',
  zip_code = '03421000',
  updated_at = now()
where id = 'ef4f2233-f4e9-43e8-ab6d-1bb41513d39d';
