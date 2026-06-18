import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PlagiatIA — Plateforme anti-plagiat IA | UNIKIN",
  description: "Plateforme web intelligente de détection automatique du plagiat dans les travaux académiques. Cas pilote : Faculté des Sciences, Université de Kinshasa.",
  keywords: ["plagiat", "IA", "Intelligence Artificielle", "UNIKIN", "Faculté des Sciences", "mémoire", "TFC", "NLP", "embeddings"],
  authors: [{ name: "Moïse KASOMBO" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased bg-background text-foreground`}>
        {children}
        <Toaster />
        <SonnerToaster richColors position="top-right" />
      </body>
    </html>
  );
}
