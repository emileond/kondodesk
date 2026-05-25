function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function normalizeStatus(status) {
    const value = String(status || '').toLowerCase();
    if (value === 'approved') return 'confirmed';
    if (value === 'canceled') return 'cancelled';
    return value;
}

export function statusLabel(status) {
    const value = normalizeStatus(status);
    if (value === 'confirmed') return 'aprobada';
    if (value === 'pending') return 'pendiente de aprobación';
    if (value === 'cancelled') return 'cancelada';
    return value || 'actualizada';
}

export function resolveTimezone(timezone) {
    const fallback = 'America/Mexico_City';
    const candidate = String(timezone || '').trim();
    if (!candidate) return fallback;
    try {
        new Intl.DateTimeFormat('es-MX', { timeZone: candidate }).format(new Date());
        return candidate;
    } catch {
        return fallback;
    }
}

export function formatDateTime(value, timezone) {
    const dt = new Date(value);
    if (isNaN(dt.getTime())) return 'N/A';
    const tz = resolveTimezone(timezone);
    const datePart = new Intl.DateTimeFormat('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: tz,
    }).format(dt);
    const timePart = new Intl.DateTimeFormat('es-MX', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: tz,
    }).format(dt);
    return `${datePart} · ${timePart}`;
}

function getStatusTone(status) {
    const normalized = normalizeStatus(status);
    if (normalized === 'confirmed') {
        return { bg: '#ecfdf3', text: '#047857', label: 'Aprobada' };
    }
    if (normalized === 'pending') {
        return { bg: '#fffbeb', text: '#b45309', label: 'Pendiente de aprobación' };
    }
    if (normalized === 'cancelled') {
        return { bg: '#fef2f2', text: '#b91c1c', label: 'Cancelada' };
    }
    return { bg: '#eef2ff', text: '#4338ca', label: statusLabel(status) };
}

export function buildReservationEmailHtml({
    appUrl,
    title,
    greeting,
    intro,
    reservation,
    amenityName,
    extraRows = [],
    ctaLabel,
    ctaUrl,
    nextSteps = [],
    timezone,
}) {
    const tone = getStatusTone(reservation?.status);
    const tz = resolveTimezone(timezone);
    const brandUrl = appUrl || 'https://kondodesk.com';
    const safeBrandUrl = escapeHtml(brandUrl.replace(/\/+$/, ''));
    const safeCtaUrl = escapeHtml(ctaUrl || `${safeBrandUrl}/reservas`);
    const safeTitle = escapeHtml(title);
    const safeIntro = escapeHtml(intro);
    const detailRows = [
        ['Amenidad', amenityName || 'Amenidad'],
        ['Inicio', formatDateTime(reservation?.start_time, tz)],
        ['Fin', formatDateTime(reservation?.end_time, tz)],
        ...extraRows,
    ]
        .map(
            ([label, value]) => `
                <tr>
                    <td style="padding:10px 0;color:#6b7280;font-size:13px;">${escapeHtml(label)}</td>
                    <td style="padding:10px 0;color:#111827;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(value)}</td>
                </tr>`,
        )
        .join('');

    const stepsHtml =
        nextSteps.length > 0
            ? `<div style="margin-top:18px;">
                    <p style="margin:0 0 8px 0;color:#111827;font-size:14px;font-weight:600;">Siguientes pasos</p>
                    <ol style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.6;">
                        ${nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
                    </ol>
               </div>`
            : '';

    return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px 10px 28px;border-bottom:1px solid #f3f4f6;">
                <a href="${safeBrandUrl}" style="text-decoration:none;">
                  <img src="${safeBrandUrl}/logo.svg" alt="Kondodesk" width="170" style="display:block;border:0;outline:none;text-decoration:none;" />
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px;">
                <h1 style="margin:0 0 10px 0;color:#111827;font-size:24px;line-height:1.25;">${safeTitle}</h1>
                <p style="margin:0;color:#4b5563;font-size:15px;line-height:1.6;">${safeIntro}</p>
                ${stepsHtml}

                <div style="margin-top:20px;background:${tone.bg};color:${tone.text};display:inline-block;padding:7px 12px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.2px;">
                  ${escapeHtml(tone.label)}
                </div>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;border-top:1px solid #e5e7eb;">
                  ${detailRows}
                </table>

                <div style="margin-top:24px;">
                  <a href="${safeCtaUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:10px;font-size:14px;font-weight:700;">
                    ${escapeHtml(ctaLabel || 'Ver reservación')}
                  </a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 24px 28px;border-top:1px solid #f3f4f6;color:#6b7280;font-size:12px;line-height:1.5;">
                Gestiona tus reservaciones en <a href="${safeBrandUrl}" style="color:#4f46e5;text-decoration:none;">Kondodesk.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
