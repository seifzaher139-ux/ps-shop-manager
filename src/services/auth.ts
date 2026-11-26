const encoder = new TextEncoder();
function hex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
export async function hashSecret(secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const result = await derive(secret, salt, 210000);
  return `pbkdf2:210000:${hex(salt)}:${result}`;
}
async function derive(
  secret: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return hex(
    new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        key,
        256,
      ),
    ),
  );
}
export async function verifySecret(
  secret: string,
  stored: string,
): Promise<boolean> {
  try {
    const [kind, n, salt, expected] = stored.split(':');
    if (
      kind !== 'pbkdf2' ||
      Number(n) < 200000 ||
      Number(n) > 1000000 ||
      salt.length !== 32 ||
      expected.length !== 64
    )
      return false;
    const actual = await derive(
      secret,
      Uint8Array.from(salt.match(/../g)!, (h) => parseInt(h, 16)),
      Number(n),
    );
    let difference = 0;
    for (let i = 0; i < actual.length; i++)
      difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
    return difference === 0;
  } catch {
    return false;
  }
}
export function recoveryCode() {
  return hex(crypto.getRandomValues(new Uint8Array(12)))
    .toUpperCase()
    .match(/.{1,4}/g)!
    .join('-');
}
