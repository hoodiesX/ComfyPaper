import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Make Research Papers Readable on Kindle and iPad",
  description:
    "Optimize academic PDFs, two-column papers and technical documents for Kindle, iPad and e-readers. Split columns, clean margins and export reading-friendly PDFs locally in your browser.",
  openGraph: {
    title: "Make Research Papers Readable on Kindle and iPad",
    description:
      "Split two-column academic PDFs into reading pages, clean margins and export reading-friendly PDFs locally in your browser.",
    type: "website"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
