import express from 'express';
import { createNaoConformidadesService } from './services/naoConformidades.service.js';
import { createRelatoriosService } from './services/relatorios.service.js';
import { createNaoConformidadesController } from './controllers/naoConformidades.controller.js';
import { createRoutes } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

/**
 * Monta a aplicação recebendo os repositórios por parâmetro (injeção de dependência).
 * Assim os testes usam o repositório em memória e a produção usa o Supabase,
 * sem mudar nenhuma linha das regras de negócio.
 * `agora` permite que os testes simulem datas (prazos vencidos).
 */
export function createApp({ naoConformidadesRepository, agora }) {
  const naoConformidadesService = createNaoConformidadesService({ naoConformidadesRepository, agora });
  const relatoriosService = createRelatoriosService({ naoConformidadesRepository, agora });
  const naoConformidadesController = createNaoConformidadesController({ naoConformidadesService, relatoriosService });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
  app.use(createRoutes({ naoConformidadesController }));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
