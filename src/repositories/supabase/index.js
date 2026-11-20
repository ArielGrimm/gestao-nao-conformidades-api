import { createClient } from '@supabase/supabase-js';
import { AppError } from '../../utils/AppError.js';
import { codigoNc } from '../../domain/regras.js';

/**
 * Repositório usando o Supabase (PostgreSQL na nuvem), como na aula da semana 3.
 * O banco usa snake_case; a API expõe camelCase — as funções abaixo convertem.
 * O cliente do Supabase monta as consultas de forma parametrizada (sem concatenar SQL).
 */

const paraNc = (row) =>
  row && {
    id: row.id,
    codigo: codigoNc(row.id),
    titulo: row.titulo,
    descricao: row.descricao,
    fornecedor: row.fornecedor,
    produto: row.produto,
    responsavel: row.responsavel,
    gravidade: row.gravidade,
    status: row.status,
    prazo: row.prazo,
    causaRaiz: row.causa_raiz,
    acaoCorretiva: row.acao_corretiva,
    abertoEm: row.aberto_em,
    encerradoEm: row.encerrado_em,
    atualizadoEm: row.atualizado_em,
  };

const paraHistorico = (row) =>
  row && {
    id: row.id,
    naoConformidadeId: row.nao_conformidade_id,
    statusAnterior: row.status_anterior,
    statusNovo: row.status_novo,
    comentario: row.comentario,
    criadoEm: row.criado_em,
  };

const paraColunas = (dados) => {
  const mapa = {
    titulo: 'titulo',
    descricao: 'descricao',
    fornecedor: 'fornecedor',
    produto: 'produto',
    responsavel: 'responsavel',
    gravidade: 'gravidade',
    status: 'status',
    prazo: 'prazo',
    abertoEm: 'aberto_em',
  };
  return Object.fromEntries(
    Object.entries(dados).filter(([k]) => k in mapa).map(([k, v]) => [mapa[k], v]),
  );
};

/** Escapa curingas do LIKE para o texto digitado ser buscado literalmente. */
const escaparLike = (texto) => texto.replace(/[\\%_]/g, (c) => `\\${c}`);

function verificarErro(error) {
  if (!error) return;
  // Não repassa detalhes internos do banco ao cliente; registra no log do servidor.
  console.error('[supabase]', error.code, error.message);
  if (error.message?.includes('NC_NAO_ENCONTRADA')) throw AppError.notFound('Não conformidade não encontrada.');
  if (error.message?.includes('STATUS_DESATUALIZADO')) {
    throw AppError.conflict('O status foi alterado por outra operação. Tente novamente.');
  }
  throw new AppError('Erro ao acessar o banco de dados.', 500);
}

export function createSupabaseRepositories({ url, key }) {
  const supabase = createClient(url, key);

  const naoConformidadesRepository = {
    async listar({ status, gravidade, fornecedor } = {}) {
      let query = supabase.from('nao_conformidades').select('*').order('id', { ascending: false });
      if (status) query = query.eq('status', status);
      if (gravidade) query = query.eq('gravidade', gravidade);
      if (fornecedor) query = query.ilike('fornecedor', `%${escaparLike(fornecedor)}%`);
      const { data, error } = await query;
      verificarErro(error);
      return data.map(paraNc);
    },

    async buscarPorId(id) {
      const { data, error } = await supabase.from('nao_conformidades').select('*').eq('id', id).maybeSingle();
      verificarErro(error);
      return paraNc(data);
    },

    async criar(dados) {
      const { data, error } = await supabase.from('nao_conformidades').insert(paraColunas(dados)).select().single();
      verificarErro(error);
      return paraNc(data);
    },

    async atualizar(id, dados) {
      const { data, error } = await supabase
        .from('nao_conformidades')
        .update({ ...paraColunas(dados), atualizado_em: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle();
      verificarErro(error);
      return paraNc(data);
    },

    async remover(id) {
      const { error } = await supabase.from('nao_conformidades').delete().eq('id', id);
      verificarErro(error);
    },

    /** Usa a função SQL alterar_status_nc (database/schema.sql) para ser atômico. */
    async alterarStatus({ id, statusAnterior, statusNovo, comentario, causaRaiz, acaoCorretiva, encerradoEm }) {
      const { data, error } = await supabase.rpc('alterar_status_nc', {
        p_id: id,
        p_status_anterior: statusAnterior,
        p_status_novo: statusNovo,
        p_comentario: comentario,
        p_causa_raiz: causaRaiz,
        p_acao_corretiva: acaoCorretiva,
        p_encerrado_em: encerradoEm,
      });
      verificarErro(error);
      const historico = paraHistorico(Array.isArray(data) ? data[0] : data);
      const naoConformidade = await naoConformidadesRepository.buscarPorId(id);
      return { naoConformidade, historico };
    },

    async listarHistorico(id) {
      const { data, error } = await supabase
        .from('historico_status')
        .select('*')
        .eq('nao_conformidade_id', id)
        .order('id');
      verificarErro(error);
      return data.map(paraHistorico);
    },
  };

  return { naoConformidadesRepository };
}
