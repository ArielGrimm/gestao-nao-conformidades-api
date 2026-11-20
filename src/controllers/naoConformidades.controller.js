import { parseId } from '../utils/validators.js';

/**
 * Controllers: só traduzem HTTP <-> service. Nenhuma regra de negócio aqui.
 * Erros lançados pelos services seguem para o middleware de erros.
 */
export function createNaoConformidadesController({ naoConformidadesService, relatoriosService }) {
  return {
    async listar(req, res) {
      res.status(200).json(await naoConformidadesService.listar(req.query));
    },

    async buscarPorId(req, res) {
      res.status(200).json(await naoConformidadesService.buscarPorId(parseId(req.params.id)));
    },

    async criar(req, res) {
      const nc = await naoConformidadesService.criar(req.body);
      res.status(201).location(`/nao-conformidades/${nc.id}`).json(nc);
    },

    async atualizar(req, res) {
      res.status(200).json(await naoConformidadesService.atualizar(parseId(req.params.id), req.body));
    },

    async atualizarParcial(req, res) {
      res.status(200).json(await naoConformidadesService.atualizarParcial(parseId(req.params.id), req.body));
    },

    async remover(req, res) {
      await naoConformidadesService.remover(parseId(req.params.id));
      res.status(204).send();
    },

    async alterarStatus(req, res) {
      res.status(200).json(await naoConformidadesService.alterarStatus(parseId(req.params.id), req.body));
    },

    async listarHistorico(req, res) {
      res.status(200).json(await naoConformidadesService.listarHistorico(parseId(req.params.id)));
    },

    async relatorioVencidas(req, res) {
      res.status(200).json(await relatoriosService.vencidas());
    },

    async relatorioFornecedores(req, res) {
      res.status(200).json(await relatoriosService.rankingFornecedores());
    },
  };
}
