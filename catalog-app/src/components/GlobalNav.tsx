"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Catalogue" },
  { href: "/finder", label: "Finder" },
];

// 공개 카탈로그용 최소 내비게이션 (인증 없음). 제품 페이지의 sticky 헤더가
// top-10(40px) 기준으로 정렬되므로 이 바는 h-10(40px)로 고정한다.
export default function GlobalNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className="sticky top-0 z-50 h-10 shrink-0 border-b border-black/10 bg-white shadow-sm">
      <div className="flex h-10 items-center gap-1 px-3">
        <Link href="/" className="mr-3 flex shrink-0 items-center hover:opacity-80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="AE" className="h-7 w-auto object-contain" />
        </Link>
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex h-7 items-center rounded px-3 text-[12px] font-medium transition-colors ${
              isActive(href)
                ? "bg-black/8 font-semibold text-black"
                : "text-black/60 hover:bg-black/5 hover:text-black"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
