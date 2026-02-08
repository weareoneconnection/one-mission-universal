import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Providers from "./providers";
import TopNav from "@/components/TopNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "One Mission Universal",
  description: "Proof of Contribution Infrastructure",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-gray-900`}>
        <Providers>
          <TopNav />

          {/* ✅ 全站统一容器：手机不贴边、不留怪空白 */}
          <main className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 pb-10">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
