import { notFound } from "next/navigation";
import { getPointReport } from "@/lib/report/data";
import ReportView from "@/components/ReportView";
import { T } from "@/lib/i18n/tr";

/** Arbitrary-point report (§19.4): /nokta?lat=..&lng=..&profile=.. */
export default async function PointReportPage({
  searchParams,
}: {
  searchParams: Promise<{ lat?: string; lng?: string; profile?: string }>;
}) {
  const { lat: latStr, lng: lngStr, profile } = await searchParams;
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

  const report = await getPointReport(lat, lng, profile, T.report.pointLabel);
  return (
    <ReportView
      report={report}
      profileHref={(p) => `/nokta?lat=${lat}&lng=${lng}&profile=${p}`}
    />
  );
}
