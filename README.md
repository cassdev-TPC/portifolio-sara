
# Sara Marques Portfolio

Site de portfolio audiovisual da Sara Marques, feito com Vite, React e Tailwind.

## Rodar localmente

```bash
pnpm install
pnpm run dev
```

## Hospedar na Vercel

Configuração já preparada:

- Framework: Vite
- Install Command: `pnpm install --no-frozen-lockfile`
- Build Command: `pnpm run build`
- Output Directory: `dist`

Depois de subir para o GitHub, importe o repositório na Vercel e ela usará o arquivo `vercel.json`.

## Área administrativa

Rotas:

- `/login`: login da administradora
- `/admin`: painel protegido para adicionar e excluir fotos/vídeos

As páginas públicas `/fotos` e `/videos` apenas exibem os arquivos publicados.

## Configurar Supabase

Crie um projeto no Supabase e adicione estas variáveis no `.env` local e na Vercel:

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
VITE_ADMIN_EMAIL=smarquesmedia@gmail.com
```

No Supabase:

1. Vá em Authentication > Users e crie a conta da Sara com `smarquesmedia@gmail.com`.
2. Copie o UUID do usuário criado.
3. Abra o SQL Editor e execute o arquivo `supabase-storage-policies.sql`.
4. No final do arquivo, execute também o `insert` com o UUID real da Sara.
5. Confirme que existe um bucket público chamado `galeria`.
6. Para vídeos grandes, deixe o limite do bucket `galeria` em pelo menos `1 GB`.

O bucket usa estas pastas:

- `photos/nome-da-categoria/arquivo`
- `videos/nome-da-categoria/arquivo`

As regras de segurança ficam no Supabase Storage: qualquer visitante pode visualizar, mas upload e exclusão só passam para usuários autenticados que também existam na tabela `public.admin_users`.
