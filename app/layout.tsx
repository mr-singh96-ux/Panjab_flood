import type React from "react"
import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { Suspense } from "react"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
})

export const metadata: Metadata = {
  title: "Flood Relief Coordination",
  description: "Emergency coordination system for flood victims and volunteers",
  generator: "v0.app",
  manifest: "/manifest.json",
  themeColor: "#dc2626",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="FloodCoord" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/placeholder.svg?height=192&width=192" />
      </head>
      <body className={`font-sans ${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <Suspense fallback={null}>{children}</Suspense>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('[SW] Registration successful:', registration.scope);
                      
                      // Listen for service worker messages
                      navigator.serviceWorker.addEventListener('message', function(event) {
                        if (event.data && event.data.type === 'BACKGROUND_SYNC') {
                          // Trigger sync in the main thread
                          window.dispatchEvent(new CustomEvent('background-sync'));
                        }
                      });
                    })
                    .catch(function(error) {
                      console.log('[SW] Registration failed:', error);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
