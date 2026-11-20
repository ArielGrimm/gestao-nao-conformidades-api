import { AppError } from '../utils/AppError.js';
import {
  textoObrigatorio,
  textoOpcional,
  valorDaLista,
  lancarSeHouverErros,
} from '../utils/validators.js';
import {
  GRAVIDADES,
  STATUS,
  STATUS_FINAIS,
  TRANSICOES,
  calcularPrazo,
  diasDeAtraso,
} from '../domain/regras.js';

/** Campos que o usuário pode informar/alterar (o restante é controlado pela API). */
const CAMPOS_CADASTRAIS = ['titulo', 'descricao', 'fornecedor', 'produto', 'responsavel', 'gravidade'];

/**
 * Regras de negócio das Não Conformidades (NC).
 *
 * Decisões de projeto:
 * - O STATUS não muda pelo PUT: só pela rota de status, que valida o fluxo
 *   e grava o histórico (rastreabilidade de quem fez o quê e quando).
 * - O PRAZO é calculado pela gravidade (não é informado pelo usuário).
 * - NC encerrada ou cancelada não pode mais ser editada.
 *
 * `agora` é injetável para os testes controlarem a data.
 */
export function createNaoConformidadesService({ naoConformidadesRepository, agora = () => new Date() }) {
  const repo = naoConformidadesRepository;

  /** Acrescenta campos calculados (vencida e diasAtraso) a uma NC. */
  function enriquecer(nc) {
    const emAberto = !STATUS_FINAIS.includes(nc.status);
    const atraso = emAberto ? diasDeAtraso(nc.prazo, agora()) : 0;
    return { ...nc, vencida: atraso > 0, diasAtraso: atraso };
  }

  function validarDadosCadastrais(body = {}) {
    const erros = [];
    for (const campo of ['status', 'prazo', 'abertoEm', 'encerradoEm']) {
      if (campo in body) erros.push(`${campo} não pode ser informado diretamente.`);
    }
    const dados = {
      titulo: textoObrigatorio(body.titulo, 'titulo', erros, 120),
      descricao: textoObrigatorio(body.descricao, 'descricao', erros, 2000),
      fornecedor: textoObrigatorio(body.fornecedor, 'fornecedor', erros, 120),
      produto: textoOpcional(body.produto, 'produto', erros, 120),
      responsavel: textoOpcional(body.responsavel, 'responsavel', erros, 80),
      gravidade: valorDaLista(body.gravidade, 'gravidade', GRAVIDADES, erros),
    };
    lancarSeHouverErros(erros);
    return dados;
  }

  function validarFiltros(query = {}) {
    const erros = [];
    const filtros = {};
    if (query.status) filtros.status = valorDaLista(query.status, 'status', STATUS, erros);
    if (query.gravidade) filtros.gravidade = valorDaLista(query.gravidade, 'gravidade', GRAVIDADES, erros);
    if (query.fornecedor) filtros.fornecedor = textoOpcional(query.fornecedor, 'fornecedor', erros, 120);
    lancarSeHouverErros(erros);
    return filtros;
  }

  async function buscarOuFalhar(id) {
    const nc = await repo.buscarPorId(id);
    if (!nc) throw AppError.notFound('Não conformidade não encontrada.');
    return nc;
  }

  function garantirEditavel(nc) {
    if (STATUS_FINAIS.includes(nc.status)) {
      throw AppError.conflict(`A NC ${nc.codigo} está ${nc.status} e não pode mais ser alterada.`);
    }
  }

  return {
    async listar(query = {}) {
      const filtros = validarFiltros(query);
      const lista = (await repo.listar(filtros)).map(enriquecer);
      return query.vencidas === 'true' ? lista.filter((nc) => nc.vencida) : lista;
    },

    async buscarPorId(id) {
      return enriquecer(await buscarOuFalhar(id));
    },

    async criar(body) {
      const dados = validarDadosCadastrais(body);
      const abertoEm = agora().toISOString();
      const nc = await repo.criar({
        ...dados,
        status: 'ABERTA',
        abertoEm,
        prazo: calcularPrazo(abertoEm, dados.gravidade),
      });
      return enriquecer(nc);
    },

    async atualizar(id, body) {
      const dados = validarDadosCadastrais(body);
      const atual = await buscarOuFalhar(id);
      garantirEditavel(atual);
      // Se a gravidade mudou, o prazo é recalculado a partir da data de abertura.
      const prazo = calcularPrazo(atual.abertoEm, dados.gravidade);
      return enriquecer(await repo.atualizar(id, { ...dados, prazo }));
    },

    /**
     * Atualização parcial (PATCH): só os campos enviados mudam.
     * Os campos enviados são combinados com os atuais e validados juntos,
     * garantindo as mesmas regras do PUT.
     */
    async atualizarParcial(id, body = {}) {
      const camposEnviados = CAMPOS_CADASTRAIS.filter((campo) => campo in body);
      const proibidos = ['status', 'prazo', 'abertoEm', 'encerradoEm'].some((campo) => campo in body);
      if (camposEnviados.length === 0 && !proibidos) {
        throw AppError.badRequest(`Envie ao menos um destes campos: ${CAMPOS_CADASTRAIS.join(', ')}.`);
      }

      const atual = await buscarOuFalhar(id);
      const combinado = Object.fromEntries(CAMPOS_CADASTRAIS.map((campo) => [campo, atual[campo]]));
      for (const campo of camposEnviados) combinado[campo] = body[campo];
      for (const campo of ['status', 'prazo', 'abertoEm', 'encerradoEm']) {
        if (campo in body) combinado[campo] = body[campo]; // para a validação recusar
      }

      const dados = validarDadosCadastrais(combinado);
      garantirEditavel(atual);
      const prazo = calcularPrazo(atual.abertoEm, dados.gravidade);
      return enriquecer(await repo.atualizar(id, { ...dados, prazo }));
    },

    async remover(id) {
      const nc = await buscarOuFalhar(id);
      if (nc.status !== 'ABERTA') {
        throw AppError.conflict('Só é possível excluir NC com status ABERTA. Para as demais, use o cancelamento.');
      }
      await repo.remover(id);
    },

    /**
     * Muda o status seguindo o fluxo definido em domain/regras.js.
     * - ACAO_CORRETIVA exige causaRaiz.
     * - ENCERRADA exige acaoCorretiva.
     * - CANCELADA exige comentario (justificativa).
     */
    async alterarStatus(id, body = {}) {
      const erros = [];
      const statusNovo = valorDaLista(body.status, 'status', STATUS, erros);
      const comentario = textoOpcional(body.comentario, 'comentario', erros, 500);
      const causaRaizInformada = textoOpcional(body.causaRaiz, 'causaRaiz', erros, 1000);
      const acaoInformada = textoOpcional(body.acaoCorretiva, 'acaoCorretiva', erros, 1000);
      lancarSeHouverErros(erros);

      const nc = await buscarOuFalhar(id);
      if (!TRANSICOES[nc.status].includes(statusNovo)) {
        throw AppError.conflict(
          `Transição ${nc.status} → ${statusNovo} não permitida. Permitidas: ${TRANSICOES[nc.status].join(', ') || 'nenhuma'}.`,
        );
      }

      const causaRaiz = causaRaizInformada ?? nc.causaRaiz;
      const acaoCorretiva = acaoInformada ?? nc.acaoCorretiva;
      const regras = [];
      if (statusNovo === 'ACAO_CORRETIVA' && !causaRaiz) regras.push('Informe a causaRaiz para seguir para ACAO_CORRETIVA.');
      if (statusNovo === 'ENCERRADA' && !acaoCorretiva) regras.push('Informe a acaoCorretiva para encerrar a NC.');
      if (statusNovo === 'CANCELADA' && !comentario) regras.push('Informe um comentario justificando o cancelamento.');
      lancarSeHouverErros(regras);

      const resultado = await repo.alterarStatus({
        id,
        statusAnterior: nc.status,
        statusNovo,
        comentario,
        causaRaiz,
        acaoCorretiva,
        encerradoEm: STATUS_FINAIS.includes(statusNovo) ? agora().toISOString() : null,
      });
      return { naoConformidade: enriquecer(resultado.naoConformidade), historico: resultado.historico };
    },

    async listarHistorico(id) {
      await buscarOuFalhar(id);
      return repo.listarHistorico(id);
    },
  };
}
