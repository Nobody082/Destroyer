import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aug Lab — Tạo ảnh tài liệu xuống cấp",
  description: "Tạo hàng loạt biến thể ảnh bằng Augraphy và Albumentations, chạy cục bộ.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e0f11" },
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" data-theme="dark" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
