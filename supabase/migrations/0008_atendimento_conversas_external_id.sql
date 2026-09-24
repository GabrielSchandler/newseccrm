-- Aditiva: conversations ainda nao tem coluna pra rastrear o ID externo da
-- sessao de origem (necessario pra importacao de historico do Totalk —
-- Prioridade 1 do ciclo atual). Sem isso, uma reimportacao que perdesse o
-- checkpoint local (scripts/totalk-importer/.checkpoint/estado.json, que e
-- so estado local em disco, nao fonte de verdade) nao teria como saber que
-- uma sessao do Totalk ja virou uma conversation no NewSec — criaria
-- duplicata. messages ja tem "external_id" unico por conversa (0004);
-- conversations precisa do equivalente, unico por canal (canal ja carrega
-- company_id+provider, nao precisa repetir provider aqui).
--
-- contacts NAO precisa de coluna equivalente: contact_phone_numbers ja tem
-- unique (company_id, phone_e164), telefone e a chave natural de dedupe de
-- contato (conforme o desenho da Entrega C — um contato pode ter varios
-- telefones/conversas, vinculo com contato e feito por telefone, nao por id
-- externo de um provedor especifico).
--
-- Pre-condicao: 0001-0007 aplicadas.

alter table public.conversations add column external_id text;

comment on column public.conversations.external_id is
    'ID da sessao/conversa na origem (ex: Totalk), quando a conversa veio de importacao de historico. Null pra conversas nascidas no proprio NewSec (webhook/simulado). Unico por canal — ver conversations_external_unique.';

create unique index conversations_external_unique on public.conversations (channel_id, external_id) where external_id is not null;
