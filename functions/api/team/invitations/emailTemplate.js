function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function teamInvitationSubject({ condoName }) {
    return `Invitacion a ${condoName || 'tu condominio'} en Kondodesk`;
}

export function teamInvitationText({ inviterName, condoName, invitationLink }) {
    return [
        `Hola,`,
        ``,
        `${inviterName || 'Un administrador'} te invito a unirte a ${
            condoName || 'tu condominio'
        } en Kondodesk.`,
        ``,
        `Completa tu registro y crea tu contrasena aqui:`,
        `${invitationLink}`,
        ``,
        `Si no esperabas esta invitacion, puedes ignorar este correo.`,
    ].join('\n');
}

export function buildTeamInvitationEmailHtml({
    appUrl,
    inviterName,
    condoName,
    invitationLink,
}) {
    const safeAppUrl = escapeHtml((appUrl || 'https://kondodesk.com').replace(/\/+$/, ''));
    const safeInviter = escapeHtml(inviterName || 'Un administrador');
    const safeCondo = escapeHtml(condoName || 'tu condominio');
    const safeLink = escapeHtml(invitationLink || `${safeAppUrl}/accept-invite`);

    return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Invitacion a Kondodesk</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px 10px 28px;border-bottom:1px solid #f3f4f6;">
                <a href="${safeAppUrl}" style="text-decoration:none;">
                  <img src="${safeAppUrl}/logo.svg" alt="Kondodesk" width="170" style="display:block;border:0;outline:none;text-decoration:none;" />
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px;">
                <h1 style="margin:0 0 10px 0;color:#111827;font-size:24px;line-height:1.25;">Te invitaron a Kondodesk</h1>
                <p style="margin:0;color:#4b5563;font-size:15px;line-height:1.6;">
                  ${safeInviter} te invito a unirte a <strong>${safeCondo}</strong>.
                </p>

                <div style="margin-top:22px;">
                  <a href="${safeLink}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:10px;font-size:14px;font-weight:700;">
                    Aceptar invitacion y crear contrasena
                  </a>
                </div>

                <p style="margin:18px 0 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
                  Si no solicitaste esta invitacion, puedes ignorar este correo.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 24px 28px;border-top:1px solid #f3f4f6;color:#6b7280;font-size:12px;line-height:1.5;">
                Gestiona amenidades y reservaciones en
                <a href="${safeAppUrl}" style="color:#4f46e5;text-decoration:none;">Kondodesk.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
