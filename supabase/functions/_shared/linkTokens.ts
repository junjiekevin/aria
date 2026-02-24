export type LinkTokenKind = "ics" | "cancel";

export interface LinkTokenPayload {
  kind: LinkTokenKind;
  entryId: string;
  exp: number; // unix seconds
  occurrenceDate?: string; // YYYY-MM-DD for cancellation tokens
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(base64Url: string): Uint8Array {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    + "=".repeat((4 - (base64Url.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function sign(value: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createSignedLinkToken(
  payload: LinkTokenPayload,
  secret: string
): Promise<string> {
  const payloadB64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

export async function verifySignedLinkToken(
  token: string,
  secret: string
): Promise<LinkTokenPayload | null> {
  const [payloadB64, signatureB64] = token.split(".");
  if (!payloadB64 || !signatureB64) return null;

  const expectedSig = await sign(payloadB64, secret);
  const expectedBytes = base64UrlToBytes(expectedSig);
  const providedBytes = base64UrlToBytes(signatureB64);
  if (!timingSafeEqual(expectedBytes, providedBytes)) return null;

  try {
    const payloadText = new TextDecoder().decode(base64UrlToBytes(payloadB64));
    const payload = JSON.parse(payloadText) as LinkTokenPayload;
    if (!payload?.kind || !payload?.entryId || typeof payload?.exp !== "number") {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

