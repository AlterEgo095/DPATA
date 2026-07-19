import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "PlagiatIA — Plate-forme intelligente d'aide à la détection du plagiat | UNIKIN",
  description: "Plate-forme intelligente d'aide à la détection du plagiat et au choix d'un sujet de mémoire. Cas de la Faculté des Sciences et Technologies, Université de Kinshasa.",
  keywords: ["plagiat", "IA", "Intelligence Artificielle", "UNIKIN", "Faculté des Sciences", "mémoire", "TFC", "NLP", "embeddings"],
  authors: [{ name: "Moïse KASOMBO" }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PlagiatIA',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'PlagiatIA',
    title: 'PlagiatIA — Plateforme Anti-Plagiat',
    description: 'Plateforme intelligente de détection du plagiat académique',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PlagiatIA',
    description: "Plateforme anti-plagiat académique propulsée par l'IA",
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-152x152.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="PlagiatIA" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="PlagiatIA" />
        <meta name="msapplication-TileColor" content="#059669" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
      </head>
      <body className={`${inter.variable} antialiased bg-background text-foreground`}>
        {children}
        <Toaster />
        <SonnerToaster richColors position="top-right" />
      </body>
    </html>
  );
}
