# API de Gestão de Não Conformidades

API REST para registrar e acompanhar **não conformidades (NCs)** de qualidade — projeto da disciplina
de Programação Back-End (ADS). Node.js + Express, banco PostgreSQL no **Supabase**, testes com o
test runner nativo do Node + Supertest.

## Problema que resolve
Em muitas empresas, as NCs (peça fora de especificação, lote com defeito, entrega errada) ficam em
planilhas e e-mails: ninguém sabe o que está atrasado, a causa raiz se perde e não há visão de quais
fornecedores mais geram problemas. Esta API:

- controla o **fluxo de tratamento** da NC, impedindo pular etapas;
- calcula o **prazo automaticamente pela gravidade**;
- guarda o **histórico** de cada mudança de status (rastreabilidade/auditoria);
- gera **relatórios** de NCs vencidas e **ranking de fornecedores** por pontuação ponderada.

## Fluxo de status
```
ABERTA ──> EM_ANALISE ──> ACAO_CORRETIVA ──> ENCERRADA
  │            │   ^             │
  │            │   └─────────────┘  (ação não resolveu: volta para análise)
  └────────────┴──> CANCELADA
```
| Para ir para... | Exige |
|---|---|
| `ACAO_CORRETIVA` | `causaRaiz` |
| `ENCERRADA` | `acaoCorretiva` |
| `CANCELADA` | `comentario` (justificativa) |

### Prazo e pontuação por gravidade
| Gravidade | Prazo para encerrar | Peso no ranking |
|---|---|---|
| BAIXA | 30 dias | 1 |
| MEDIA | 15 dias | 3 |
| ALTA | 7 dias | 5 |
| CRITICA | 2 dias | 10 |

Valores definidos em `src/domain/regras.js` — o grupo pode ajustar.

## Endpoints
| Método | Rota | Descrição |
|---|---|---|
| GET | `/nao-conformidades` | Lista. Filtros: `status`, `gravidade`, `fornecedor` (parcial), `vencidas=true` |
| GET | `/nao-conformidades/:id` | Busca por id |
| POST | `/nao-conformidades` | Abre NC (status ABERTA, prazo calculado) |
| PUT | `/nao-conformidades/:id` | Atualiza todos os dados cadastrais (recalcula prazo se a gravidade mudar) |
| PATCH | `/nao-conformidades/:id` | Atualiza só os campos enviados (ex.: `{ "gravidade": "CRITICA" }`) |
| DELETE | `/nao-conformidades/:id` | Exclui — só se ABERTA (depois disso, use o cancelamento) |
| PATCH | `/nao-conformidades/:id/status` | Muda o status seguindo o fluxo |
| GET | `/nao-conformidades/:id/historico` | Histórico de status |
| GET | `/relatorios/vencidas` | NCs em aberto com prazo estourado (mais atrasadas primeiro) |
| GET | `/relatorios/fornecedores` | Ranking de fornecedores por pontuação |
| GET | `/health` | Verificação de saúde |

Exemplos prontos em `docs/requisicoes.http` (extensão *REST Client* do VS Code) — ou use o Postman.

### Outras regras de negócio
- `status`, `prazo` e datas não podem ser enviados pelo usuário — são controlados pela API.
- NC `ENCERRADA` ou `CANCELADA` não pode mais ser editada.
- O código legível da NC é gerado a partir do id (ex.: `NC-00007`).
- No ranking, NCs canceladas não contam; nomes de fornecedor iguais (maiúsculas/espaços) são agrupados.

## Arquitetura
```
src/
  server.js          sobe o servidor e escolhe o repositório (memory | supabase)
  app.js             monta o Express (injeção de dependências)
  config/env.js      lê e valida o .env
  domain/regras.js   fluxo de status, prazos e pesos (regras centrais)
  routes/            rotas REST
  controllers/       HTTP <-> service (sem regra de negócio)
  services/          regras de negócio, validações e relatórios
  repositories/
    memory/          dados em memória (testes e desenvolvimento)
    supabase/        dados no Supabase (produção)
  middlewares/       tratamento de erros padronizado
  utils/             AppError e validadores
database/schema.sql  tabelas + função atômica de mudança de status
tests/unit           testes das regras e services
tests/integration    testes das rotas HTTP
docs/                exemplos de requisição, modelo de ata e relatório de impeditivos
```

## Como rodar
Pré-requisito: Node.js 20 ou superior.

```bash
npm install
cp .env.example .env      # no Windows: copy .env.example .env
npm run dev               # sobe em http://localhost:3000 com dados em memória
```

### Usando o Supabase
1. Crie o projeto em https://supabase.com.
2. Em **SQL Editor**, execute o conteúdo de `database/schema.sql`.
3. Em **Project Settings > API**, copie a URL e a chave para o `.env` e defina `REPOSITORY=supabase`.
4. `npm start`.

> O `.env` está no `.gitignore`. Nunca faça commit das chaves.

## Testes
```bash
npm test                # executa todos os testes
npm run test:coverage   # executa com relatório de cobertura
```
Os testes usam um "relógio" controlado (`tests/helpers.js`) para simular a passagem dos dias e
validar prazos vencidos sem depender da data real.

## Equipe
- Nome — papel
- Nome — papel
