import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Be_Vietnam_Pro } from "next/font/google";

import "./globals.css";
import { PWA_THEME_COLOR } from "@/config/pwa";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-erp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Toán Thầy Vinh ERP",
  description: "Hệ thống quản trị giáo dục Toán Thầy Vinh",
  applicationName: "Toán Thầy Vinh ERP",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "TTV ERP",
    // Translucent so the app paints the status-bar strip itself (see
    // `body::before` in globals.css) and dark mode stays seamless.
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Draw under the notch/home indicator; safe areas are handled in globals.css.
  viewportFit: "cover",
  themeColor: PWA_THEME_COLOR,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      className={beVietnamPro.variable}
      lang="vi"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (saved === 'dark' || (!saved && prefersDark)) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.setAttribute('data-theme', 'dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.setAttribute('data-theme', 'light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="bg-canvas text-ink antialiased transition-colors duration-200" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
