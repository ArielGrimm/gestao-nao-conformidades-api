-- Execute este script no Supabase: SQL Editor > New query > Run.

create table if not exists nao_conformidades (
  id              bigint generated always as identity primary key,
  titulo          varchar(120)  not null,
  descricao       varchar(2000) not null,
  fornecedor      varchar(120)  not null,
  produto         varchar(120),
  responsavel     varchar(80),
  gravidade       varchar(10)   not null check (gravidade in ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA')),
  status          varchar(20)   not null default 'ABERTA'
                  check (status in ('ABERTA', 'EM_ANALISE', 'ACAO_CORRETIVA', 'ENCERRADA', 'CANCELADA')),
  prazo           date          not null,
  causa_raiz      varchar(1000),
  acao_corretiva  varchar(1000),
  aberto_em       timestamptz   not null default now(),
  encerrado_em    timestamptz,
  atualizado_em   timestamptz   not null default now()
);

create table if not exists historico_status (
  id                   bigint generated always as identity primary key,
  nao_conformidade_id  bigint      not null references nao_conformidades(id) on delete cascade,
  status_anterior      varchar(20) not null,
  status_novo          varchar(20) not null,
  comentario           varchar(500),
  criado_em            timestamptz not null default now()
);

create index if not exists idx_nc_status on nao_conformidades (status);
create index if not exists idx_nc_fornecedor on nao_conformidades (fornecedor);
create index if not exists idx_historico_nc on historico_status (nao_conformidade_id);

-- Altera o status e grava o histórico na MESMA transação.
-- O "for update" trava a linha; se o status mudou desde a leitura feita pela API,
-- a operação é recusada (evita duas pessoas mudarem o status ao mesmo tempo).
-- A validação do fluxo (quais transições são permitidas) fica na API.
create or replace function alterar_status_nc(
  p_id bigint,
  p_status_anterior varchar,
  p_status_novo varchar,
  p_comentario varchar default null,
  p_causa_raiz varchar default null,
  p_acao_corretiva varchar default null,
  p_encerrado_em timestamptz default null
) returns historico_status
language plpgsql
as $$
declare
  v_status_atual varchar;
  v_hist historico_status;
begin
  select status into v_status_atual from nao_conformidades where id = p_id for update;
  if not found then
    raise exception 'NC_NAO_ENCONTRADA';
  end if;
  if v_status_atual <> p_status_anterior then
    raise exception 'STATUS_DESATUALIZADO';
  end if;

  update nao_conformidades
     set status = p_status_novo,
         causa_raiz = p_causa_raiz,
         acao_corretiva = p_acao_corretiva,
         encerrado_em = p_encerrado_em,
         atualizado_em = now()
   where id = p_id;

  insert into historico_status (nao_conformidade_id, status_anterior, status_novo, comentario)
  values (p_id, p_status_anterior, p_status_novo, p_comentario)
  returning * into v_hist;

  return v_hist;
end;
$$;

-- Segurança: na aula o RLS foi desativado por ser ambiente acadêmico.
-- Se mantiver o RLS ATIVO (recomendado), use no .env a chave "service_role"
-- APENAS no servidor (nunca no front-end nem no GitHub).
