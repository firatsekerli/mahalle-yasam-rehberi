/**
 * Turkish-aware slugification for stable area identifiers (§19.2 selector, §23 SEO).
 *
 * Maps Turkish letters to their ASCII base (İ/I→i, ş→s, ç→c, ğ→g, ö→o, ü→u) so a
 * mahalle like "Çayyolu" becomes "cayyolu", then lowercases, strips any remaining
 * combining accents, and joins the leftover word characters with hyphens.
 * Deterministic and stable enough to be a key; never shown to users.
 */

const TR_MAP: Record<string, string> = {
  ç: "c", Ç: "c",
  ğ: "g", Ğ: "g",
  ı: "i", I: "i", İ: "i", i: "i",
  ö: "o", Ö: "o",
  ş: "s", Ş: "s",
  ü: "u", Ü: "u",
};

export function slugify(value: string): string {
  const mapped = value.replace(/[çÇğĞıIİiöÖşŞüÜ]/g, (ch) => TR_MAP[ch] ?? ch);
  return mapped
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip remaining combining accents
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
}

/** Compose a hierarchical slug from il / ilçe / mahalle parts, skipping blanks. */
export function areaSlug(...parts: (string | undefined | null)[]): string {
  return parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .map(slugify)
    .filter(Boolean)
    .join("-");
}
