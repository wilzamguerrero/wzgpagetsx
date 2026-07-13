<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# WZG Portfolio

Visualizador estilo Pinterest para páginas de Notion, construido con Vite + React.

## Requisitos

- Node.js >= 18
- npm

## Ejecutar en local

1. Instala dependencias:
   ```bash
   npm install
   ```

2. Crea un archivo `.env.local` en la raíz con tus variables:
   ```env
   # Usadas por el frontend (Vite)
   VITE_ROOT_PAGE_ID=tu_page_id
   VITE_NOTION_PORTFOLIO_KEY=tu_notion_key

   # Usada por el proxy local (server.mjs)
   NOTION_PORTFOLIO_KEY=tu_notion_key
   ```

3. En una terminal, arranca el proxy de Notion (mantiene la API key en el servidor):
   ```bash
   npm run server
   ```
   > En Windows, exporta la variable antes o usa un `.env`. El proxy lee `process.env.NOTION_PORTFOLIO_KEY`.

4. En otra terminal, arranca el frontend:
   ```bash
   npm run dev
   ```

El frontend en `localhost` llama al proxy en `http://localhost:3001/api/notion`. En producción llama a `/api/notion`, servido por la Cloudflare Pages Function.

## Desplegar en Cloudflare Pages

La API vive en `functions/api/notion.ts` (Cloudflare Pages Function) y se mapea automáticamente a la ruta `/api/notion`.

### Opción A — Dashboard (Git)

1. Sube el repo a GitHub/GitLab y conéctalo en Cloudflare Pages.
2. Configura el build:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. En **Settings → Environment variables**, añade:
   - `NOTION_PORTFOLIO_KEY` (secreto, usado por la función)
   - `VITE_ROOT_PAGE_ID` y `VITE_NOTION_PORTFOLIO_KEY` (disponibles en build para el frontend)
4. Deploy. Cloudflare detecta el directorio `functions/` automáticamente.

### Opción B — Wrangler (CLI)

```bash
npm run build
npx wrangler pages deploy dist
```

Configura el secreto de la función con:
```bash
npx wrangler pages secret put NOTION_PORTFOLIO_KEY
```

## Notas

- El enrutado SPA se resuelve con `public/_redirects` (`/* /index.html 200`). Las Pages Functions tienen prioridad, así que `/api/notion` no cae en el fallback.
- Este proyecto migró de Bun/Vercel a npm/Cloudflare: el proxy `Bun.serve` se reemplazó por `server.mjs` (Node) y la función de Vercel por una Cloudflare Pages Function.
