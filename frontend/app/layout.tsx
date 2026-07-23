import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ErrorBanner from "@/components/ErrorBanner";
import GlobalDropOverlay from "@/components/GlobalDropOverlay";
import Sidebar from "@/components/Sidebar";
import { ForgeProvider } from "@/lib/store";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Code blocks in chat messages (components/chat/CodeBlock.tsx).
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Forge — Multi-Agent AI Orchestration",
  description: "Spawn specialized AI agents, assign tasks, and watch them execute pipelines.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} h-full`}>
      <body className="h-full flex" style={{ background: "#0a0a0a", color: "#f5f5f5" }}>
        <ForgeProvider>
          <Sidebar />
          <main className="flex-1 ml-[220px] min-h-screen overflow-y-auto">
            <ErrorBanner />
            {children}
          </main>
          <GlobalDropOverlay />
        </ForgeProvider>
      </body>
    </html>
  );
}
