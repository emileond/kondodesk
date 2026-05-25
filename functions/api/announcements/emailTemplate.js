function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function extractAnnouncementText(content) {
    if (!content) return '';

    const extractText = (node) => {
        if (!node) return '';
        if (Array.isArray(node)) return node.map(extractText).filter(Boolean).join(' ');
        if (typeof node === 'string') return node;
        if (typeof node !== 'object') return '';

        const ownText = typeof node.text === 'string' ? node.text : '';
        const childText = extractText(node.content);
        return [ownText, childText].filter(Boolean).join(' ').trim();
    };

    let parsed = content;
    if (typeof content === 'string') {
        try {
            parsed = JSON.parse(content);
        } catch {
            parsed = content;
        }
    }

    return extractText(parsed)
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function buildAnnouncementEmailText({ title, content, appUrl }) {
    const safeTitle = title || 'Nuevo aviso';
    const body = extractAnnouncementText(content);
    const url = `${String(appUrl || 'https://kondodesk.com').replace(/\/+$/, '')}/notes`;

    return [
        'Nuevo aviso en tu condominio',
        '',
        `Título: ${safeTitle}`,
        '',
        body || 'Hay un nuevo aviso disponible.',
        '',
        `Ver avisos: ${url}`,
    ].join('\n');
}

export function buildAnnouncementEmailHtml({ title, content, appUrl }) {
    const safeTitle = escapeHtml(title || 'Nuevo aviso');
    const body = escapeHtml(extractAnnouncementText(content) || 'Hay un nuevo aviso disponible.');
    const safeAppUrl = escapeHtml(String(appUrl || 'https://kondodesk.com').replace(/\/+$/, ''));
    const notesUrl = `${safeAppUrl}/notes`;

    return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Nuevo aviso</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;border-bottom:1px solid #f3f4f6;">
                <a href="${safeAppUrl}" style="text-decoration:none;">
                  <img src="${safeAppUrl}/logo.svg" alt="Kondodesk" width="170" style="display:block;border:0;" />
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px;">
                <p style="margin:0;color:#6366f1;font-size:12px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;">
                  Nuevo aviso
                </p>
                <h1 style="margin:8px 0 12px 0;color:#111827;font-size:24px;line-height:1.25;">${safeTitle}</h1>
                <p style="margin:0;color:#374151;font-size:15px;line-height:1.65;">${body}</p>
                <div style="margin-top:22px;">
                  <a href="${notesUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:10px;font-size:14px;font-weight:700;">
                    Ver avisos
                  </a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 24px 28px;border-top:1px solid #f3f4f6;color:#6b7280;font-size:12px;">
                Gestión de avisos en <a href="${safeAppUrl}" style="color:#4f46e5;text-decoration:none;">Kondodesk.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
