-- ============================================================================
-- CONSULVOLT - Recrutamento "TÉCNICO DE CADASTRO"
-- Projecto: Cadastro de Locais de Consumo de Água - EPAL / UGP
--
-- Esquema completo, num só ficheiro. Correr TUDO de uma vez no SQL Editor do
-- Supabase, num projecto NOVO E VAZIO.
--
-- Idempotente: pode correr-se mais que uma vez sem partir nada.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TIPOS
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'status_candidatura') then
    create type public.status_candidatura as enum (
      'Pendente', 'Aprovado', 'Reprovado', 'Contactado'
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. CANDIDATOS
--    O município e o bairro são texto com CHECK, e não ENUM: a lista muda com
--    a divisão administrativa, e um CHECK altera-se sem as dores de um
--    ALTER TYPE bloqueado por vistas dependentes.
-- ----------------------------------------------------------------------------

create table if not exists public.candidatos (
  id                       uuid primary key default gen_random_uuid(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  -- Identificação
  nome                     text not null,
  bi                       text not null unique,
  provincia                text not null default 'Luanda',
  municipio                text not null,
  bairro                   text not null,
  telefone                 text not null,
  email                    text not null unique,

  -- Perfil
  nivel_academico          text not null,
  curso                    text,

  -- As três perguntas que este trabalho pede de verdade
  experiencia_similar      boolean not null default false, -- cadastro, censo, inquérito no terreno
  usa_ferramentas_digitais boolean not null default false, -- tablet, GPS, formulários digitais
  atendimento_publico      boolean not null default false, -- lidar com moradores à porta
  tem_carta                boolean not null default false,

  condicoes_aceites        boolean not null default false,

  -- Gestão do processo
  status                   public.status_candidatura not null default 'Pendente',
  observacoes              text,

  -- Arquivo documental
  drive_folder_url         text,
  drive_folder_id          text,
  cv_url                   text,
  bi_url                   text,
  certificado_url          text,
  experiencia_url          text,

  arquivamento_estado      text not null default 'pendente'
    check (arquivamento_estado in ('pendente','concluido','erro')),
  arquivamento_erro        text,

  -- Entrevista (colunas antigas, mantidas para as vistas simples)
  entrevista_em            timestamptz,
  entrevista_local         text,
  entrevista_notas         text,

  constraint candidatos_email_valido check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint candidatos_bi_valido    check (char_length(btrim(bi)) between 5 and 30),
  constraint candidatos_tel_valido   check (char_length(regexp_replace(telefone, '\D', '', 'g')) between 9 and 15)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'candidatos_municipio_valido'
  ) then
    alter table public.candidatos add constraint candidatos_municipio_valido
      check (municipio in (
        'Belas','Cacuaco','Cazenga','Icolo e Bengo','Kilamba Kiaxi',
        'Luanda','Quiçama','Talatona','Viana'
      ));
  end if;

  -- Os doze bairros da UGP mais a saída para quem mora fora. Tem de bater
  -- certo com BAIRROS_OPCOES, em src/lib/constantes.ts: se um dia a lista
  -- mudar, muda-se nos dois sítios (drop constraint / add constraint).
  if not exists (
    select 1 from pg_constraint where conname = 'candidatos_bairro_valido'
  ) then
    alter table public.candidatos add constraint candidatos_bairro_valido
      check (bairro in (
        'Cabolombo','Casas Brancas','Cawelele','Corimba','Costa do Sol',
        'Futungo de Belas','Gamek','Imbondeiro','Inorade','Morro Bento I',
        'Morro Bento II','Morro da Luz','Outro bairro de Luanda'
      ));
  end if;
end $$;

create index if not exists idx_candidatos_data      on public.candidatos (created_at desc);
create index if not exists idx_candidatos_status    on public.candidatos (status);
create index if not exists idx_candidatos_municipio on public.candidatos (municipio);
create index if not exists idx_candidatos_bairro    on public.candidatos (bairro);
create index if not exists idx_candidatos_entrevista
  on public.candidatos (entrevista_em) where entrevista_em is not null;

-- Normaliza o que entra, para o painel não ter de andar a limpar depois.
create or replace function public.normalizar_candidato() returns trigger
language plpgsql as $$
begin
  new.nome     := btrim(regexp_replace(new.nome, '\s+', ' ', 'g'));
  new.email    := lower(btrim(new.email));
  new.bi       := upper(btrim(new.bi));
  new.telefone := regexp_replace(new.telefone, '\D', '', 'g');
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_normalizar_candidato on public.candidatos;
create trigger trg_normalizar_candidato
  before insert or update on public.candidatos
  for each row execute function public.normalizar_candidato();

-- ----------------------------------------------------------------------------
-- 3. DEFINIÇÕES DO CONCURSO
--    O prazo e o número de vagas mudam-se no painel, sem tocar no código.
--    Uma linha só, travada pela chave primária booleana.
-- ----------------------------------------------------------------------------

create table if not exists public.definicoes (
  id                boolean primary key default true check (id),
  prazo_candidaturas timestamptz,
  vagas_previstas   int not null default 12 check (vagas_previstas between 1 and 500),
  candidaturas_abertas boolean not null default true,
  mensagem_encerrado text,
  actualizado_em    timestamptz not null default now(),
  actualizado_por   text
);

insert into public.definicoes (id) values (true) on conflict (id) do nothing;

comment on column public.definicoes.vagas_previstas is
  'Quantos técnicos se pretende contratar. NÃO aparece no formulário público.';

-- ----------------------------------------------------------------------------
-- 4. UTILIZADORES DO PAINEL
-- ----------------------------------------------------------------------------

create table if not exists public.utilizadores_painel (
  id                        uuid primary key default gen_random_uuid(),
  criado_em                 timestamptz not null default now(),
  utilizador                text not null unique,
  nome                      text not null,
  email                     text,
  telefone                  text,
  papel                     text not null default 'visualizador'
                              check (papel in ('admin','gestor','editor','visualizador')),
  palavra_passe_hash        text not null,
  activo                    boolean not null default true,
  criado_por                text,
  ultimo_acesso             timestamptz,
  deve_trocar_palavra_passe boolean not null default true,
  palavra_passe_alterada_em timestamptz,
  credenciais_enviadas_em   timestamptz
);

create index if not exists idx_utilizadores_activos
  on public.utilizadores_painel (utilizador) where activo;

create table if not exists public.emails_equipa (
  id           uuid primary key default gen_random_uuid(),
  criado_em    timestamptz not null default now(),
  destinatario text not null,
  tipo         text not null check (tipo in ('conta_criada','palavra_passe_reposta','aviso')),
  assunto      text not null,
  estado       text not null default 'enviado' check (estado in ('enviado','erro')),
  erro         text,
  enviado_por  text
);

-- ----------------------------------------------------------------------------
-- 5. COMUNICAÇÕES
-- ----------------------------------------------------------------------------

create table if not exists public.emails_enviados (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  candidato_id uuid not null references public.candidatos(id) on delete cascade,
  tipo         text not null check (tipo in (
                 'confirmacao','aprovacao','entrevista','reprovacao',
                 'personalizado','rh','formacao','teste_fluxo','reuniao'
               )),
  destinatario text not null,
  assunto      text not null,
  resumo       text,
  estado       text not null default 'enviado' check (estado in ('enviado','erro')),
  erro         text,
  enviado_por  text
);

create index if not exists idx_emails_candidato on public.emails_enviados (candidato_id, created_at desc);

create table if not exists public.eventos_candidato (
  id            uuid primary key default gen_random_uuid(),
  criado_em     timestamptz not null default now(),
  candidato_id  uuid not null references public.candidatos(id) on delete cascade,
  fase          text not null check (fase in ('entrevista','formacao','teste_fluxo','reuniao')),
  quando        timestamptz not null,
  local         text not null,
  observacoes   text,
  email_enviado boolean not null default false,
  criado_por    text
);

create index if not exists idx_eventos_candidato on public.eventos_candidato (candidato_id);
create index if not exists idx_eventos_quando    on public.eventos_candidato (quando);

-- ----------------------------------------------------------------------------
-- 6. ANÁLISE DOS DOCUMENTOS E RANKING
-- ----------------------------------------------------------------------------

create table if not exists public.documentos_texto (
  id             uuid primary key default gen_random_uuid(),
  criado_em      timestamptz not null default now(),
  candidato_id   uuid not null references public.candidatos(id) on delete cascade,
  drive_file_id  text not null unique,
  tipo_documento text not null,
  nome_ficheiro  text not null,
  sha256         text,
  texto          text,
  legivel        boolean generated always as (coalesce(length(texto), 0) >= 120) stored,
  erro           text
);

create index if not exists idx_texto_candidato on public.documentos_texto (candidato_id);

create table if not exists public.analises_candidato (
  id                uuid primary key default gen_random_uuid(),
  criado_em         timestamptz not null default now(),
  actualizado_em    timestamptz not null default now(),
  candidato_id      uuid not null references public.candidatos(id) on delete cascade,
  versao_rubrica    text not null,
  hash_documentos   text not null,
  pontuacao_total   numeric(6,2),
  pontuacao_detalhe jsonb,
  extraccao         jsonb,
  alertas           jsonb not null default '[]'::jsonb,
  eliminado         boolean not null default false,
  motivo_eliminacao text,
  modelo            text,
  tokens_entrada    int,
  tokens_saida      int,
  estado            text not null default 'pendente'
                      check (estado in ('pendente','a_processar','concluida','erro')),
  erro              text,
  tentativas        int not null default 0,
  unique (candidato_id, versao_rubrica, hash_documentos)
);

create index if not exists idx_analises_candidato on public.analises_candidato (candidato_id);
create index if not exists idx_analises_estado    on public.analises_candidato (estado);

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
--    Público (chave publishable) => só INSERE candidaturas.
--    O painel corre no servidor com a chave secreta, que ignora o RLS.
-- ----------------------------------------------------------------------------

alter table public.candidatos          enable row level security;
alter table public.definicoes          enable row level security;
alter table public.utilizadores_painel enable row level security;
alter table public.emails_equipa       enable row level security;
alter table public.emails_enviados     enable row level security;
alter table public.eventos_candidato   enable row level security;
alter table public.documentos_texto    enable row level security;
alter table public.analises_candidato  enable row level security;

drop policy if exists "publico_pode_inserir_candidatura" on public.candidatos;
create policy "publico_pode_inserir_candidatura"
  on public.candidatos for insert to anon, authenticated with check (true);

drop policy if exists "autenticados_podem_ler" on public.candidatos;
create policy "autenticados_podem_ler"
  on public.candidatos for select to authenticated using (true);

-- O formulário público precisa de saber se as candidaturas ainda estão
-- abertas e qual é o prazo. É a única coisa que o anónimo lê.
drop policy if exists "publico_le_definicoes" on public.definicoes;
create policy "publico_le_definicoes"
  on public.definicoes for select to anon, authenticated using (true);

-- As restantes tabelas não têm policy nenhuma de propósito: só a chave
-- secreta, que corre no servidor da aplicação, lá chega.

-- ----------------------------------------------------------------------------
-- 8. STORAGE - bucket privado, 700 KB por ficheiro
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos-candidatos', 'documentos-candidatos', false,
  716800, array['application/pdf','image/jpeg','image/png']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public             = excluded.public;

drop policy if exists "publico_pode_enviar_documentos" on storage.objects;
create policy "publico_pode_enviar_documentos"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'documentos-candidatos');

drop policy if exists "autenticados_podem_ler_documentos" on storage.objects;
create policy "autenticados_podem_ler_documentos"
  on storage.objects for select to authenticated
  using (bucket_id = 'documentos-candidatos');

-- ----------------------------------------------------------------------------
-- 9. VISTAS DE APOIO
-- ----------------------------------------------------------------------------

drop view if exists public.vw_resumo_bairro;
create view public.vw_resumo_bairro as
select
  municipio,
  bairro,
  count(*)                                          as total,
  count(*) filter (where tem_carta)                 as com_carta,
  count(*) filter (where usa_ferramentas_digitais)  as com_digital,
  count(*) filter (where experiencia_similar)       as com_experiencia,
  count(*) filter (where atendimento_publico)       as com_atendimento,
  count(*) filter (where status = 'Aprovado')       as aprovados,
  count(*) filter (where status = 'Pendente')       as pendentes
from public.candidatos
group by municipio, bairro
order by total desc;

drop view if exists public.vw_ranking;
create view public.vw_ranking as
select distinct on (a.candidato_id)
  a.candidato_id,
  a.pontuacao_total,
  a.pontuacao_detalhe,
  a.alertas,
  a.eliminado,
  a.motivo_eliminacao,
  a.versao_rubrica,
  a.estado,
  a.criado_em as analisado_em
from public.analises_candidato a
order by a.candidato_id, a.criado_em desc;

-- ============================================================================
-- FIM
-- ============================================================================
