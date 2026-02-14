import type { AnonymizedUser } from "./schema.ts";

const ADJECTIVES = [
  "Swift", "Gentle", "Bold", "Quiet", "Bright", "Calm", "Eager",
  "Fair", "Grand", "Happy", "Keen", "Lucky", "Noble", "Proud",
  "Quick", "Warm", "Wise", "Cool", "Deep", "Free", "Kind",
  "Pure", "Rich", "Safe", "True", "Wild", "Brave", "Clear",
];

const ANIMALS = [
  "Fox", "Owl", "Bear", "Deer", "Wolf", "Hawk", "Lynx", "Seal",
  "Crane", "Robin", "Otter", "Raven", "Finch", "Heron", "Wren",
  "Dove", "Lark", "Swan", "Pike", "Newt", "Moth", "Toad",
  "Crow", "Mole", "Hare", "Goat", "Ibis", "Kite",
];

async function computeHash(input: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(input),
  );

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class Anonymizer {
  private secret: string;
  private cache = new Map<string, AnonymizedUser>();

  constructor(secret?: string) {
    this.secret = secret ?? crypto.randomUUID();
  }

  async anonymize(user: { id: string; username: string }): Promise<AnonymizedUser> {
    const key = `${user.id}:${user.username}`;

    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const hash = await computeHash(key, this.secret);

    const adjIdx = parseInt(hash.slice(0, 8), 16) % ADJECTIVES.length;
    const animalIdx = parseInt(hash.slice(8, 16), 16) % ANIMALS.length;
    const suffix = parseInt(hash.slice(16, 20), 16) % 1000;

    const anonymizedName = `${ADJECTIVES[adjIdx]}${ANIMALS[animalIdx]}${suffix}`;
    const avatarSeed = hash.slice(0, 16);
    const anonymizedAvatarUrl = `https://api.dicebear.com/9.x/shapes/svg?seed=${avatarSeed}`;

    const result: AnonymizedUser = {
      anonymizedId: hash.slice(0, 12),
      anonymizedName,
      anonymizedAvatarUrl,
    };

    this.cache.set(key, result);
    return result;
  }

  get uniqueCount(): number {
    return this.cache.size;
  }
}
