import {
  json,
  getSecret,
  type Env,
  NOTION_VERSION,
  NOTION_BASE,
  IMAGE_MIME_TYPES,
  cleanNotionId,
} from "../_shared/notion";

// Extensiones de vídeo que Notion acepta como bloque "video" reproducible.
const VIDEO_EXTENSIONS = new Set([
  "mp4", "mov", "webm", "m4v", "ogv", "avi", "wmv", "asf",
  "flv", "f4v", "amv", "mpeg", "qt", "mkv", "3gp", "3g2",
]);

const getExt = (name: string): string => {
  const i = name.lastIndexOf(".");
  return i !== -1 ? name.slice(i + 1).toLowerCase() : "";
};

interface FileRecord {
  name: string;
  finalName: string;
  size: number;
  uploadId: string;
  extModified: boolean;
  mimeType: string;
  path?: string;
}

interface ContactFields {
  fullName?: string;
  email?: string;
  phone?: string;
  message?: string;
}

const rt = (content: string, opts: { bold?: boolean; link?: string } = {}) => ({
  type: "text",
  text: { content, link: opts.link ? { url: opts.link } : null },
  annotations: opts.bold ? { bold: true } : undefined,
});

/** Párrafo "Etiqueta: valor" (valor opcional como enlace). */
function fieldBlock(label: string, value: string, link?: string): any {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [rt(`${label}: `, { bold: true }), rt(value || "—", { link })],
    },
  };
}

/** Divide un texto largo en párrafos de <= 1900 caracteres (límite de Notion). */
function messageBlocks(message: string): any[] {
  const clean = (message || "").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += 1900) chunks.push(clean.slice(i, i + 1900));
  return chunks.map((chunk) => ({
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: [rt(chunk)] },
  }));
}

/** Construye el bloque nativo de Notion (image/video/file) para un archivo. */
function buildFileBlock(f: FileRecord): any {
  const ext = getExt(f.name);
  const isImage = IMAGE_MIME_TYPES.has(f.mimeType) || f.mimeType.startsWith("image/");
  const isVideo = !f.extModified && (f.mimeType.startsWith("video/") || VIDEO_EXTENSIONS.has(ext));
  const caption = f.extModified
    ? [rt(`${f.name} (.zip)`)]
    : [rt(f.name)];

  if (isImage) {
    return { object: "block", type: "image", image: { type: "file_upload", file_upload: { id: f.uploadId }, caption } };
  }
  if (isVideo) {
    return { object: "block", type: "video", video: { type: "file_upload", file_upload: { id: f.uploadId }, caption } };
  }
  return { object: "block", type: "file", file: { type: "file_upload", file_upload: { id: f.uploadId }, caption } };
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const notionSecret = getSecret(context.env);
  if (!notionSecret) {
    return json({ error: "El servicio de envío no está configurado." }, 400);
  }

  const pageId = cleanNotionId((context.env.CONTACT_PAGE_ID as string) || "");
  if (!pageId) {
    return json({ error: "El destino de envío no está configurado." }, 500);
  }

  let body: { fields?: ContactFields; fileRecords?: FileRecord[] };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Cuerpo de solicitud inválido." }, 400);
  }

  const fields = body.fields || {};
  const fileRecords = body.fileRecords || [];

  const fullName = (fields.fullName || "").trim();
  const email = (fields.email || "").trim();
  const phone = (fields.phone || "").trim();
  const message = (fields.message || "").trim();

  if (!fullName) return json({ error: "El nombre completo es obligatorio." }, 400);
  if (!email || !isEmail(email)) return json({ error: "Correo electrónico inválido." }, 400);

  const headers = {
    Authorization: `Bearer ${notionSecret}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };

  async function appendChildren(parentId: string, blocks: any[]): Promise<any[]> {
    const created: any[] = [];
    for (let i = 0; i < blocks.length; i += 100) {
      const batch = blocks.slice(i, i + 100);
      const res = await fetch(`${NOTION_BASE}/blocks/${parentId}/children`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ children: batch }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        const msg = data?.message || data?.code || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      if (Array.isArray(data.results)) created.push(...data.results);
    }
    return created;
  }

  try {
    const dateStr = new Date().toLocaleString("es-ES", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });

    // 1. Crear un toggle por envío con el nombre + fecha como título.
    const toggle = {
      object: "block",
      type: "toggle",
      toggle: { rich_text: [rt(`📩 ${fullName} — ${dateStr}`, { bold: true })] },
    };
    const [createdToggle] = await appendChildren(pageId, [toggle]);
    if (!createdToggle?.id) throw new Error("No se pudo registrar el envío.");

    // 2. Rellenar el toggle con la info del formulario y los archivos.
    const children: any[] = [
      fieldBlock("Nombre", fullName),
      fieldBlock("Correo", email, `mailto:${email}`),
      fieldBlock("Teléfono", phone),
    ];

    if (message) {
      children.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [rt("Mensaje:", { bold: true })] },
      });
      children.push(...messageBlocks(message));
    }

    if (fileRecords.length > 0) {
      children.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [rt(`Archivos (${fileRecords.length}):`, { bold: true })] },
      });
      children.push(...fileRecords.map(buildFileBlock));
    }

    await appendChildren(createdToggle.id, children);

    return json({ success: true, count: fileRecords.length });
  } catch (err: any) {
    return json(
      { error: `Error al guardar el envío: ${err.message || "Error desconocido"}` },
      500
    );
  }
};
