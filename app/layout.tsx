import type { Metadata } from "next";
import { Electrolize } from "next/font/google";
import "./globals.css";

const electrolize = Electrolize({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-electrolize",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cytus II Chart Forum",
  description: "Cytus II 谱面查询与交流站",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={electrolize.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
