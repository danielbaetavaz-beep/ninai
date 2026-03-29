# ninAI — Plataforma de nutrição inteligente

## Setup

### 1. Banco de dados (Supabase)
- Acesse o SQL Editor no Supabase
- Cole e execute o conteúdo de `supabase-schema.sql`

### 2. Variáveis de ambiente
Crie `.env.local` na raiz com:
```
NEXT_PUBLIC_SUPABASE_URL=https://phzvzbinlvjtgkexmoxj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_publishable_key
SUPABASE_SERVICE_ROLE_KEY=sua_secret_key
ANTHROPIC_API_KEY=sua_chave_anthropic
```

### 3. Deploy na Vercel
- Faça push do código para o GitHub
- Importe o repositório na Vercel
- Configure as variáveis de ambiente na Vercel (Settings > Environment Variables)
- Deploy automático

### 4. Uso
- Pacientes acessam a URL normal
- Nina acessa a mesma URL mas com conta de nutricionista
- O app detecta o tipo de conta e redireciona automaticamente
