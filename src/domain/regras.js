/**
 * Regras de domínio da Gestão de Não Conformidades (NC).
 * Centralizadas aqui para o grupo ajustar sem mexer no resto do código.
 */

export const GRAVIDADES = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];

/** Prazo (em dias corridos) para encerrar a NC, conforme a gravidade. */
export const PRAZO_DIAS = { BAIXA: 30, MEDIA: 15, ALTA: 7, CRITICA: 2 };

/** Peso de cada gravidade no ranking de fornecedores. */
export const PESO_GRAVIDADE = { BAIXA: 1, MEDIA: 3, ALTA: 5, CRITICA: 10 };

export const STATUS = ['ABERTA', 'EM_ANALISE', 'ACAO_CORRETIVA', 'ENCERRADA', 'CANCELADA'];

export const STATUS_FINAIS = ['ENCERRADA', 'CANCELADA'];

/**
 * Fluxo permitido de status:
 *
 *   ABERTA ──> EM_ANALISE ──> ACAO_CORRETIVA ──> ENCERRADA
 *     │            │   ^             │
 *     │            │   └─────────────┘ (ação não resolveu: volta para análise)
 *     └────────────┴──> CANCELADA
 */
export const TRANSICOES = {
  ABERTA: ['EM_ANALISE', 'CANCELADA'],
  EM_ANALISE: ['ACAO_CORRETIVA', 'CANCELADA'],
  ACAO_CORRETIVA: ['ENCERRADA', 'EM_ANALISE'],
  ENCERRADA: [],
  CANCELADA: [],
};

/** Gera o código legível da NC a partir do id (ex.: 7 -> "NC-00007"). */
export const codigoNc = (id) => `NC-${String(id).padStart(5, '0')}`;

/** Soma dias a uma data e devolve no formato AAAA-MM-DD. */
export function calcularPrazo(dataAbertura, gravidade) {
  const data = new Date(dataAbertura);
  data.setUTCDate(data.getUTCDate() + PRAZO_DIAS[gravidade]);
  return data.toISOString().slice(0, 10);
}

/** Dias de atraso em relação ao prazo (0 se ainda está no prazo). */
export function diasDeAtraso(prazo, hoje) {
  const diff = Date.parse(hoje.toISOString().slice(0, 10)) - Date.parse(prazo);
  return Math.max(0, Math.round(diff / 86_400_000));
}
