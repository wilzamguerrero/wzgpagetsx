// Extrae un color de acento a partir del icono de una página de Notion.
// Soporta emojis (se dibujan en un canvas) y URLs de imagen (se muestrean).
// Si algo falla (CORS, canvas manchado, icono vacío) devuelve el color primario.

const DEFAULT_ACCENT = '#00ffcb';

// Paleta de los iconos integrados de Notion. Su URL termina en `_<color>.svg`
// (por ejemplo `grid_yellow.svg`), así que el color se lee directo del nombre.
const NOTION_ICON_COLORS: Record<string, string> = {
  gray: '#adb5bd',
  lightgray: '#ced4da',
  brown: '#c99a6e',
  orange: '#ff922b',
  yellow: '#ffd43b',
  green: '#51cf66',
  blue: '#4dabf7',
  purple: '#bd93f9',
  pink: '#ff79c6',
  red: '#ff6b6b',
};

// Cache en memoria para no recalcular el mismo icono varias veces.
const cache = new Map<string, string>();

// Cache persistente del acento por página (localStorage). Permite pintar el
// color correcto al instante al recargar, sin esperar a que carguen los tableros.
const ACCENT_CACHE_KEY = "accent_by_board_v2";

export function getCachedAccent(boardId: string): string | null {
  try {
    const map = JSON.parse(localStorage.getItem(ACCENT_CACHE_KEY) || "{}");
    return map[boardId] || null;
  } catch {
    return null;
  }
}

export function setCachedAccent(boardId: string, color: string): void {
  try {
    const map = JSON.parse(localStorage.getItem(ACCENT_CACHE_KEY) || "{}");
    map[boardId] = color;
    localStorage.setItem(ACCENT_CACHE_KEY, JSON.stringify(map));
  } catch {
    /* ignorar cuota/errores de localStorage */
  }
}

export async function extractAccentColor(icon?: string): Promise<string> {
  if (!icon) return DEFAULT_ACCENT;
  if (cache.has(icon)) return cache.get(icon)!;

  try {
    let color: string | null = null;

    if (icon.startsWith('http')) {
      // 1) Iconos integrados de Notion: el color está en la URL.
      color = colorFromNotionIconUrl(icon);
      // 2) Iconos personalizados (imagen subida): muestrear el canvas.
      if (!color) color = await colorFromImage(icon);
    } else {
      // Emoji: dibujarlo y muestrear.
      color = colorFromEmoji(icon);
    }

    const result = color || DEFAULT_ACCENT;
    cache.set(icon, result);
    return result;
  } catch {
    return DEFAULT_ACCENT;
  }
}

// Extrae el color del nombre de archivo de un icono integrado de Notion.
function colorFromNotionIconUrl(url: string): string | null {
  try {
    const clean = url.split('?')[0].toLowerCase();
    if (!clean.includes('/icons/')) return null;
    const file = clean.substring(clean.lastIndexOf('/') + 1).replace('.svg', '');
    const colorName = file.split('_').pop() || '';
    return NOTION_ICON_COLORS[colorName] || null;
  } catch {
    return null;
  }
}

function colorFromEmoji(emoji: string): string {
  const size = 36;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return DEFAULT_ACCENT;

  ctx.clearRect(0, 0, size, size);
  ctx.font = `${size - 8}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2 + 2);

  return dominantColor(ctx.getImageData(0, 0, size, size).data);
}

function colorFromImage(url: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 36;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(DEFAULT_ACCENT);
        ctx.drawImage(img, 0, 0, size, size);
        resolve(dominantColor(ctx.getImageData(0, 0, size, size).data));
      } catch {
        // Canvas "tainted" por CORS: no se puede leer, usamos el color por defecto.
        resolve(DEFAULT_ACCENT);
      }
    };
    img.onerror = () => resolve(DEFAULT_ACCENT);
    img.src = url;
  });
}

// Elige el TONO (matiz) dominante más vívido usando un histograma de 12 buckets.
// Promediar todos los píxeles daba colores apagados en iconos con varios tonos
// (p. ej. un logo naranja con mucho negro). Así se toma el color de acento real.
function dominantColor(data: Uint8ClampedArray): string {
  const N = 12;
  const buckets = Array.from({ length: N }, () => ({ r: 0, g: 0, b: 0, weight: 0 }));

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // casi transparente
    const cr = data[i], cg = data[i + 1], cb = data[i + 2];
    const max = Math.max(cr, cg, cb);
    const min = Math.min(cr, cg, cb);
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat < 0.22) continue; // gris/blanco/negro
    if (max < 40) continue;   // demasiado oscuro

    const [h] = rgbToHsl(cr, cg, cb);
    const bi = Math.min(N - 1, Math.floor(h * N));
    const w = sat * (max / 255); // pondera por viveza
    const bucket = buckets[bi];
    bucket.r += cr * w;
    bucket.g += cg * w;
    bucket.b += cb * w;
    bucket.weight += w;
  }

  let best = buckets[0];
  for (const b of buckets) if (b.weight > best.weight) best = b;
  if (best.weight === 0) return DEFAULT_ACCENT;

  return boost(
    Math.round(best.r / best.weight),
    Math.round(best.g / best.weight),
    Math.round(best.b / best.weight)
  );
}

// Convierte un color hex (#rrggbb) a canales "r g b" para usar en
// rgb(var(--accent-rgb) / <alpha>) de Tailwind.
export function hexToRgbChannels(hex: string): string {
  const m = hex.replace('#', '');
  if (m.length !== 6) return '0 255 203';
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

// Sube saturación y luminosidad mínimas para un acento con presencia.
function boost(r: number, g: number, b: number): string {
  const [h, s, l] = rgbToHsl(r, g, b);
  const ns = Math.max(s, 0.6);
  const nl = Math.min(Math.max(l, 0.52), 0.68);
  const [nr, ng, nb] = hslToRgb(h, ns, nl);
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

function toHex(v: number): string {
  return Math.round(v).toString(16).padStart(2, '0');
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255];
}
