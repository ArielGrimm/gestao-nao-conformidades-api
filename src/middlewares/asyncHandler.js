/** Repassa erros de funções async para o middleware de erros do Express. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
