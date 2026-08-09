import { createHmac } from "node:crypto";
import { getConfig } from "../config.js";
import { buildBaseEmail, emailButton } from "./email-template.js";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Send transactional email via Brevo (SendinBlue) HTTP API.
 * Falls back to console logging in dev if no API key is configured.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const config = getConfig();

  if (!config.BREVO_API_KEY) {
    console.log("[email] No BREVO_API_KEY — logging email instead:");
    console.log(`  To: ${payload.to}`);
    console.log(`  Subject: ${payload.subject}`);
    console.log(`  Body: ${payload.html}`);
    return;
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": config.BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: config.FROM_EMAIL, name: config.FROM_NAME },
      to: [{ email: payload.to }],
      subject: payload.subject,
      htmlContent: payload.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo API error ${res.status}: ${text}`);
  }
}

// ── HTML sanitization ─────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Contact notification ──────────────────────────────────────────────

export function buildContactNotificationEmail(
  name: string,
  email: string,
  company: string | undefined,
  phone: string | undefined,
  type: string,
  message: string,
  lang: "fr" | "en" = "fr",
): EmailPayload {
  const config = getConfig();
  const adminEmail =
    config.ADMIN_CONTACT_EMAIL ||
    (config.NODE_ENV === "production" ? "info@badgeid.ca" : "dev@badgeid.ca");

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeCompany = company ? escapeHtml(company) : "—";
  const safePhone = phone ? escapeHtml(phone) : "—";
  const safeType = escapeHtml(type);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

  const t = {
    fr: {
      subject: `Nouveau message partenaire — ${name}`,
      heading: "Nouveau message de contact partenaire",
      nameLabel: "Nom",
      emailLabel: "Courriel",
      companyLabel: "Entreprise",
      phoneLabel: "Téléphone",
      typeLabel: "Type",
      messageLabel: "Message",
      footer: "Badge — Formulaire de contact partenaires",
    },
    en: {
      subject: `New partner message — ${name}`,
      heading: "New partner contact message",
      nameLabel: "Name",
      emailLabel: "Email",
      companyLabel: "Company",
      phoneLabel: "Phone",
      typeLabel: "Type",
      messageLabel: "Message",
      footer: "Badge — Partner contact form",
    },
  }[lang];

  return {
    to: adminEmail,
    subject: t.subject,
    html: buildBaseEmail({
      variant: "admin",
      body: `
        <h2 style="margin: 0 0 16px; color: #1a2e44; font-size: 18px;">${t.heading}</h2>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
          <tr><td style="padding: 8px 0; font-weight: bold; color: #333333; width: 100px;">${t.nameLabel}</td><td style="padding: 8px 0; color: #333333;">${safeName}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #333333;">${t.emailLabel}</td><td style="padding: 8px 0;"><a href="mailto:${safeEmail}" style="color: #1a2e44;">${safeEmail}</a></td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #333333;">${t.companyLabel}</td><td style="padding: 8px 0; color: #333333;">${safeCompany}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #333333;">${t.phoneLabel}</td><td style="padding: 8px 0; color: #333333;">${safePhone}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #333333;">${t.typeLabel}</td><td style="padding: 8px 0; color: #333333;">${safeType}</td></tr>
        </table>
        <h3 style="margin: 24px 0 12px; color: #1a2e44; font-size: 15px;">${t.messageLabel}</h3>
        <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; color: #333333; font-size: 14px; line-height: 1.5;">${safeMessage}</div>`,
    }),
  };
}

// ── Signup admin notification ─────────────────────────────────────────

export function buildSignupNotificationEmail(
  opts: { firstName: string; lastName: string; email: string; provider?: string },
  lang: "fr" | "en" = "fr",
): EmailPayload {
  const config = getConfig();
  const adminEmail =
    config.ADMIN_CONTACT_EMAIL ||
    (config.NODE_ENV === "production" ? "info@badgeid.ca" : "dev@badgeid.ca");

  const safeName = escapeHtml(`${opts.firstName} ${opts.lastName}`.trim());
  const safeEmail = escapeHtml(opts.email);
  const safeProvider = escapeHtml(opts.provider ?? (lang === "fr" ? "Courriel" : "Email"));

  const t = {
    fr: {
      subject: `Nouvelle inscription — ${safeName}`,
      heading: "Nouvelle inscription client",
      nameLabel: "Nom",
      emailLabel: "Courriel",
      methodLabel: "Méthode",
      footer: "Badge — Notification automatique d'inscription",
    },
    en: {
      subject: `New signup — ${safeName}`,
      heading: "New client signup",
      nameLabel: "Name",
      emailLabel: "Email",
      methodLabel: "Method",
      footer: "Badge — Automatic signup notification",
    },
  }[lang];

  return {
    to: adminEmail,
    subject: t.subject,
    html: buildBaseEmail({
      variant: "admin",
      body: `
        <h2 style="margin: 0 0 16px; color: #1a2e44; font-size: 18px;">${t.heading}</h2>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
          <tr><td style="padding: 8px 0; font-weight: bold; color: #333333; width: 100px;">${t.nameLabel}</td><td style="padding: 8px 0; color: #333333;">${safeName}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #333333;">${t.emailLabel}</td><td style="padding: 8px 0;"><a href="mailto:${safeEmail}" style="color: #1a2e44;">${safeEmail}</a></td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #333333;">${t.methodLabel}</td><td style="padding: 8px 0; color: #333333;">${safeProvider}</td></tr>
        </table>`,
    }),
  };
}

// ── Order admin notification ──────────────────────────────────────────

export function buildOrderNotificationEmail(
  opts: {
    orderId: string;
    email: string;
    totalAmountCents: number;
    taxAmountCents: number;
    quantity: number;
    productLines: { name: string; quantity: number; amountCents: number }[];
    shippingName: string | null;
    shippingAddress: string | null;
  },
  lang: "fr" | "en" = "fr",
): EmailPayload {
  const config = getConfig();
  const adminEmail =
    config.ADMIN_ORDER_EMAIL ||
    (config.NODE_ENV === "production" ? "commandes@badgeid.ca" : "dev@badgeid.ca");

  const total = (opts.totalAmountCents / 100).toFixed(2);
  const tax = (opts.taxAmountCents / 100).toFixed(2);
  const subtotal = ((opts.totalAmountCents - opts.taxAmountCents) / 100).toFixed(2);
  const safeEmail = escapeHtml(opts.email);
  const safeName = opts.shippingName ? escapeHtml(opts.shippingName) : "—";

  let addressHtml = "—";
  if (opts.shippingAddress) {
    try {
      const addr = JSON.parse(opts.shippingAddress);
      addressHtml = escapeHtml(
        [addr.line1, addr.line2, `${addr.city}, ${addr.state} ${addr.postal_code}`, addr.country]
          .filter(Boolean)
          .join(", "),
      );
    } catch {
      addressHtml = escapeHtml(opts.shippingAddress);
    }
  }

  // Product line items
  const productRowsHtml = opts.productLines
    .map(
      (p) =>
        `<tr><td style="padding: 6px 0;">${escapeHtml(p.name)}</td><td style="padding: 6px 0; text-align: center;">×${p.quantity}</td><td style="padding: 6px 0; text-align: right;">${(p.amountCents / 100).toFixed(2)} $</td></tr>`,
    )
    .join("");

  // Tax numbers (placeholders — replace when available)
  const TPS_NUMBER = "XXXXX XXXX RT0001"; // TODO: replace with actual GST number
  const TVQ_NUMBER = "XXXX XXXX XXXX TQ0001"; // TODO: replace with actual QST number

  const t = {
    fr: {
      subject: `Nouvelle commande #${opts.orderId.slice(0, 8)} — ${total} $ CAD`,
      heading: "Nouvelle commande reçue",
      orderLabel: "Commande",
      customerLabel: "Client",
      productsLabel: "Produits",
      subtotalLabel: "Sous-total",
      taxLabel: "Taxes (TPS/TVQ)",
      totalLabel: "Total",
      shippingLabel: "Livraison",
      nameLabel: "Nom",
      addressLabel: "Adresse",
      footer: "Badge — Notification automatique de commande",
    },
    en: {
      subject: `New order #${opts.orderId.slice(0, 8)} — ${total} $ CAD`,
      heading: "New order received",
      orderLabel: "Order",
      customerLabel: "Customer",
      productsLabel: "Products",
      subtotalLabel: "Subtotal",
      taxLabel: "Taxes (GST/QST)",
      totalLabel: "Total",
      shippingLabel: "Shipping",
      nameLabel: "Name",
      addressLabel: "Address",
      footer: "Badge — Automatic order notification",
    },
  }[lang];

  return {
    to: adminEmail,
    subject: t.subject,
    html: buildBaseEmail({
      variant: "admin",
      body: `
        <h2 style="margin: 0 0 16px; color: #1a2e44; font-size: 18px;">${t.heading}</h2>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
          <tr><td style="padding: 8px 0; font-weight: bold; color: #333333; width: 100px;">${t.orderLabel}</td><td style="padding: 8px 0; color: #333333;">${escapeHtml(opts.orderId)}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; color: #333333;">${t.customerLabel}</td><td style="padding: 8px 0;"><a href="mailto:${safeEmail}" style="color: #1a2e44;">${safeEmail}</a></td></tr>
        </table>

        <h3 style="margin: 20px 0 8px; font-size: 14px; color: #1a2e44;">${t.productsLabel}</h3>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-top: 1px solid #eeeeee;">
          ${productRowsHtml}
          <tr style="border-top: 1px solid #eeeeee;"><td style="padding: 6px 0; font-weight: bold; color: #333333;" colspan="2">${t.subtotalLabel}</td><td style="padding: 6px 0; text-align: right; color: #333333;">${subtotal} $</td></tr>
          <tr><td style="padding: 6px 0; color: #666666;" colspan="2">${t.taxLabel}</td><td style="padding: 6px 0; text-align: right; color: #666666;">${tax} $</td></tr>
          <tr style="border-top: 2px solid #1a2e44;"><td style="padding: 8px 0; font-weight: bold; font-size: 16px; color: #1a2e44;" colspan="2">${t.totalLabel}</td><td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 16px; color: #1a2e44;">${total} $ CAD</td></tr>
        </table>

        <h3 style="margin: 20px 0 8px; font-size: 14px; color: #1a2e44;">${t.shippingLabel}</h3>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
          <tr><td style="padding: 6px 0; font-weight: bold; width: 100px; color: #333333;">${t.nameLabel}</td><td style="padding: 6px 0; color: #333333;">${safeName}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold; color: #333333;">${t.addressLabel}</td><td style="padding: 6px 0; color: #333333;">${addressHtml}</td></tr>
        </table>

        <p style="color: #999999; font-size: 11px; margin-top: 20px;">TPS : ${TPS_NUMBER} | TVQ : ${TVQ_NUMBER}</p>`,
    }),
  };
}

// ── HMAC token helpers ────────────────────────────────────────────────

/**
 * Create an HMAC-signed token for email verification or password reset.
 * Format: `userId.expiresAt.randomNonce.signature`
 */
export function createSignedToken(
  userId: string,
  purpose: "verify-email" | "reset-password",
  expiresInMs: number,
): string {
  const config = getConfig();
  const expiresAt = Date.now() + expiresInMs;
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const data = `${userId}.${expiresAt}.${nonce}.${purpose}`;
  const signature = createHmac("sha256", config.JWT_PRIVATE_KEY)
    .update(data)
    .digest("hex");
  return `${userId}.${expiresAt}.${nonce}.${signature}`;
}

/**
 * Verify an HMAC-signed token. Returns the userId if valid, null otherwise.
 */
export function verifySignedToken(
  token: string,
  purpose: "verify-email" | "reset-password",
): string | null {
  const config = getConfig();
  const parts = token.split(".");
  if (parts.length !== 4) return null;

  const [userId, expiresAtStr, nonce, signature] = parts;
  const expiresAt = Number(expiresAtStr);

  if (isNaN(expiresAt) || Date.now() > expiresAt) return null;

  const data = `${userId}.${expiresAt}.${nonce}.${purpose}`;
  const expected = createHmac("sha256", config.JWT_PRIVATE_KEY)
    .update(data)
    .digest("hex");

  // Timing-safe comparison
  if (signature.length !== expected.length) return null;
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return null;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  if (diff !== 0) return null;

  return userId;
}

// ── Email templates ───────────────────────────────────────────────────

export function buildVerificationEmail(
  firstName: string,
  to: string,
  verifyUrl: string,
  lang: "fr" | "en" = "fr",
): EmailPayload {
  const t = {
    fr: {
      subject: "Vérifiez votre adresse courriel — Badge",
      greeting: `Bonjour ${escapeHtml(firstName)},`,
      body: "Merci de vous être inscrit à Badge. Veuillez vérifier votre adresse courriel en cliquant sur le lien ci-dessous :",
      button: "Vérifier mon courriel",
      expiry: "Ce lien expire dans 24 heures.",
      ignore: "Si vous n'avez pas créé de compte, ignorez ce courriel.",
      footer: "Badge — Registre canadien des biens personnels",
    },
    en: {
      subject: "Verify your email — Badge",
      greeting: `Hello ${escapeHtml(firstName)},`,
      body: "Thank you for signing up for the Badge. Please verify your email address by clicking the link below:",
      button: "Verify my email",
      expiry: "This link expires in 24 hours.",
      ignore: "If you did not create an account, please ignore this email.",
      footer: "Badge — Badge",
    },
  }[lang];

  return {
    to,
    subject: t.subject,
    html: buildBaseEmail({
      body: `
        <h2 style="margin: 0 0 12px; color: #1a2e44; font-size: 20px;">${t.greeting}</h2>
        <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0 0 4px;">${t.body}</p>
        ${emailButton(t.button, verifyUrl)}
        <p style="color: #666666; font-size: 14px; margin: 0 0 8px;">${t.expiry}</p>
        <p style="color: #999999; font-size: 13px; margin: 0;">${t.ignore}</p>`,
    }),
  };
}

export function buildResetEmail(
  firstName: string,
  to: string,
  resetUrl: string,
  lang: "fr" | "en" = "fr",
): EmailPayload {
  const t = {
    fr: {
      subject: "Réinitialisation de mot de passe — Badge",
      greeting: `Bonjour ${escapeHtml(firstName)},`,
      body: "Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le lien ci-dessous pour le changer :",
      button: "Réinitialiser mon mot de passe",
      expiry: "Ce lien expire dans 1 heure.",
      ignore: "Si vous n'avez pas demandé cette réinitialisation, ignorez ce courriel.",
      footer: "Badge — Registre canadien des biens personnels",
    },
    en: {
      subject: "Password reset — Badge",
      greeting: `Hello ${escapeHtml(firstName)},`,
      body: "You requested a password reset. Click the link below to change your password:",
      button: "Reset my password",
      expiry: "This link expires in 1 hour.",
      ignore: "If you did not request this reset, please ignore this email.",
      footer: "Badge — Badge",
    },
  }[lang];

  return {
    to,
    subject: t.subject,
    html: buildBaseEmail({
      body: `
        <h2 style="margin: 0 0 12px; color: #1a2e44; font-size: 20px;">${t.greeting}</h2>
        <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0 0 4px;">${t.body}</p>
        ${emailButton(t.button, resetUrl)}
        <p style="color: #666666; font-size: 14px; margin: 0 0 8px;">${t.expiry}</p>
        <p style="color: #999999; font-size: 13px; margin: 0;">${t.ignore}</p>`,
    }),
  };
}

// ── Order confirmation (client) ──────────────────────────────────────

export function buildOrderConfirmationEmail(
  opts: {
    orderId: string;
    email: string;
    totalAmountCents: number;
    taxAmountCents: number;
    productLines: { name: string; quantity: number; amountCents: number }[];
    shippingName: string | null;
    shippingAddress: string | null;
  },
  lang: "fr" | "en" = "fr",
): EmailPayload {
  const config = getConfig();
  const total = (opts.totalAmountCents / 100).toFixed(2);
  const tax = (opts.taxAmountCents / 100).toFixed(2);
  const subtotal = ((opts.totalAmountCents - opts.taxAmountCents) / 100).toFixed(2);
  const safeName = opts.shippingName ? escapeHtml(opts.shippingName) : "—";
  const orderShort = opts.orderId.slice(0, 8);

  let addressHtml = "—";
  if (opts.shippingAddress) {
    try {
      const addr = JSON.parse(opts.shippingAddress);
      addressHtml = escapeHtml(
        [addr.line1, addr.line2, `${addr.city}, ${addr.state} ${addr.postal_code}`, addr.country]
          .filter(Boolean)
          .join(", "),
      );
    } catch {
      addressHtml = escapeHtml(opts.shippingAddress);
    }
  }

  const productRowsHtml = opts.productLines
    .map(
      (p) =>
        `<tr><td style="padding: 6px 0; color: #333333;">${escapeHtml(p.name)}</td><td style="padding: 6px 0; text-align: center; color: #333333;">×${p.quantity}</td><td style="padding: 6px 0; text-align: right; color: #333333;">${(p.amountCents / 100).toFixed(2)} $</td></tr>`,
    )
    .join("");

  // Tax numbers (placeholders)
  const TPS_NUMBER = "XXXXX XXXX RT0001";
  const TVQ_NUMBER = "XXXX XXXX XXXX TQ0001";

  const i18n = {
    fr: {
      subject: `Confirmation de commande #${orderShort} — Badge`,
      heading: "Merci pour votre commande\u00a0!",
      orderLabel: "Commande",
      productsLabel: "Produits",
      subtotalLabel: "Sous-total",
      taxLabel: "Taxes (TPS/TVQ)",
      totalLabel: "Total",
      shippingLabel: "Livraison",
      nameLabel: "Nom",
      addressLabel: "Adresse",
      cta: "Voir mon tableau de bord",
      note: "Ce courriel ne remplace pas votre reçu Stripe, qui vous a été envoyé séparément.",
    },
    en: {
      subject: `Order confirmation #${orderShort} — Badge`,
      heading: "Thank you for your order!",
      orderLabel: "Order",
      productsLabel: "Products",
      subtotalLabel: "Subtotal",
      taxLabel: "Taxes (GST/QST)",
      totalLabel: "Total",
      shippingLabel: "Shipping",
      nameLabel: "Name",
      addressLabel: "Address",
      cta: "View my dashboard",
      note: "This email does not replace your Stripe receipt, which was sent separately.",
    },
  }[lang];

  const dashboardUrl = `${config.FRONTEND_URL}/dashboard`;

  return {
    to: opts.email,
    subject: i18n.subject,
    html: buildBaseEmail({
      body: `
        <h2 style="margin: 0 0 16px; color: #1a2e44; font-size: 20px;">${i18n.heading}</h2>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
          <tr><td style="padding: 8px 0; font-weight: bold; color: #333333; width: 100px;">${i18n.orderLabel}</td><td style="padding: 8px 0; color: #333333;">#${escapeHtml(orderShort)}</td></tr>
        </table>

        <h3 style="margin: 20px 0 8px; font-size: 14px; color: #1a2e44;">${i18n.productsLabel}</h3>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-top: 1px solid #eeeeee;">
          ${productRowsHtml}
          <tr style="border-top: 1px solid #eeeeee;"><td style="padding: 6px 0; font-weight: bold; color: #333333;" colspan="2">${i18n.subtotalLabel}</td><td style="padding: 6px 0; text-align: right; color: #333333;">${subtotal} $</td></tr>
          <tr><td style="padding: 6px 0; color: #666666;" colspan="2">${i18n.taxLabel}</td><td style="padding: 6px 0; text-align: right; color: #666666;">${tax} $</td></tr>
          <tr style="border-top: 2px solid #1a2e44;"><td style="padding: 8px 0; font-weight: bold; font-size: 16px; color: #1a2e44;" colspan="2">${i18n.totalLabel}</td><td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 16px; color: #1a2e44;">${total} $ CAD</td></tr>
        </table>

        <h3 style="margin: 20px 0 8px; font-size: 14px; color: #1a2e44;">${i18n.shippingLabel}</h3>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
          <tr><td style="padding: 6px 0; font-weight: bold; width: 100px; color: #333333;">${i18n.nameLabel}</td><td style="padding: 6px 0; color: #333333;">${safeName}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold; color: #333333;">${i18n.addressLabel}</td><td style="padding: 6px 0; color: #333333;">${addressHtml}</td></tr>
        </table>

        ${emailButton(i18n.cta, dashboardUrl)}

        <p style="color: #999999; font-size: 11px; margin-top: 8px;">TPS : ${TPS_NUMBER} | TVQ : ${TVQ_NUMBER}</p>
        <p style="color: #999999; font-size: 12px; margin-top: 8px;">${i18n.note}</p>`,
    }),
  };
}
