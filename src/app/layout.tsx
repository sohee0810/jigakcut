import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local"; // ★내 폰트 파일 불러오는 도구
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ★레코체 폰트★ — fonts 폴더의 recoche.ttf 를 불러와 "--font-recoche" 라는 이름표를 붙인다.
// 이 이름표를 나중에 특정 글자에만 골라서 쓸 수 있다. (본문엔 안 씀)
const recoche = localFont({
  src: "./fonts/recoche.ttf",
  variable: "--font-recoche",
  display: "swap",
});

export const metadata: Metadata = {
  // 미리보기 이미지 주소를 절대경로로 만들기 위한 기준 주소 (배포 도메인)
  metadataBase: new URL("https://jigakcut-web.vercel.app"),
  title: "지각컷 — 탈까? 말까?",
  description: "용인 → 서울 광역버스, 5초 안에 결정하세요",
  // 카톡/페북 링크 미리보기 (이미지는 opengraph-image.tsx 가 자동으로 붙여줌)
  openGraph: {
    title: "지각컷 | 탈까? 말까?",
    description: "용인 → 서울 광역버스, 5초 안에 결정하세요",
    type: "website",
  },
  // 트위터(X) 카드 — 큰 이미지 형식
  twitter: {
    card: "summary_large_image",
    title: "지각컷 | 탈까? 말까?",
    description: "용인 → 서울 광역버스, 5초 안에 결정하세요",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${recoche.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
