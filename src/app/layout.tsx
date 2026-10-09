import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Save no Jutsu — the hidden art of understanding what you save",
  description:
    "Upload an Instagram saved-posts JSON export to map topics, creators, and save patterns. No Instagram login. No Reel downloads.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
