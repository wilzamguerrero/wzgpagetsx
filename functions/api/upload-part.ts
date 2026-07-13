import { json, getSecret, type Env, NOTION_VERSION, NOTION_BASE } from "../_shared/notion";

/**
 * POST /api/upload-part?upload_id=<id>
 * Reenvía un único chunk multipart/form-data directamente al endpoint "send"
 * de file_uploads de Notion. El body se pasa tal cual (solo se añaden headers
 * de auth), así que es barato sin importar el tamaño del chunk.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const notionSecret = getSecret(context.env);
  if (!notionSecret) {
    return json({ error: "El servicio no está configurado." }, 400);
  }

  const url = new URL(context.request.url);
  const uploadId = url.searchParams.get("upload_id");
  if (!uploadId) {
    return json({ error: "Se requiere upload_id." }, 400);
  }

  const contentType = context.request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return json({ error: "Content-Type debe ser multipart/form-data." }, 400);
  }

  const sendUrl = `${NOTION_BASE}/file_uploads/${uploadId}/send`;

  try {
    const sendRes = await fetch(sendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionSecret}`,
        "Notion-Version": NOTION_VERSION,
        // Preservar el boundary multipart original para que Notion parsee las partes.
        "Content-Type": contentType,
      },
      body: context.request.body,
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      // Errores transitorios de Notion como 503 para que el navegador reintente.
      const transient = [429, 500, 502, 503, 504, 529].includes(sendRes.status);
      return json(
        { error: `El servidor rechazó el fragmento: ${sendRes.status} - ${errText}` },
        transient ? 503 : 502
      );
    }

    const result = (await sendRes.json()) as any;
    return json({ success: true, status: result.status });
  } catch (err: any) {
    return json(
      { error: `Error al enviar chunk: ${err.message || "Error desconocido"}` },
      503
    );
  }
};
