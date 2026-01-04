import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskPulse | Urgency Dashboard",
  description: "AI-integrated triage engine for Google Tasks."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased">{children}</body>
    </html>
  );
}
