// Servidor proxy local para desarrollo (Node) - ejecutar con: npm run server
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

// Carga sencilla de variables desde .env.local y .env (sin dependencias)
function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      const content = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        // Quitar comillas envolventes
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
      }
    } catch {
      // El archivo no existe, se ignora
    }
  }
}
loadEnv();

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const NOTION_KEY = process.env.NOTION_PORTFOLIO_KEY || '';
const PORT = 3001;

if (!NOTION_KEY) {
  console.warn('⚠️  NOTION_PORTFOLIO_KEY no está definida. Añádela a .env o .env.local');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Content-Type': 'application/json',
};

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    return res.end();
  }

  // Solo manejar /api/notion
  if (!url.pathname.startsWith('/api/notion')) {
    res.writeHead(404, corsHeaders);
    return res.end(JSON.stringify({ error: 'Not Found' }));
  }

  const endpoint = url.searchParams.get('endpoint');
  const method = url.searchParams.get('method') || 'GET';

  if (!endpoint) {
    res.writeHead(400, corsHeaders);
    return res.end(JSON.stringify({ error: 'Missing endpoint' }));
  }

  try {
    const notionUrl = `${NOTION_API_BASE}${endpoint}`;
    console.log(`[Proxy] ${method} ${endpoint}`);

    const fetchOptions = {
      method,
      headers: {
        Authorization: `Bearer ${NOTION_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
    };

    // Para POST/PATCH leer el body entrante
    if (method === 'POST' || method === 'PATCH') {
      const raw = await readBody(req);
      if (raw) fetchOptions.body = raw;
    }

    const response = await fetch(notionUrl, fetchOptions);
    const data = await response.text();

    if (!response.ok) {
      console.error(`[Proxy Error] ${response.status}:`, data);
    } else {
      console.log('[Proxy] ✓ Success');
    }

    res.writeHead(response.status, corsHeaders);
    return res.end(data);
  } catch (error) {
    console.error('[Proxy Error]', error.message);
    res.writeHead(500, corsHeaders);
    return res.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Notion Proxy running at http://localhost:${PORT}`);
});
