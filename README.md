# Sara Marques Portfolio

Site de portfólio audiovisual da Sara Marques, feito com Vite, React e Tailwind.

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

O Supabase é usado para autenticação da administradora.

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

## Configurar Cloudflare R2

O Cloudflare R2 é usado para armazenar fotos e vídeos grandes.

Adicione estas variáveis na Vercel:

```bash
VITE_R2_PUBLIC_URL=https://pub-a324c717811d497b9c1237129c84ffbd.r2.dev
R2_ACCOUNT_ID=c0d698a8e801bf92afd8f8edc13b5905
R2_BUCKET=galeria-sara
R2_PUBLIC_URL=https://pub-a324c717811d497b9c1237129c84ffbd.r2.dev
R2_ACCESS_KEY_ID=sua-access-key-id-do-r2
R2_SECRET_ACCESS_KEY=sua-secret-access-key-do-r2
R2_WORKER_URL=https://seu-worker.workers.dev
R2_UPLOAD_SECRET=uma-senha-grande-aleatoria
```

Não coloque `R2_SECRET_ACCESS_KEY` no código do site nem em variável com prefixo `VITE_`.

No bucket `galeria-sara`, configure a CORS Policy:

```json
[
  {
    "AllowedOrigins": [
      "https://seu-site-na-vercel.vercel.app",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Troque `https://seu-site-na-vercel.vercel.app` pelo domínio real do site.

O bucket usa estas pastas:

- `photos/nome-da-categoria/arquivo`
- `videos/nome-da-categoria/arquivo`

Depois disso, uploads feitos no painel `/admin` usam uma URL assinada. Qualquer visitante pode visualizar fotos e vídeos, mas upload e exclusão exigem login da administradora e validação do e-mail autorizado no servidor.

## Worker para upload no R2

Se o navegador bloquear upload direto no endpoint S3 do R2, use o Worker em `cloudflare-worker/r2-upload-worker.js`.

No Cloudflare:

1. Vá em Workers & Pages.
2. Crie um Worker chamado `sara-r2-upload`.
3. Cole o código de `cloudflare-worker/r2-upload-worker.js`.
4. Em Settings > Bindings, adicione um R2 bucket binding:
   - Variable name: `GALERIA`
   - Bucket: `galeria-sara`
5. Em Variables, adicione:
   - `UPLOAD_SECRET`: uma senha grande aleatória
   - `ALLOWED_ORIGIN`: `https://portifolio-sara.vercel.app`
6. Faça deploy do Worker.

Na Vercel, adicione:

```bash
R2_WORKER_URL=https://seu-worker.workers.dev
R2_UPLOAD_SECRET=a-mesma-senha-do-worker
```

Depois faça redeploy na Vercel.
