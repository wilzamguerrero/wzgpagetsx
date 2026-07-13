// Cloudflare Pages Function - proxy hacia la API de Notion
// Ruta: /api/notion  (mapeada automáticamente por el directorio functions/)

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

interface Env {
  NOTION_PORTFOLIO_KEY: string;
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // Preflight CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const endpoint = url.searchParams.get('endpoint');
  const method = url.searchParams.get('method') || 'GET';

  if (!endpoint) {
    return Response.json(
      { error: 'Missing endpoint parameter' },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const notionUrl = `${NOTION_API_BASE}${endpoint}`;

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${env.NOTION_PORTFOLIO_KEY || ''}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
    };

    // Para POST/PATCH reenviar el body
    if ((method === 'POST' || method === 'PATCH') && request.body) {
      const body = await request.json();
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(notionUrl, fetchOptions);
    const data = await response.json();

    return Response.json(data, { status: response.status, headers: corsHeaders });
  } catch (error: any) {
    return Response.json(
      { error: error?.message || 'Unknown error' },
      { status: 500, headers: corsHeaders }
    );
  }
};
