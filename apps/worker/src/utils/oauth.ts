import { getConfig } from "../config.js";

export type OAuthProfile = {
  providerId: string;
  email: string | null;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
};

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<OAuthProfile> {
  const config = getConfig();
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth not configured");
  }

  // Exchange the code for an access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${err}`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    token_type: string;
  };

  // Fetch user profile
  const userRes = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    },
  );

  if (!userRes.ok) {
    throw new Error("Google userinfo fetch failed");
  }

  const profile = (await userRes.json()) as {
    sub: string;
    email?: string;
    email_verified?: boolean;
    given_name?: string;
    family_name?: string;
    name?: string;
  };

  return {
    providerId: profile.sub,
    email: profile.email ?? null,
    firstName: profile.given_name || profile.name || "",
    lastName: profile.family_name || "",
    emailVerified: profile.email_verified ?? false,
  };
}

export async function exchangeFacebookCode(
  code: string,
  redirectUri: string,
): Promise<OAuthProfile> {
  const config = getConfig();
  if (!config.FACEBOOK_CLIENT_ID || !config.FACEBOOK_CLIENT_SECRET) {
    throw new Error("Facebook OAuth not configured");
  }

  // Exchange the code for an access token
  const tokenRes = await fetch(
    "https://graph.facebook.com/v21.0/oauth/access_token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.FACEBOOK_CLIENT_ID,
        client_secret: config.FACEBOOK_CLIENT_SECRET,
        redirect_uri: redirectUri,
      }),
    },
  );

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Facebook token exchange failed: ${err}`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    token_type: string;
  };

  // Fetch user profile
  const userRes = await fetch(
    `https://graph.facebook.com/v21.0/me?fields=id,email,first_name,last_name,name`,
    {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    },
  );

  if (!userRes.ok) {
    throw new Error("Facebook Graph API /me fetch failed");
  }

  const profile = (await userRes.json()) as {
    id: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    name?: string;
  };

  return {
    providerId: profile.id,
    email: profile.email ?? null,
    firstName: profile.first_name || profile.name || "",
    lastName: profile.last_name || "",
    emailVerified: !!profile.email, // Facebook verified emails
  };
}

export async function exchangeMicrosoftCode(
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<OAuthProfile> {
  const config = getConfig();
  if (!config.MICROSOFT_CLIENT_ID || !config.MICROSOFT_CLIENT_SECRET) {
    throw new Error("Microsoft OAuth not configured");
  }

  // Exchange the code for an access token
  const tokenRes = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.MICROSOFT_CLIENT_ID,
        client_secret: config.MICROSOFT_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
        scope: "openid profile email",
      }),
    },
  );

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Microsoft token exchange failed: ${err}`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    token_type: string;
  };

  // Fetch profile via Microsoft Graph
  const userRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) {
    throw new Error("Microsoft Graph /me fetch failed");
  }

  const profile = (await userRes.json()) as {
    id: string;
    mail?: string | null;
    userPrincipalName?: string;
    givenName?: string;
    surname?: string;
    displayName?: string;
  };

  // Determine email: mail > userPrincipalName (except .onmicrosoft.com)
  let email: string | null = profile.mail ?? null;
  if (!email && profile.userPrincipalName) {
    if (!profile.userPrincipalName.endsWith(".onmicrosoft.com")) {
      email = profile.userPrincipalName;
    }
  }

  return {
    providerId: profile.id,
    email,
    firstName: profile.givenName || profile.displayName || "",
    lastName: profile.surname || "",
    emailVerified: !!email, // Microsoft accounts with a verified email
  };
}
