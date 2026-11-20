import { Router } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler.js';

/**
 * Rotas da API (padrão REST):
 *
 *   GET    /nao-conformidades                 lista (filtros: status, gravidade, fornecedor, vencidas=true)
 *   GET    /nao-conformidades/:id             busca por id
 *   POST   /nao-conformidades                 abre uma NC (prazo calculado pela gravidade)
 *   PUT    /nao-conformidades/:id             atualiza dados cadastrais (todos os campos)
 *   PATCH  /nao-conformidades/:id             atualiza só os campos enviados
 *   DELETE /nao-conformidades/:id             exclui (só se ABERTA)
 *   PATCH  /nao-conformidades/:id/status      muda o status seguindo o fluxo
 *   GET    /nao-conformidades/:id/historico   histórico de status
 *   GET    /relatorios/vencidas               NCs em aberto com prazo estourado
 *   GET    /relatorios/fornecedores           ranking de fornecedores (pontuação por gravidade)
 */
export function createRoutes({ naoConformidadesController: c }) {
  const router = Router();

  router.get('/nao-conformidades', asyncHandler(c.listar));
  router.get('/nao-conformidades/:id', asyncHandler(c.buscarPorId));
  router.post('/nao-conformidades', asyncHandler(c.criar));
  router.put('/nao-conformidades/:id', asyncHandler(c.atualizar));
  router.patch('/nao-conformidades/:id', asyncHandler(c.atualizarParcial));
  router.delete('/nao-conformidades/:id', asyncHandler(c.remover));

  router.patch('/nao-conformidades/:id/status', asyncHandler(c.alterarStatus));
  router.get('/nao-conformidades/:id/historico', asyncHandler(c.listarHistorico));

  router.get('/relatorios/vencidas', asyncHandler(c.relatorioVencidas));
  router.get('/relatorios/fornecedores', asyncHandler(c.relatorioFornecedores));

  return router;
}
