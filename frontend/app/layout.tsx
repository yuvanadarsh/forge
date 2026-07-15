import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="h-full flex" style={{ background: "#0a0a0a", color: "#f5f5f5" }}>
        <ForgeProvider>
          <Sidebar />
          <main className="flex-1 ml-[220px] min-h-screen overflow-y-auto">
            {children}
          </main>
        </ForgeProvider>
      </body>
    </html>
  );
}
