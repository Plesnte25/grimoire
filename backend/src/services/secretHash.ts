import crypto from "node:crypto";

const PBKDF2_ITERATIONS = 120_000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = "sha256";

export function randomSaltHex(): string {
    return crypto.randomBytes(16).toString("hex");
}

function deriveHex(secret: string, saltHex: string): string {
    return crypto
        .pbkdf2Sync(secret, saltHex, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
        .toString("hex");
}

export function hashWithSalt(secret: string): { saltHex: string; hashHex: string } {
    const saltHex = randomSaltHex();
    return { saltHex, hashHex: deriveHex(secret, saltHex) };
}

export function verifyWithSalt(secret: string, saltHex: string, hashHex: string): boolean {
    const candidate = deriveHex(secret, saltHex);
    const a = Buffer.from(candidate, "hex");
    const b = Buffer.from(hashHex, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

// Packs salt+hash into one string, for models with a single hash column (e.g. OtpCode.codeHash).
export function packSaltedHash(secret: string): string {
    const { saltHex, hashHex } = hashWithSalt(secret);
    return `${saltHex}:${hashHex}`;
}

export function verifyPackedSaltedHash(secret: string, packed: string): boolean {
    const [saltHex, hashHex] = packed.split(":");
    if (!saltHex || !hashHex) return false;
    return verifyWithSalt(secret, saltHex, hashHex);
}
