import './globals.css';
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, Sora } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Controle de Pedidos",
  description:
    "Sistema de controle de pedidos por loja, leitura de PDF e análise de indicadores mensais",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Controle de Pedidos",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/icon-192x192.png",
    apple: "/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#121216",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${sora.variable}`}>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {`try{if(localStorage.getItem('sistema-leti-theme')==='light'){document.documentElement.dataset.theme='light';document.documentElement.style.colorScheme='light';}}catch(e){}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
