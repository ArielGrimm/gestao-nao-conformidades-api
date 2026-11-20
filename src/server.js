import { env } from './config/env.js';
import { createApp } from './app.js';
import { createMemoryRepositories } from './repositories/memory/index.js';
import { createSupabaseRepositories } from './repositories/supabase/index.js';

const repositories =
  env.repository === 'supabase'
    ? createSupabaseRepositories({ url: env.supabaseUrl, key: env.supabaseKey })
    : createMemoryRepositories();

const app = createApp(repositories);

app.listen(env.port, () => {
  console.log(`Servidor rodando na porta ${env.port} (repositório: ${env.repository})`);
});
