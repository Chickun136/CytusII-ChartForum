import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cytus II Chart Forum",
  description: "Cytus II 谱面查询与交流站",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
