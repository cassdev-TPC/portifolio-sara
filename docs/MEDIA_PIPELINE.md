# Pipeline de mídia

Novas fotos são preservadas em `originals/photos/`; versões WebP (máximo 2560 px, qualidade 88) ficam em `optimized/photos/` e miniaturas de 800 px em `thumbnails/photos/`. Vídeos MP4 H.264 permanecem em `originals/videos/` e recebem uma capa WebP em `posters/videos/`. A grade nunca usa o vídeo como miniatura e o elemento `<video>` só é criado após o clique.

Um JSON ao lado do original (`<chave>.metadata.json`) relaciona as variantes, categoria implícita no caminho, descrição, dimensões, duração e status. Objetos derivados recebem cache imutável de um ano; originais usam cache de um dia; a listagem usa revalidação curta na Vercel.

## Migração e recuperação

1. Exporte as variáveis R2 apenas no ambiente local.
2. Execute `pnpm migrate:r2:dry-run` e revise `r2-migration-dry-run.json`.
3. Execute `pnpm migrate:r2:apply`. O script verifica cada destino antes de gravar e pode ser reiniciado.
4. Guarde os relatórios. Os arquivos sob `photos/` e `videos/` nunca são substituídos ou apagados.

Para recuperação, remova apenas referências de variantes dos JSONs (não os originais) ou restaure o código anterior; as URLs legadas continuam válidas. MOVs são inventariados como `needsConversion`; a conversão não roda em Worker/Vercel e deve ser feita localmente ou em serviço especializado após decisão de custo.
