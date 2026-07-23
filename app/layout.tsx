import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "식단 기록",
  description:
    "음식과 사진을 기록하고 하루의 칼로리와 영양정보를 달력으로 확인하는 개인용 도구",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
