const encoder = new TextEncoder();

function base64urlEncode(str: string | Uint8Array): string {
  let base64 = "";
  if (typeof str === "string") {
    base64 = btoa(unescape(encodeURIComponent(str)));
  } else {
    // Convert Uint8Array to string character-by-character safely
    const bytes = Array.from(str);
    let binary = "";
    const len = bytes.length;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64urlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  // Decode safely supporting UTF-8 characters
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const keyData = encoder.encode(secret);
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signJWT(
  payload: Record<string, any>,
  secret: string,
  expiresInSeconds: number = 8 * 3600
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const expPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(expPayload));
  const tokenInput = `${headerB64}.${payloadB64}`;

  const cryptoKey = await getCryptoKey(secret);
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(tokenInput)
  );

  const signatureB64 = base64urlEncode(new Uint8Array(signatureBuffer));
  return `${tokenInput}.${signatureB64}`;
}

export async function verifyJWT(token: string, secret: string): Promise<Record<string, any> | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  const tokenInput = `${headerB64}.${payloadB64}`;

  try {
    const cryptoKey = await getCryptoKey(secret);
    
    // Decode base64url to bytes
    const base64 = signatureB64.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const signatureBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      signatureBytes[i] = binary.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      signatureBytes,
      encoder.encode(tokenInput)
    );

    if (!isValid) return null;

    const payload = JSON.parse(base64urlDecode(payloadB64));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired token
    }

    return payload;
  } catch (err) {
    return null;
  }
}
