import { PESO_GRAVIDADE, GRAVIDADES, STATUS_FINAIS, diasDeAtraso } from '../domain/regras.js';

/**
 * Relatórios gerenciais — o diferencial ("inovação") do projeto.
 */
export function createRelatoriosService({ naoConformidadesRepository, agora = () => new Date() }) {
  const repo = naoConformidadesRepository;

  return {
    /** NCs em aberto com prazo estourado, das mais atrasadas/graves para as menos. */
    async vencidas() {
      const hoje = agora();
      const todas = await repo.listar({});
      return todas
        .filter((nc) => !STATUS_FINAIS.includes(nc.status))
        .map((nc) => ({
          id: nc.id,
          codigo: nc.codigo,
          titulo: nc.titulo,
          fornecedor: nc.fornecedor,
          gravidade: nc.gravidade,
          status: nc.status,
          responsavel: nc.responsavel,
          prazo: nc.prazo,
          diasAtraso: diasDeAtraso(nc.prazo, hoje),
        }))
        .filter((nc) => nc.diasAtraso > 0)
        .sort((a, b) => b.diasAtraso - a.diasAtraso || PESO_GRAVIDADE[b.gravidade] - PESO_GRAVIDADE[a.gravidade]);
    },

    /**
     * Ranking de fornecedores por pontuação ponderada de gravidade
     * (BAIXA=1, MEDIA=3, ALTA=5, CRITICA=10). NCs canceladas não contam.
     */
    async rankingFornecedores() {
      const hoje = agora();
      // Ordem de abertura: o nome exibido é o da primeira NC registrada do fornecedor.
      const todas = (await repo.listar({})).sort((a, b) => a.id - b.id);
      const grupos = new Map();

      for (const nc of todas) {
        if (nc.status === 'CANCELADA') continue;
        const chave = nc.fornecedor.trim().toUpperCase();
        if (!grupos.has(chave)) {
          grupos.set(chave, {
            fornecedor: nc.fornecedor.trim(),
            total: 0,
            emAberto: 0,
            vencidas: 0,
            porGravidade: Object.fromEntries(GRAVIDADES.map((g) => [g, 0])),
            pontuacao: 0,
          });
        }
        const g = grupos.get(chave);
        g.total += 1;
        g.porGravidade[nc.gravidade] += 1;
        g.pontuacao += PESO_GRAVIDADE[nc.gravidade];
        if (nc.status !== 'ENCERRADA') {
          g.emAberto += 1;
          if (diasDeAtraso(nc.prazo, hoje) > 0) g.vencidas += 1;
        }
      }

      return [...grupos.values()].sort((a, b) => b.pontuacao - a.pontuacao || b.total - a.total);
    },
  };
}
