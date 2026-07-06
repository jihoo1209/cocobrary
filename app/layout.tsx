import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CocoTree",
  description: "A cute shared summer vacation photo album prototype.",
  icons: {
    apple: "/assets/coconut-04.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-[var(--font-body)] text-[var(--ink)]">{children}</body>
    </html>
  );
}
