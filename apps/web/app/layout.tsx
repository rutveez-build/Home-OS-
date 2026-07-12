import type { Metadata, Viewport } from "next";
import { brand } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: `${brand.name} — ${brand.tagline}`,
  description: brand.tagline,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#128C7E" },
    { media: "(prefers-color-scheme: dark)", color: "#202C33" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0..1,0&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        {/* Apply the saved theme before first paint — no flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}',
          }}
        />
        {children}
      </body>
    </html>
  );
}
