import { notFound } from "next/navigation";
import { getPointReport } from "@/lib/report/data";
import ReportView from "@/components/ReportView";
import { T } from "@/lib/i18n/tr";

/**
 * Arbitrary-point report (§19.4): /nokta?lat=..&lng=..&profile=..
 * A selected mahalle passes label/il/ilçe so the header names the area; a raw
 * map pin has none and falls back to the generic "Seçilen nokta" label.
 */
export default async function PointReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    lat?: string;
    lng?: string;
    profile?: string;
    label?: string;
    il?: string;
    ilce?: string;
  }>;
}) {
  const { lat: latStr, lng: lngStr, profile, label, il, ilce } = await searchParams;
  const lat = Number(latStr);
  const lng = Number(lngStr);

  // Guard against missing/invalid or out-of-range coordinates.
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    notFound();
  }

  const report = await getPointReport(lat, lng, profile, label || T.report.pointLabel, {
    district: ilce,
    city: il,
  });

  // Preserve the area labels across profile switches.
  const extra = [
    label ? `label=${encodeURIComponent(label)}` : "",
    il ? `il=${encodeURIComponent(il)}` : "",
    ilce ? `ilce=${encodeURIComponent(ilce)}` : "",
  ]
    .filter(Boolean)
    .join("&");

  return (
    <ReportView
      report={report}
      profileHref={(p) => `/nokta?lat=${lat}&lng=${lng}&profile=${p}${extra ? `&${extra}` : ""}`}
    />
  );
}
