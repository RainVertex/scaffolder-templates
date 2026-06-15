const STRAPI_URL = import.meta.env.VITE_STRAPI_URL ?? "http://localhost:1337";

export async function fetchFromStrapi<T>(path: string): Promise<T> {
  const res = await fetch(`${STRAPI_URL}/api/${path}`);
  if (!res.ok) {
    throw new Error(`Strapi request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}
