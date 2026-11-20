import dotenv from 'dotenv';

dotenv.config(); // carrega o .env para process.env

const repository = process.env.REPOSITORY ?? 'memory';

if (!['memory', 'supabase'].includes(repository)) {
  throw new Error('REPOSITORY deve ser "memory" ou "supabase".');
}
if (repository === 'supabase' && (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY)) {
  throw new Error('Defina SUPABASE_URL e SUPABASE_KEY no arquivo .env para usar o Supabase.');
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  repository,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
};
