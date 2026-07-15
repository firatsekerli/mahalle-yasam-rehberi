import Link from "next/link";
import MapPicker from "@/components/MapPicker";
import { T } from "@/lib/i18n/tr";

/** Ankara (Kızılay) as the default picker center. */
const ANKARA_CENTER = { lat: 39.9208, lng: 32.8541 };

export default function MapPickerPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/" className="text-sm text-brand-600 hover:underline">
        {T.picker.back}
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">{T.picker.mapPickTitle}</h1>
      <p className="mt-1 text-sm text-muted">{T.picker.mapPickPrompt}</p>
      <div className="mt-6">
        <MapPicker
          styleUrl={process.env.NEXT_PUBLIC_MAP_TILES_URL || undefined}
          initialCenter={ANKARA_CENTER}
        />
      </div>
    </main>
  );
}
