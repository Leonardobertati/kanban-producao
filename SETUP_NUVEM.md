# Setup nuvem (simples, sem login)

## 1) Criar banco no Supabase
1. Abra [https://supabase.com](https://supabase.com) e crie um projeto.
2. Vá em **SQL Editor**.
3. Execute o arquivo [`supabase.sql`](C:\Users\Leonardo\Documents\New project\supabase.sql).

## 2) Pegar URL e chave anon
1. No Supabase: **Project Settings > API**.
2. Copie:
- `Project URL`
- `anon public key`

## 3) Colar no app
No arquivo [`app.js`](C:\Users\Leonardo\Documents\New project\app.js), no topo, troque:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## 4) Publicar e gerar link
Jeito mais rápido:
1. Abra [https://app.netlify.com/drop](https://app.netlify.com/drop)
2. Arraste a pasta do projeto (`index.html`, `styles.css`, `app.js`).
3. O Netlify gera um link público na hora.

## 5) Como validar
1. Abra o link.
2. Mova/crie/exclua OPs.
3. Feche navegador e abra de novo: estado mantém.
4. Abra o mesmo link em outro computador: estado igual.

## Observação importante
Sem autenticação, qualquer pessoa com o link consegue mexer no quadro (isso foi solicitado para manter simples).
