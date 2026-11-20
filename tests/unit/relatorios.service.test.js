import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createNaoConformidadesService } from '../../src/services/naoConformidades.service.js';
import { createRelatoriosService } from '../../src/services/relatorios.service.js';
import { createMemoryRepositories } from '../../src/repositories/memory/index.js';
import { criarRelogio, ncValida } from '../helpers.js';

describe('RelatoriosService', () => {
  let ncService;
  let relatorios;
  let relogio;

  beforeEach(async () => {
    relogio = criarRelogio();
    const repos = createMemoryRepositories();
    ncService = createNaoConformidadesService({ ...repos, agora: relogio.agora });
    relatorios = createRelatoriosService({ ...repos, agora: relogio.agora });

    await ncService.criar(ncValida({ fornecedor: 'Metalúrgica Alfa', gravidade: 'CRITICA' })); // prazo 03/11
    await ncService.criar(ncValida({ fornecedor: 'metalúrgica alfa ', gravidade: 'ALTA' }));    // prazo 08/11
    await ncService.criar(ncValida({ fornecedor: 'Plásticos Beta', gravidade: 'MEDIA' }));      // prazo 16/11
    const cancelada = await ncService.criar(ncValida({ fornecedor: 'Plásticos Beta', gravidade: 'CRITICA' }));
    await ncService.alterarStatus(cancelada.id, { status: 'CANCELADA', comentario: 'Duplicada' });
  });

  it('lista vencidas das mais atrasadas para as menos, ignorando status finais', async () => {
    relogio.avancarDias(10); // hoje = 11/11
    const vencidas = await relatorios.vencidas();
    assert.deepEqual(
      vencidas.map((v) => [v.gravidade, v.diasAtraso]),
      [
        ['CRITICA', 8],
        ['ALTA', 3],
      ],
    );
  });

  it('não lista nada enquanto tudo está no prazo', async () => {
    assert.deepEqual(await relatorios.vencidas(), []);
  });

  it('ranqueia fornecedores por pontuação, agrupando nomes iguais e ignorando canceladas', async () => {
    relogio.avancarDias(10);
    const ranking = await relatorios.rankingFornecedores();
    assert.equal(ranking.length, 2);
    assert.deepEqual(ranking[0], {
      fornecedor: 'Metalúrgica Alfa',
      total: 2,
      emAberto: 2,
      vencidas: 2,
      porGravidade: { BAIXA: 0, MEDIA: 0, ALTA: 1, CRITICA: 1 },
      pontuacao: 15,
    });
    assert.equal(ranking[1].fornecedor, 'Plásticos Beta');
    assert.equal(ranking[1].pontuacao, 3);
  });

  it('NC encerrada conta no histórico do fornecedor, mas não como em aberto', async () => {
    const nc = await ncService.criar(ncValida({ fornecedor: 'Plásticos Beta', gravidade: 'BAIXA' }));
    await ncService.alterarStatus(nc.id, { status: 'EM_ANALISE' });
    await ncService.alterarStatus(nc.id, { status: 'ACAO_CORRETIVA', causaRaiz: 'Causa' });
    await ncService.alterarStatus(nc.id, { status: 'ENCERRADA', acaoCorretiva: 'Ação' });

    const beta = (await relatorios.rankingFornecedores()).find((f) => f.fornecedor === 'Plásticos Beta');
    assert.equal(beta.total, 2);
    assert.equal(beta.emAberto, 1);
  });
});
