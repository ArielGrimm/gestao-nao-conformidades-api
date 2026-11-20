import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createNaoConformidadesService } from '../../src/services/naoConformidades.service.js';
import { createMemoryRepositories } from '../../src/repositories/memory/index.js';
import { AppError } from '../../src/utils/AppError.js';
import { criarRelogio, ncValida } from '../helpers.js';

describe('NaoConformidadesService', () => {
  let service;
  let relogio;

  beforeEach(() => {
    relogio = criarRelogio();
    service = createNaoConformidadesService({ ...createMemoryRepositories(), agora: relogio.agora });
  });

  describe('criar', () => {
    it('abre a NC com status ABERTA, código e prazo calculado', async () => {
      const nc = await service.criar(ncValida({ gravidade: 'critica' }));
      assert.equal(nc.codigo, 'NC-00001');
      assert.equal(nc.status, 'ABERTA');
      assert.equal(nc.gravidade, 'CRITICA');
      assert.equal(nc.prazo, '2026-11-03');
      assert.equal(nc.vencida, false);
    });

    it('rejeita campos obrigatórios ausentes e gravidade inválida', async () => {
      await assert.rejects(service.criar({ gravidade: 'URGENTE' }), (err) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 400);
        assert.deepEqual(err.details, [
          'titulo é obrigatório.',
          'descricao é obrigatório.',
          'fornecedor é obrigatório.',
          'gravidade deve ser um destes valores: BAIXA, MEDIA, ALTA, CRITICA.',
        ]);
        return true;
      });
    });

    it('não aceita status ou prazo informados pelo usuário', async () => {
      await assert.rejects(service.criar(ncValida({ status: 'ENCERRADA', prazo: '2030-01-01' })), (err) =>
        err.details.includes('status não pode ser informado diretamente.') &&
        err.details.includes('prazo não pode ser informado diretamente.'),
      );
    });

    it('valida tamanho e tipo dos campos opcionais', async () => {
      await assert.rejects(service.criar(ncValida({ produto: 123, titulo: 'x'.repeat(121) })), (err) =>
        err.details.length === 2,
      );
    });
  });

  describe('atualizar', () => {
    it('recalcula o prazo quando a gravidade muda', async () => {
      const nc = await service.criar(ncValida({ gravidade: 'BAIXA' }));
      const atualizada = await service.atualizar(nc.id, ncValida({ gravidade: 'CRITICA', titulo: 'Novo título' }));
      assert.equal(atualizada.prazo, '2026-11-03');
      assert.equal(atualizada.titulo, 'Novo título');
    });

    it('bloqueia edição de NC encerrada ou cancelada (409)', async () => {
      const nc = await service.criar(ncValida());
      await service.alterarStatus(nc.id, { status: 'CANCELADA', comentario: 'Aberta em duplicidade' });
      await assert.rejects(service.atualizar(nc.id, ncValida()), { statusCode: 409 });
    });

    it('retorna 404 para NC inexistente', async () => {
      await assert.rejects(service.atualizar(99, ncValida()), { statusCode: 404 });
    });
  });

  describe('atualizarParcial (PATCH)', () => {
    it('altera só a gravidade, mantém o resto e recalcula o prazo', async () => {
      const nc = await service.criar(ncValida({ gravidade: 'BAIXA' }));
      const atualizada = await service.atualizarParcial(nc.id, { gravidade: 'CRITICA' });
      assert.equal(atualizada.gravidade, 'CRITICA');
      assert.equal(atualizada.prazo, '2026-11-03');
      assert.equal(atualizada.titulo, nc.titulo);
      assert.equal(atualizada.fornecedor, nc.fornecedor);
    });

    it('permite limpar um campo opcional enviando null', async () => {
      const nc = await service.criar(ncValida());
      const atualizada = await service.atualizarParcial(nc.id, { produto: null });
      assert.equal(atualizada.produto, null);
    });

    it('valida os campos enviados com as mesmas regras do PUT', async () => {
      const nc = await service.criar(ncValida());
      await assert.rejects(service.atualizarParcial(nc.id, { gravidade: 'URGENTE' }), { statusCode: 400 });
      await assert.rejects(service.atualizarParcial(nc.id, { titulo: '' }), { statusCode: 400 });
    });

    it('recusa corpo vazio e campos controlados pela API', async () => {
      const nc = await service.criar(ncValida());
      await assert.rejects(service.atualizarParcial(nc.id, {}), (err) =>
        err.statusCode === 400 && err.message.includes('Envie ao menos um destes campos'),
      );
      await assert.rejects(service.atualizarParcial(nc.id, { status: 'ENCERRADA' }), (err) =>
        err.details.includes('status não pode ser informado diretamente.'),
      );
    });

    it('bloqueia NC finalizada (409) e inexistente (404)', async () => {
      const nc = await service.criar(ncValida());
      await service.alterarStatus(nc.id, { status: 'CANCELADA', comentario: 'Duplicada' });
      await assert.rejects(service.atualizarParcial(nc.id, { gravidade: 'BAIXA' }), { statusCode: 409 });
      await assert.rejects(service.atualizarParcial(99, { gravidade: 'BAIXA' }), { statusCode: 404 });
    });
  });

  describe('fluxo de status', () => {
    it('percorre o fluxo completo e registra o histórico', async () => {
      const nc = await service.criar(ncValida());
      await service.alterarStatus(nc.id, { status: 'EM_ANALISE' });
      await service.alterarStatus(nc.id, { status: 'ACAO_CORRETIVA', causaRaiz: 'Ferramenta desgastada' });
      const { naoConformidade } = await service.alterarStatus(nc.id, {
        status: 'ENCERRADA',
        acaoCorretiva: 'Troca da ferramenta e inspeção 100% do lote',
        comentario: 'Validado pela qualidade',
      });

      assert.equal(naoConformidade.status, 'ENCERRADA');
      assert.ok(naoConformidade.encerradoEm);
      assert.equal(naoConformidade.causaRaiz, 'Ferramenta desgastada');

      const historico = await service.listarHistorico(nc.id);
      assert.deepEqual(
        historico.map((h) => `${h.statusAnterior}>${h.statusNovo}`),
        ['ABERTA>EM_ANALISE', 'EM_ANALISE>ACAO_CORRETIVA', 'ACAO_CORRETIVA>ENCERRADA'],
      );
    });

    it('recusa transições fora do fluxo (409)', async () => {
      const nc = await service.criar(ncValida());
      await assert.rejects(service.alterarStatus(nc.id, { status: 'ENCERRADA', acaoCorretiva: 'x' }), (err) =>
        err.statusCode === 409 && err.message.includes('ABERTA → ENCERRADA'),
      );
    });

    it('exige causa raiz, ação corretiva e justificativa de cancelamento', async () => {
      const nc = await service.criar(ncValida());
      await service.alterarStatus(nc.id, { status: 'EM_ANALISE' });
      await assert.rejects(service.alterarStatus(nc.id, { status: 'ACAO_CORRETIVA' }), { statusCode: 400 });
      await assert.rejects(service.alterarStatus(nc.id, { status: 'CANCELADA' }), { statusCode: 400 });

      await service.alterarStatus(nc.id, { status: 'ACAO_CORRETIVA', causaRaiz: 'Causa' });
      await assert.rejects(service.alterarStatus(nc.id, { status: 'ENCERRADA' }), { statusCode: 400 });
    });

    it('permite voltar de ACAO_CORRETIVA para EM_ANALISE mantendo a causa raiz', async () => {
      const nc = await service.criar(ncValida());
      await service.alterarStatus(nc.id, { status: 'EM_ANALISE' });
      await service.alterarStatus(nc.id, { status: 'ACAO_CORRETIVA', causaRaiz: 'Causa A' });
      const { naoConformidade } = await service.alterarStatus(nc.id, { status: 'EM_ANALISE', comentario: 'Ação ineficaz' });
      assert.equal(naoConformidade.status, 'EM_ANALISE');
      assert.equal(naoConformidade.causaRaiz, 'Causa A');
    });

    it('status final não aceita nenhuma transição', async () => {
      const nc = await service.criar(ncValida());
      await service.alterarStatus(nc.id, { status: 'CANCELADA', comentario: 'Duplicada' });
      await assert.rejects(service.alterarStatus(nc.id, { status: 'EM_ANALISE' }), (err) =>
        err.message.includes('Permitidas: nenhuma'),
      );
    });
  });

  describe('remover', () => {
    it('exclui NC ABERTA', async () => {
      const nc = await service.criar(ncValida());
      await service.remover(nc.id);
      await assert.rejects(service.buscarPorId(nc.id), { statusCode: 404 });
    });

    it('bloqueia exclusão depois que a análise começou (409)', async () => {
      const nc = await service.criar(ncValida());
      await service.alterarStatus(nc.id, { status: 'EM_ANALISE' });
      await assert.rejects(service.remover(nc.id), { statusCode: 409 });
    });
  });

  describe('listar', () => {
    beforeEach(async () => {
      await service.criar(ncValida({ fornecedor: 'Metalúrgica Alfa', gravidade: 'CRITICA' }));
      await service.criar(ncValida({ fornecedor: 'Plásticos Beta', gravidade: 'BAIXA' }));
    });

    it('filtra por gravidade, fornecedor (parcial) e status', async () => {
      assert.equal((await service.listar({ gravidade: 'critica' })).length, 1);
      assert.equal((await service.listar({ fornecedor: 'beta' })).length, 1);
      assert.equal((await service.listar({ status: 'ABERTA' })).length, 2);
    });

    it('marca e filtra as vencidas conforme o tempo passa', async () => {
      relogio.avancarDias(5);
      const vencidas = await service.listar({ vencidas: 'true' });
      assert.equal(vencidas.length, 1);
      assert.equal(vencidas[0].gravidade, 'CRITICA');
      assert.equal(vencidas[0].diasAtraso, 3);
    });

    it('rejeita filtro inválido', async () => {
      await assert.rejects(service.listar({ status: 'QUALQUER' }), { statusCode: 400 });
    });
  });
});
