// Helpers compartidos para las Pages Functions de subida de archivos a Notion.
// La API de file-upload requiere una Notion-Version reciente.
export const NOTION_VERSION = "2026-03-11";
export const NOTION_BASE = "https://api.notion.com/v1";

export interface Env {
  // Secreto dedicado para el formulario de contacto (workspace/página destino).
  NOTION_CONTACT_KEY?: string;
  // Secreto del portfolio (proxy principal). Se usa como respaldo.
  NOTION_PORTFOLIO_KEY?: string;
  NOTION_SECRET?: string;
  // ID de la página de Notion donde se guardan los envíos de contacto.
  CONTACT_PAGE_ID?: string;
  [key: string]: unknown;
}

/**
 * Resuelve el secreto de Notion para las subidas de contacto.
 * Prioriza NOTION_CONTACT_KEY; si no existe, cae al del portfolio.
 * Importante: los archivos subidos pertenecen al workspace del secreto usado,
 * así que este mismo secreto debe tener acceso a CONTACT_PAGE_ID.
 */
export function getSecret(env: Env): string {
  return (env.NOTION_CONTACT_KEY || env.NOTION_PORTFOLIO_KEY || env.NOTION_SECRET || "") as string;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

const NOTION_MIME_TYPES: Record<string, string> = {
  // Archivos comprimidos
  zip: "application/zip",
  gz: "application/gzip",
  gzip: "application/gzip",
  tar: "application/x-tar",
  "7z": "application/x-7z-compressed",
  bz2: "application/x-bzip2",
  rar: "application/vnd.rar",
  // Imágenes
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  tiff: "image/tiff",
  tif: "image/tiff",
  ico: "image/vnd.microsoft.icon",
  heic: "image/heic",
  avif: "image/avif",
  apng: "image/apng",
  // Audio
  aac: "audio/aac",
  adts: "audio/aac",
  mid: "audio/midi",
  midi: "audio/midi",
  mp3: "audio/mpeg",
  mpga: "audio/mpeg",
  m4a: "audio/mp4",
  m4b: "audio/mp4",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  wav: "audio/wav",
  wma: "audio/x-ms-wma",
  weba: "audio/webm",
  flac: "audio/x-flac",
  // Vídeo
  amv: "video/x-amv",
  asf: "video/x-ms-asf",
  wmv: "video/x-ms-asf",
  avi: "video/x-msvideo",
  f4v: "video/x-f4v",
  flv: "video/x-flv",
  gifv: "video/mp4",
  m4v: "video/mp4",
  mp4: "video/mp4",
  mkv: "video/webm",
  webm: "video/webm",
  mov: "video/quicktime",
  qt: "video/quicktime",
  mpeg: "video/mpeg",
  ogv: "video/ogg",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
  // Documentos
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  doc: "application/msword",
  dot: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  dotx: "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  xls: "application/vnd.ms-excel",
  xlt: "application/vnd.ms-excel",
  xla: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xltx: "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
  ppt: "application/vnd.ms-powerpoint",
  pot: "application/vnd.ms-powerpoint",
  pps: "application/vnd.ms-powerpoint",
  ppa: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  potx: "application/vnd.openxmlformats-officedocument.presentationml.template",
  rtf: "application/rtf",
  md: "text/markdown",
  markdown: "text/markdown",
  html: "text/html",
  htm: "text/html",
  epub: "application/epub+zip",
  xml: "text/xml",
  css: "text/css",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  ics: "text/calendar",
  yaml: "text/yaml",
  yml: "text/yaml",
  tsv: "text/tab-separated-values",
};

/**
 * Calcula el nombre de subida + content type.
 * Las extensiones conocidas usan un MIME estándar; las desconocidas se envuelven
 * como .zip (el navegador las comprime a ZIP real antes de subir).
 */
export function resolveUploadMeta(
  filename: string,
  mimeType: string
): { uploadName: string; contentType: string; extModified: boolean } {
  const dotIndex = filename.lastIndexOf(".");
  const ext = dotIndex !== -1 ? filename.slice(dotIndex + 1).toLowerCase() : "";
  let uploadName = filename;
  let contentType = mimeType || "application/octet-stream";
  let extModified = false;

  const standardMime = NOTION_MIME_TYPES[ext];
  if (standardMime) {
    contentType = standardMime;
  } else {
    uploadName = filename + ".zip";
    contentType = "application/zip";
    extModified = true;
  }
  return { uploadName, contentType, extModified };
}

export const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
]);

/** Limpia un ID de bloque/página de Notion desde una URL o UUID con/sin guiones. */
export function cleanNotionId(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  const dashed = trimmed.match(
    /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i
  );
  if (dashed) return dashed[0];
  const plain = trimmed.match(/[a-f0-9]{32}/i);
  if (plain) return plain[0];
  return trimmed;
}
