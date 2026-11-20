/**
 * Erro de negócio com status HTTP associado.
 * Lançado pelos services e convertido em resposta pelo middleware de erros.
 */
export class AppError extends Error {
  constructor(message, statusCode = 400, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }

  static badRequest(message, details) {
    return new AppError(message, 400, details);
  }

  static notFound(message = 'Recurso não encontrado') {
    return new AppError(message, 404);
  }

  static conflict(message) {
    return new AppError(message, 409);
  }
}
