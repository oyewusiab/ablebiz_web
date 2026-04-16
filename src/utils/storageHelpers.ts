export function safeParse<T>(value: string | null, fallback: T): T {
  try {
    if (!value) return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return safeParse<T>(window.localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function uid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}

export function secureUint32() {
  try {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] ?? Math.floor(Math.random() * 2 ** 32);
  } catch {
    return Math.floor(Math.random() * 2 ** 32);
  }
}

export function secureRandomFloat() {
  return secureUint32() / 2 ** 32;
}

export function secureRandomInt(maxExclusive: number) {
  if (maxExclusive <= 0) return 0;
  return Math.floor(secureRandomFloat() * maxExclusive);
}

export function normalizePhone(phone: string) {
  return phone.replace(/\s+/g, "").trim();
}
