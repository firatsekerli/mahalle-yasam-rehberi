import { notFound } from "next/navigation";
import { getNeighborhoodReport } from "@/lib/report/data";
import ReportView from "@/components/ReportView";

export default async function NeighborhoodReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ profile?: string }>;
}) {
  const { slug } = await params;
  const { profile: profileSlug } = await searchParams;
  const report = await getNeighborhoodReport(slug, profileSlug);
  if (!report) notFound();

  return <ReportView report={report} profileHref={(p) => `/n/${slug}?profile=${p}`} />;
}
