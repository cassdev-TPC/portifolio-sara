# Importação inicial do catálogo R2

Em 20/10/2026, foram lidos os endpoints publicados `/api/r2/list?kind=photos` e `/api/r2/list?kind=videos` e importados os metadados para `public.gallery_media` no projeto Supabase `portifolio` (`cwyblrpvyuortqzgarpd`). Nenhum objeto R2 foi movido ou reenviado.

| Tipo | Registros | Com dimensões | Legado sem versões derivadas |
| --- | ---: | ---: | ---: |
| Fotos | 67 | 67 | 7 |
| Vídeos | 16 | 16 | 0 |

As 7 fotos sem dimensões nos metadados tiveram o cabeçalho do original inspecionado. Para os 15 vídeos sem dimensões, foram inspecionados os respectivos pôsteres. O utilitário `scripts/inspect-gallery-dimensions.mjs` faz essa leitura com uma requisição HTTP parcial de até 1 MiB por imagem. A duração dos vídeos continua nula quando não existia no metadado original.

O identificador do registro é o caminho do original. O catálogo armazena caminhos, categoria, descrição, dimensões, data e estado. O site monta as URLs com `VITE_R2_PUBLIC_URL`. A consulta pública lê apenas a tabela; não chama a listagem do Worker. As futuras inclusões, edições de descrição e exclusões realizadas no painel atualizam o catálogo após a operação R2. O processamento e a publicação condicionada à existência das variantes serão refinados no passo 5.

O banco estava inativo no início da etapa e foi restaurado. A tabela foi criada com RLS; visitantes têm apenas leitura, e o usuário autenticado com o e-mail administrativo configurado pode escrever. A leitura como papel `anon` retornou 67 fotos e 16 vídeos; uma atualização administrativa simulada em transação com rollback também passou. O [aviso de segurança](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) preexistente no projeto diz respeito à proteção de senhas vazadas, fora deste catálogo.

Para desfazer a publicação do código, voltar o branch `hostinger-deploy` ao commit `94bc65af6857b80d14e6bf48be2fa4cc95026b4a` e reimplantar na Hostinger. A tabela e os objetos R2 podem permanecer; o código anterior ignora o catálogo.
