import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createMemoryRepositories } from '../../src/repositories/memory/index.js';
import { criarRelogio, ncValida } from '../helpers.js';

// Testes de ponta a ponta das rotas HTTP, usando o repositório em memória.
describe('API de Não Conformidades', () => {
  let app;
  let relogio;

  beforeEach(() => {
    relogio = criarRelogio();
    app = createApp({ ...createMemoryRepositories(), agora: relogio.agora });
  });

  const abrirNc = (dados) => request(app).post('/nao-conformidades').send(ncValida(dados));

  it('GET /health responde ok', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
  });

  it('CRUD completo', async () => {
    const criada = await abrirNc();
    assert.equal(criada.status, 201);
    assert.equal(criada.headers.location, `/nao-conformidades/${criada.body.id}`);
    assert.equal(criada.body.codigo, 'NC-00001');

    const lista = await request(app).get('/nao-conformidades');
    assert.equal(lista.body.length, 1);

    const buscada = await request(app).get(`/nao-conformidades/${criada.body.id}`);
    assert.equal(buscada.status, 200);

    const atualizada = await request(app)
      .put(`/nao-conformidades/${criada.body.id}`)
      .send(ncValida({ titulo: 'Título revisado' }));
    assert.equal(atualizada.body.titulo, 'Título revisado');

    const parcial = await request(app).patch(`/nao-conformidades/${criada.body.id}`).send({ gravidade: 'CRITICA' });
    assert.equal(parcial.status, 200);
    assert.equal(parcial.body.gravidade, 'CRITICA');
    assert.equal(parcial.body.titulo, 'Título revisado');

    const removida = await request(app).delete(`/nao-conformidades/${criada.body.id}`);
    assert.equal(removida.status, 204);
    assert.equal((await request(app).get(`/nao-conformidades/${criada.body.id}`)).status, 404);
  });

  it('fluxo de status, histórico e relatórios', async () => {
    const { body: nc } = await abrirNc({ gravidade: 'CRITICA' });
    const url = `/nao-conformidades/${nc.id}`;

    assert.equal((await request(app).patch(`${url}/status`).send({ status: 'EM_ANALISE' })).status, 200);

    const semCausa = await request(app).patch(`${url}/status`).send({ status: 'ACAO_CORRETIVA' });
    assert.equal(semCausa.status, 400);

    const pulo = await request(app).patch(`${url}/status`).send({ status: 'ENCERRADA' });
    assert.equal(pulo.status, 409);

    const historico = await request(app).get(`${url}/historico`);
    assert.equal(historico.body.length, 1);

    relogio.avancarDias(4);
    const vencidas = await request(app).get('/relatorios/vencidas');
    assert.equal(vencidas.body[0].codigo, nc.codigo);
    assert.equal(vencidas.body[0].diasAtraso, 2);

    const filtro = await request(app).get('/nao-conformidades?vencidas=true&status=EM_ANALISE');
    assert.equal(filtro.body.length, 1);

    const ranking = await request(app).get('/relatorios/fornecedores');
    assert.equal(ranking.body[0].pontuacao, 10);
  });

  it('retorna erros padronizados', async () => {
    const invalida = await request(app).post('/nao-conformidades').send({});
    assert.equal(invalida.status, 400);
    assert.ok(Array.isArray(invalida.body.detalhes));

    assert.equal((await request(app).get('/nao-conformidades/abc')).status, 400);
    assert.equal((await request(app).get('/nao-conformidades?gravidade=X')).status, 400);
    assert.equal((await request(app).get('/nao-existe')).status, 404);

    const jsonQuebrado = await request(app)
      .post('/nao-conformidades')
      .set('Content-Type', 'application/json')
      .send('{"titulo": ');
    assert.equal(jsonQuebrado.status, 400);
  });
});
