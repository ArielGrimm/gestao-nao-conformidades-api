import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularPrazo, diasDeAtraso, codigoNc } from '../../src/domain/regras.js';

describe('Regras de domínio', () => {
  it('calcula o prazo conforme a gravidade', () => {
    const abertura = '2026-11-01T12:00:00.000Z';
    assert.equal(calcularPrazo(abertura, 'CRITICA'), '2026-11-03');
    assert.equal(calcularPrazo(abertura, 'ALTA'), '2026-11-08');
    assert.equal(calcularPrazo(abertura, 'MEDIA'), '2026-11-16');
    assert.equal(calcularPrazo(abertura, 'BAIXA'), '2026-12-01');
  });

  it('calcula dias de atraso (zero se dentro do prazo)', () => {
    assert.equal(diasDeAtraso('2026-11-10', new Date('2026-11-10T23:00:00Z')), 0);
    assert.equal(diasDeAtraso('2026-11-10', new Date('2026-11-13T08:00:00Z')), 3);
    assert.equal(diasDeAtraso('2026-11-10', new Date('2026-11-01T08:00:00Z')), 0);
  });

  it('gera o código da NC', () => {
    assert.equal(codigoNc(7), 'NC-00007');
  });
});
