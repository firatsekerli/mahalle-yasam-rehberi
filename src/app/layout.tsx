import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Neighborhood Life — What is daily life like in this neighborhood?",
    template: "%s · Neighborhood Life",
  },
  description:
    "Before you rent or buy, see how easily a neighborhood covers your daily needs — groceries, health, transport, food, family, pets and more — with an explainable, personalized score.",
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
