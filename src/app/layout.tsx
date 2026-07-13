import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Mahalle Yaşam — Bu mahallede günlük yaşam nasıl?",
    template: "%s · Mahalle Yaşam",
  },
  description:
    "Kiralamadan veya satın almadan önce, bir mahallenin günlük ihtiyaçlarınızı — market, sağlık, ulaşım, yeme-içme, aile, evcil hayvan ve daha fazlasını — ne kadar kolay karşıladığını açıklanabilir, kişiselleştirilmiş bir puanla görün.",
  metadataBase: new URL("https://neighborhoodlife.local"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
