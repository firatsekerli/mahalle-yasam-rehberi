import { T } from "@/lib/i18n/tr";

/** Instant loading UI while a report renders on the server (esp. live point reports). */
export default function ReportLoading() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col items-center justify-center px-6 py-32 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand-600" />
      <p className="mt-4 text-sm text-muted">{T.picker.creating}</p>
    </main>
  );
}
