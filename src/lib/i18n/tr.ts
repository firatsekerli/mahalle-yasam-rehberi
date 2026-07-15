/**
 * Turkish UI strings and label maps (CLAUDE.md — Turkey-first product, §1, §18.1).
 *
 * Turkish is the launch language. All user-facing copy lives here (and the
 * Turkish display names in the taxonomy/profiles), never hard-coded in
 * components, so a second locale can be added later without touching JSX. English
 * `name` fields stay as the canonical/DB values; these are display only.
 */

import type { WeightKey } from "@/lib/scoring/config";
import type { ConfidenceLabel } from "@/lib/scoring/neighborhood";
import type { FreshnessLabel } from "@/lib/demographics/facts";
import type { AdminLevel } from "@/lib/data/adapters/demographics";

/** Data-confidence labels (§13). */
export const CONFIDENCE_LABEL_TR: Record<ConfidenceLabel, string> = {
  high: "yüksek",
  good: "iyi",
  limited: "sınırlı",
  experimental: "deneysel",
};

/** Demographic freshness labels (§13). */
export const FRESHNESS_LABEL_TR: Record<FreshnessLabel, string> = {
  current: "güncel",
  recent: "yakın tarihli",
  dated: "eski",
  stale: "çok eski",
};

/** Administrative-unit nouns for demographic facts. */
export const ADMIN_LEVEL_TR: Record<AdminLevel, string> = {
  province: "il",
  district: "ilçe",
  neighborhood: "mahalle",
};

/**
 * Turkish labels for the scoring weight dimensions. Covers every `WeightKey`,
 * including the derived ones (business quality, late-hour) that are not taxonomy
 * score groups.
 */
export const WEIGHT_LABEL_TR: Record<WeightKey, string> = {
  daily_essentials: "Günlük temel ihtiyaçlar",
  health_wellbeing: "Sağlık ve iyi yaşam",
  transport_mobility: "Ulaşım ve hareketlilik",
  family_education: "Aile ve eğitim",
  food_social: "Yeme-içme ve sosyal yaşam",
  fitness_recreation: "Spor ve rekreasyon",
  business_quality: "İşletme kalitesi ve güvenilirliği",
  pet_services: "Evcil hayvan hizmetleri",
  late_hour_convenience: "Geç saat kolaylığı",
};

/** Static UI copy, grouped by screen. */
export const T = {
  brand: "Mahalle Yaşam",
  common: {
    perScore: "/ 100",
    dataConfidence: "veri güvenilirliği",
    allNeighborhoods: "← Tüm mahalleler",
    approximateBoundary: "yaklaşık sınır",
  },
  home: {
    eyebrow: "Mahalle Yaşam · Ankara",
    heroTitle: "Bu mahallede günlük yaşam nasıl?",
    heroLead:
      "Kiralamadan veya satın almadan önce, bir mahallenin günlük ihtiyaçlarınızı — market, sağlık, ulaşım, yeme-içme, aile, evcil hayvan ve daha fazlasını — ne kadar kolay karşıladığını açıklanabilir, kişiselleştirilmiş bir puanla görün.",
    searchPlaceholder: "Bir Ankara adresi veya mahallesi arayın…",
    searchButton: "Ara",
    searchNote:
      "Kapsam, elle incelenmiş küçük bir Ankara mahalle grubuyla başlar. Veri güvenilirliğini gösterir ve asla tam kapsam iddiasında bulunmayız.",
    trySample: "Örnek bir rapor deneyin:",
    features: {
      personalTitle: "Yaşamınıza göre kişiselleştirilmiş",
      personalBody:
        "Bir yaşam tarzı profili seçin — aile, öğrenci, arabasız, evcil hayvan sahibi — puan sizin için önemli olana göre yeniden ağırlıklandırılır. Gerçekler değişmez, yalnızca ağırlıkları değişir.",
      compareTitle: "Mahalleleri karşılaştırın",
      compareBody:
        "İki veya üç bölgeyi aynı modelle yan yana koyun — günlük ihtiyaçlar, sağlık, ulaşım, yeme-içme ve daha fazlası — ve size hangisinin daha uygun olduğunu görün.",
      prosTitle: "Emlak profesyonelleri için",
      prosBody:
        "Bir ilan için markalı mahalle raporları oluşturun ve mülk sayfalarınıza bir widget yerleştirin. Nesnel, paylaşılabilir, müşteri adayı toplayan.",
    },
    profilesTitle: "Tek mahalle, birçok yaşam",
    profilesLead: "Aynı mahalle, kim olduğunuza göre farklı puan alır.",
    footerData:
      "Yer verileri © OpenStreetMap katkıda bulunanları. İşletme başına gösterilen puanlar ve yorumlar talep üzerine alınır ve sağlayıcısına atıfta bulunulur.",
    footerDisclaimer:
      "Puanlar hâlihazırda mevcut verilere dayanır ve her işletmeyi veya son değişiklikleri içermeyebilir.",
  },
  picker: {
    heading: "Mahalle / nokta",
    singleReport: "Tek rapor",
    compare: "Karşılaştır",
    comingSoon: "yakında",
    step: (n: number, total: number) => `${n} / ${total}`,
    city: "İl",
    district: "İlçe",
    selectNeighborhood: "Mahalle seçin",
    searchPlaceholder: "Mahalle arayın…",
    noResults: "Sonuç bulunamadı.",
    fromMap: "Haritadan seç",
    createReport: "Rapor oluştur",
    selectPrompt: "Bir mahalle seçin",
    mapPickTitle: "Haritadan bir nokta seçin",
    mapPickPrompt: "Rapor almak istediğiniz noktaya haritada tıklayın.",
    mapPickButton: "Bu noktada rapor oluştur",
    mapPickChosen: "Seçilen nokta",
    mapPickFallback:
      "Harita yapılandırılmadı. Nokta seçimi için harita sağlayıcısı (NEXT_PUBLIC_MAP_TILES_URL) gereklidir.",
    back: "← Geri",
  },
  report: {
    pointLabel: "Seçilen nokta",
    sampleDataLabel: "Örnek veri.",
    scoreLabel: "Mahalle Yaşam Puanı / 100",
    lifestyleProfile: "Yaşam tarzı profili",
    lifestyleNote: "Ağırlıklar değişir; gerçekler değişmez.",
    strengths: "Güçlü yönler",
    weaknesses: "Zayıf yönler",
    missingEssentials: "Yakında eksik temel hizmetler",
    noStrengths: "Henüz öne çıkan bir güçlü yön yok.",
    noWeaknesses: "Önemli bir zayıf yön yok.",
    allEssentials: "Tüm temel hizmetler yakında karşılanıyor.",
    categoryScores: "Kategori puanları",
    categoryNote:
      "profili için ağırlıklandırıldı. Mesafeler mahalle merkezinden kuş uçuşudur (yürüyüş rotası değildir).",
    nearbyTitle: "Yakın çevre",
    nearbyIntro:
      "Ölçüm merkezinin çevresinde bulabildiğimiz tesislerin kategorilere göre sayısı. Yalnızca tanıdığımız kategoriler sayılır; her işletmenin dahil olduğu iddia edilmez.",
    nearbyTotal: (n: number) => `${n} tesis`,
    nearbyCount: (n: number) => `${n} adet`,
    nearbyNearest: (m: number) => `en yakını ≈ ${m} m`,
    nearbyEmpty: "Bu bölge için henüz kategorize edilmiş tesis verisi yok.",
    topNearby: "Yakındaki en iyi seçenekler",
    businessesTitle: "Bu mahalledeki işletmeler",
    businessesCount: (shown: number, total: number) =>
      shown < total ? `${total} işletme bulundu — en yakın ${shown} tanesi gösteriliyor` : `${total} işletme bulundu`,
    businessesEmpty: "Bu bölge için henüz işletme verisi yüklenmedi.",
    liveData: "Canlı OpenStreetMap verisi",
    walkNote: "~ ile gösterilen yürüyüş süreleri, kuş uçuşu mesafeye göre tahminidir (gerçek rota değildir).",
    walkRoutedNote: "Yürüyüş süreleri gerçek yürüyüş rotasına dayanır (openrouteservice).",
    walkExplainerTitle: "Yürüyüş süresi nasıl hesaplanır?",
    walkExplainerIntro:
      "Bu süreler, mahalle merkezinden bir yere yürüyerek yaklaşık ne kadar sürede ulaşabileceğinizi gösterir.",
    walkExplainerRouted:
      "≤10 dk / ≤15 dk: Gerçek sokak ve yaya yolu ağı üzerinden hesaplanır (openrouteservice) — yani o kadar dakikada yürüyerek ulaşılabilen bölgenin içinde demektir.",
    walkExplainerEstimate:
      "~ (tahmini): Kuş uçuşu mesafeye ve ortalama ~4,8 km/s yürüyüş hızına göre tahmin edilir; gerçek yürüyüş rotası değildir ve genellikle iyimserdir.",
    walkExplainerCaveat:
      "Süreler mahalle merkezinden ölçülür (belirli bir adresten değil) ve yokuşlar süreyi uzatabilir.",
    walkMin: (min: number) => `~${min} dk`,
    walkWithin: (min: number) => `≤${min} dk`,
    measurementCenter: "Ölçüm merkezi",
    measurementCenterNote: "Mesafe ve yürüyüş süreleri bu noktadan hesaplanır (yaklaşık).",
    viewOnMap: "haritada gör",
    mapTitle: "Harita",
    mapCenterLabel: "Ölçüm merkezi",
    mapFallback:
      "Harita henüz yapılandırılmadı. Ölçüm merkezini yukarıdaki “haritada gör” bağlantısından görebilirsiniz.",
    mapNote:
      "Mavi işaret ölçüm merkezidir; yeşil noktalar işletmelerdir. Yeşil alanlar (varsa) 10/15 dakikalık yürüyüş erişimini gösterir.",
    unavailable:
      "Henüz mevcut değil — elimizde olmayan veriye ihtiyaç duyar (puana dahil edilmez, sıfır sayılmaz).",
    weight: "ağırlık",
    demographics: "Demografi",
    registeredPopulation: "kayıtlı nüfus",
    avgHousehold: "Ortalama hane büyüklüğü:",
    demographicsPending:
      "Bu bölge için resmî nüfus rakamları henüz içe aktarılmadı. Yalnızca TÜİK ADNKS (Türkiye İstatistik Kurumu, Adrese Dayalı Nüfus Kayıt Sistemi) kaynağından alınacak ve atıf yapılmış, tarihli gerçekler olarak gösterilecek — asla tahmin edilmeyecek ve puanı değiştirmek için kullanılmayacaktır.",
    footer: (version: string) =>
      `Yer verileri © OpenStreetMap katkıda bulunanları. Puanlama sürümü ${version}. Puanlar hâlihazırda mevcut verilere dayanır ve her işletmeyi içerdiği iddiasında değildir.`,
  },
} as const;

/** Score band label for the summary, from an overall 0..100 score. */
export function scoreBandTr(overall: number): string {
  if (overall >= 80) return "çok iyi";
  if (overall >= 65) return "iyi";
  if (overall >= 45) return "orta";
  return "sınırlı";
}
