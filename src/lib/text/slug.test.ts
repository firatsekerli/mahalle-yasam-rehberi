import { describe, expect, it } from "vitest";
import { slugify, areaSlug } from "./slug";

describe("slugify", () => {
  it("maps Turkish letters to ASCII and lowercases", () => {
    expect(slugify("Çayyolu")).toBe("cayyolu");
    expect(slugify("Şişli")).toBe("sisli");
    expect(slugify("Gaziosmanpaşa")).toBe("gaziosmanpasa");
    expect(slugify("İnönü")).toBe("inonu");
    expect(slugify("Yıldız")).toBe("yildiz");
    expect(slugify("Öveçler")).toBe("ovecler");
    expect(slugify("Gölbaşı")).toBe("golbasi");
  });

  it("collapses spaces/punctuation to single hyphens and trims", () => {
    expect(slugify("  Kavaklıdere Mah.  ")).toBe("kavaklidere-mah");
    expect(slugify("100. Yıl")).toBe("100-yil");
  });

  it("is stable/idempotent", () => {
    const once = slugify("Çankaya / Ayrancı");
    expect(slugify(once)).toBe(once);
  });
});

describe("areaSlug", () => {
  it("joins il / ilçe / mahalle into a hierarchical slug", () => {
    expect(areaSlug("Ankara", "Çankaya", "Kavaklıdere")).toBe("ankara-cankaya-kavaklidere");
  });

  it("skips blank parts", () => {
    expect(areaSlug("Ankara", "", "Kızılay")).toBe("ankara-kizilay");
    expect(areaSlug("Ankara", undefined, null)).toBe("ankara");
  });
});
