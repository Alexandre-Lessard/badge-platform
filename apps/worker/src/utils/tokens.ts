import { importPKCS8, importSPKI, SignJWT, jwtVerify } from "jose";
import { createHash } from "node:crypto";
import { getConfig } from "../config.js";

let privateKey: CryptoKey;
let publicKey: CryptoKey;

async function getPrivateKey() {
  if (!privateKey) {
    const config = getConfig();
    const pem = Buffer.from(config.JWT_PRIVATE_KEY, "base64").toString("utf8");
    privateKey = await importPKCS8(pem, "EdDSA");
  }
  return privateKey;
}

async function getPublicKey() {
  if (!publicKey) {
    const config = getConfig();
    const pem = Buffer.from(config.JWT_PUBLIC_KEY, "base64").toString("utf8");
    publicKey = await importSPKI(pem, "EdDSA");
  }
  return publicKey;
}

export type TokenPayload = {
  sub: string; // user ID
  type: "access" | "refresh";
  iat: number; // issued at (unix seconds)
};

export async function signAccessToken(userId: string): Promise<string> {
  const config = getConfig();
  const key = await getPrivateKey();

  return new SignJWT({ type: "access" })
    .setProtectedHeader({ alg: "EdDSA" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(config.JWT_ACCESS_EXPIRES_IN)
    .sign(key);
}

export async function signRefreshToken(userId: string): Promise<string> {
  const config = getConfig();
  const key = await getPrivateKey();

  return new SignJWT({ type: "refresh" })
    .setProtectedHeader({ alg: "EdDSA" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(config.JWT_REFRESH_EXPIRES_IN)
    .sign(key);
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const key = await getPublicKey();
  const { payload } = await jwtVerify(token, key, {
    algorithms: ["EdDSA"],
  });

  return {
    sub: payload.sub!,
    type: payload.type as "access" | "refresh",
    iat: payload.iat!,
  };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
