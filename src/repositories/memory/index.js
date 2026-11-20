import { AppError } from '../../utils/AppError.js';
import { codigoNc } from '../../domain/regras.js';

/**
 * Repositório em memória (equivalente ao "vetor" das aulas / H2).
 * Usado nos testes e no desenvolvimento local. Os dados somem ao reiniciar.
 * Segue exatamente o mesmo contrato do repositório do Supabase.
 */
export function createMemoryRepositories() {
  const ncs = new Map();
  const historico = [];
  let proximoId = 1;
  let proximoHistoricoId = 1;

  const copiar = (obj) => (obj ? { ...obj } : null);

  const naoConformidadesRepository = {
    async listar({ status, gravidade, fornecedor } = {}) {
      const termo = fornecedor?.toLowerCase();
      return [...ncs.values()]
        .filter((nc) => !status || nc.status === status)
        .filter((nc) => !gravidade || nc.gravidade === gravidade)
        .filter((nc) => !termo || nc.fornecedor.toLowerCase().includes(termo))
        .map(copiar)
        .sort((a, b) => b.id - a.id);
    },

    async buscarPorId(id) {
      return copiar(ncs.get(id));
    },

    async criar(dados) {
      const id = proximoId++;
      const nc = {
        id,
        codigo: codigoNc(id),
        ...dados,
        causaRaiz: null,
        acaoCorretiva: null,
        encerradoEm: null,
        atualizadoEm: dados.abertoEm,
      };
      ncs.set(id, nc);
      return copiar(nc);
    },

    async atualizar(id, dados) {
      const atual = ncs.get(id);
      if (!atual) return null;
      const atualizada = { ...atual, ...dados, atualizadoEm: new Date().toISOString() };
      ncs.set(id, atualizada);
      return copiar(atualizada);
    },

    async remover(id) {
      ncs.delete(id);
      for (let i = historico.length - 1; i >= 0; i--) {
        if (historico[i].naoConformidadeId === id) historico.splice(i, 1);
      }
    },

    /** Atualiza o status e grava o histórico juntos (como a função SQL no Supabase). */
    async alterarStatus({ id, statusAnterior, statusNovo, comentario, causaRaiz, acaoCorretiva, encerradoEm }) {
      const nc = ncs.get(id);
      if (!nc) throw AppError.notFound('Não conformidade não encontrada.');
      // Controle de concorrência: alguém pode ter mudado o status no meio do caminho.
      if (nc.status !== statusAnterior) throw AppError.conflict('O status foi alterado por outra operação. Tente novamente.');

      const agora = new Date().toISOString();
      Object.assign(nc, { status: statusNovo, causaRaiz, acaoCorretiva, encerradoEm, atualizadoEm: agora });
      const registro = {
        id: proximoHistoricoId++,
        naoConformidadeId: id,
        statusAnterior,
        statusNovo,
        comentario: comentario ?? null,
        criadoEm: agora,
      };
      historico.push(registro);
      return { naoConformidade: copiar(nc), historico: copiar(registro) };
    },

    async listarHistorico(id) {
      return historico
        .filter((h) => h.naoConformidadeId === id)
        .map(copiar)
        .sort((a, b) => a.id - b.id);
    },
  };

  return { naoConformidadesRepository };
}
