import { AppError } from '../utils/AppError.js';

/** Rota não encontrada. */
export function notFoundHandler(req, res) {
  res.status(404).json({ erro: `Rota ${req.method} ${req.path} não encontrada.` });
}

/**
 * Converte erros em respostas JSON padronizadas.
 * Erros inesperados viram 500 sem expor detalhes internos (stack, mensagens do banco).
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ erro: err.message, detalhes: err.details });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' });
  }
  console.error(err);
  return res.status(500).json({ erro: 'Erro interno do servidor.' });
}
