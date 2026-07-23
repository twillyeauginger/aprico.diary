import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost:5173";
  const protocol =
    host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https";
  const base = new URL(`${protocol}://${host}`);
  const socialImage = new URL("/og.png", base).toString();

  return {
    metadataBase: base,
    title: "한끼록 — 나의 영양 기록",
    description:
      "음식과 사진을 기록하고, 하루의 칼로리와 영양 균형을 달력으로 확인하세요.",
    openGraph: {
      title: "한끼록 — 나의 영양 기록",
      description: "먹은 것을 가볍게, 영양은 분명하게.",
      type: "website",
      locale: "ko_KR",
      images: [{ url: socialImage, width: 1672, height: 941, alt: "한끼록" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "한끼록 — 나의 영양 기록",
      description: "먹은 것을 가볍게, 영양은 분명하게.",
      images: [socialImage],
    },
  };
}

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
