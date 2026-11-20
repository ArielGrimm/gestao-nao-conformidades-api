/** Relógio controlável para simular a passagem do tempo nos testes. */
export function criarRelogio(inicio = '2026-11-01T12:00:00.000Z') {
  let atual = new Date(inicio);
  return {
    agora: () => new Date(atual),
    avancarDias(dias) {
      atual = new Date(atual.getTime() + dias * 86_400_000);
    },
  };
}

/** Dados válidos de uma NC, com possibilidade de sobrescrever campos. */
export const ncValida = (dados = {}) => ({
  titulo: 'Peça fora de especificação',
  descricao: 'Lote recebido com diâmetro acima da tolerância.',
  fornecedor: 'Metalúrgica Alfa',
  produto: 'Eixo 20mm',
  responsavel: 'Qualidade',
  gravidade: 'ALTA',
  ...dados,
});
