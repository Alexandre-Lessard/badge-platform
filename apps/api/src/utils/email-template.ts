/**
 * Branded HTML email base template (Badge).
 * Table-based layout for Outlook compatibility. All styles inline.
 */

type BaseEmailOptions = {
  /** Email body HTML (will be wrapped in the template) */
  body: string;
  /** "user" = branded footer with links, "admin" = simple admin footer */
  variant?: "user" | "admin";
};

/**
 * Wrap email body content in the branded template.
 *
 * - Table-based (Outlook-safe, no flexbox/grid)
 * - All inline CSS
 * - Dark mode meta tags for email clients
 * - Responsive: 100% on mobile, max 600px desktop
 */
export function buildBaseEmail({ body, variant = "user" }: BaseEmailOptions): string {
  const isAdmin = variant === "admin";

  const footerText = isAdmin
    ? `<p style="color: #999999; font-size: 11px; margin: 0;">Badge — Notification automatique</p>`
    : `<p style="color: #999999; font-size: 12px; margin: 0;">Badge — Identifiez. Protégez. Récupérez.</p>
       <p style="color: #999999; font-size: 11px; margin: 8px 0 0;"><a href="mailto:info@badgeid.ca" style="color: #999999;">info@badgeid.ca</a> · <a href="https://badgeid.ca" style="color: #999999;">badgeid.ca</a></p>`;

  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Badge</title>
  <!--[if mso]>
  <style>table,td{font-family:Arial,sans-serif!important;}</style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <!-- Main container -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; width: 100%;">
          <!-- Red top bar -->
          <tr>
            <td style="background-color: #D80621; height: 4px; border-radius: 8px 8px 0 0; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 24px 32px 16px; text-align: left;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size: 20px; font-weight: 700; color: #1a2e44; letter-spacing: 0.5px;">Badge</td>
                  <td style="padding-left: 8px; font-size: 11px; color: #999999; vertical-align: bottom; padding-bottom: 2px;">badgeid.ca</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Separator -->
          <tr>
            <td style="background-color: #ffffff; padding: 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr><td style="border-top: 1px solid #eeeeee; font-size: 0; line-height: 0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 24px 32px;">
              ${body}
            </td>
          </tr>
          <!-- Footer separator -->
          <tr>
            <td style="background-color: #ffffff; padding: 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr><td style="border-top: 1px solid #eeeeee; font-size: 0; line-height: 0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #ffffff; padding: 16px 32px 24px; border-radius: 0 0 8px 8px;">
              ${footerText}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Shared CTA button style (dark navy, rounded) */
export function emailButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
  <tr>
    <td style="background-color: #1a2e44; border-radius: 8px;">
      <a href="${href}" target="_blank" style="display: inline-block; background-color: #1a2e44; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}
