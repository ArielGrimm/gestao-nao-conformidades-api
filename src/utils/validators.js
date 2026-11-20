import { AppError } from './AppError.js';

/**
 * Funções de validação de entrada. Cada uma devolve o valor normalizado
 * ou adiciona uma mensagem ao array de erros.
 */

export function parseId(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw AppError.badRequest('O id deve ser um número inteiro positivo.');
  }
  return id;
}

export function textoObrigatorio(valor, campo, erros, max = 120) {
  if (typeof valor !== 'string' || valor.trim() === '') {
    erros.push(`${campo} é obrigatório.`);
    return undefined;
  }
  return limitarTamanho(valor.trim(), campo, erros, max);
}

export function textoOpcional(valor, campo, erros, max = 120) {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor !== 'string') {
    erros.push(`${campo} deve ser um texto.`);
    return undefined;
  }
  return limitarTamanho(valor.trim(), campo, erros, max);
}

export function valorDaLista(valor, campo, lista, erros) {
  const normalizado = typeof valor === 'string' ? valor.trim().toUpperCase() : undefined;
  if (!lista.includes(normalizado)) {
    erros.push(`${campo} deve ser um destes valores: ${lista.join(', ')}.`);
    return undefined;
  }
  return normalizado;
}

export function lancarSeHouverErros(erros) {
  if (erros.length > 0) {
    throw AppError.badRequest('Dados inválidos.', erros);
  }
}

function limitarTamanho(texto, campo, erros, max) {
  if (texto.length > max) erros.push(`${campo} deve ter no máximo ${max} caracteres.`);
  return texto;
}
