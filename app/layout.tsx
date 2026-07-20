import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workato Genie Chat",
  description: "Chat interface for a Workato Genie",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
