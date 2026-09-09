-- ============================================================================
-- BAIRRO ESCRITO À MÃO
-- ----------------------------------------------------------------------------
-- Quem escolhe "Outro bairro de Luanda" passa a escrever o nome do seu bairro.
-- O campo `bairro` continua a ser o da lista fechada, com o CHECK intacto, e é
-- ele que a rubrica usa para pontuar; `bairro_outro` é só para se ler e contar.
--
-- Corre isto uma vez no SQL Editor. Não apaga nada e pode correr duas vezes
-- sem estragar.
-- ============================================================================

alter table public.candidatos
  add column if not exists bairro_outro text;

comment on column public.candidatos.bairro_outro is
  'Bairro escrito pelo candidato, só quando bairro = ''Outro bairro de Luanda''. Não entra na pontuação.';

-- Coerência: só há texto aqui quando o bairro é o de fora da zona, e quando é
-- o de fora tem mesmo de haver texto. Sem isto ficávamos com um campo cheio de
-- casos meios preenchidos que ninguém sabe interpretar daqui a três meses.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'candidatos_bairro_outro_coerente'
  ) then
    alter table public.candidatos add constraint candidatos_bairro_outro_coerente
      check (
        (bairro = 'Outro bairro de Luanda' and btrim(coalesce(bairro_outro, '')) <> '')
        or
        (bairro <> 'Outro bairro de Luanda' and bairro_outro is null)
      ) not valid;
  end if;
end $$;

-- NOT VALID acima: a restrição vale para tudo o que entrar de agora em diante,
-- mas não rejeita as candidaturas que já lá estão sem este campo preenchido.
-- Quando não houver linhas antigas por corrigir, podes validá-la com:
--   alter table public.candidatos validate constraint candidatos_bairro_outro_coerente;

create index if not exists idx_candidatos_bairro_outro
  on public.candidatos (bairro_outro) where bairro_outro is not null;

-- A vista do resumo passa a agrupar pelo bairro que se lê.
drop view if exists public.vw_resumo_bairro;
create view public.vw_resumo_bairro as
select
  municipio,
  case
    when bairro = 'Outro bairro de Luanda' and btrim(coalesce(bairro_outro, '')) <> ''
      then btrim(bairro_outro)
    else bairro
  end                                               as bairro,
  bairro = 'Outro bairro de Luanda'                 as fora_da_zona,
  count(*)                                          as total,
  count(*) filter (where tem_carta)                 as com_carta,
  count(*) filter (where usa_ferramentas_digitais)  as com_digital,
  count(*) filter (where experiencia_similar)       as com_experiencia,
  count(*) filter (where atendimento_publico)       as com_atendimento,
  count(*) filter (where status = 'Aprovado')       as aprovados,
  count(*) filter (where status = 'Pendente')       as pendentes
from public.candidatos
group by 1, 2, 3
order by total desc;
