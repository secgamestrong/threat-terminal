import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Threat Terminal — Can you spot the phish?",
  description:
    "A phishing literacy game built around forensic signals, confidence scoring, and opt-in research.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

