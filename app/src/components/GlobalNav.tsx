"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const NAV = [
  { href: "/",         label: "Catalogue" },
  { href: "/search",   label: "Search" },
  { href: "/finder",   label: "Finder" },
  { href: "/rfq",      label: "Quote" },
  { href: "/outlook",  label: "Mail" },
  { href: "/settings", label: "Settings" },
];

export default function GlobalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { user, signOut, loading } = useAuth();

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
  }

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    router.push("/login");
  }

  return (
    <nav className="relative shrink-0 bg-white border-b border-black/10 z-40 shadow-sm">
      <div className="flex h-10 items-center gap-0.5 px-3">
        <Link href="/" className="mr-3 shrink-0 flex items-center hover:opacity-80 transition-opacity">
          <Image src="/logo.png" alt="AE" width={80} height={28} className="h-7 w-auto object-contain" priority/>
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-0.5 flex-1">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href}
              className={`flex h-7 items-center rounded px-3 text-[12px] font-medium transition-colors ${
                isActive(href)
                  ? "bg-black/8 text-black font-semibold"
                  : "text-black/60 hover:bg-black/5 hover:text-black"
              }`}>
              {label}
            </Link>
          ))}
        </div>

        {/* Desktop user info */}
        {!loading && user && (
          <div className="hidden sm:flex items-center gap-2 ml-2">
            <span className="text-[11px] text-black/40 max-w-[160px] truncate">{user.email}</span>
            <button
              onClick={handleSignOut}
              className="flex h-7 items-center rounded px-2.5 text-[12px] font-medium text-black/50 hover:bg-black/5 hover:text-black transition-colors whitespace-nowrap"
            >
              Sign Out
            </button>
          </div>
        )}

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label="Menu"
          className="sm:hidden ml-auto flex h-8 w-8 items-center justify-center rounded text-black/60 hover:bg-black/5 transition">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            {open
              ? <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              : <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            }
          </svg>
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="sm:hidden absolute top-full left-0 right-0 bg-white border-b border-black/10 shadow-lg py-1">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className={`flex h-10 items-center px-5 text-[13px] font-medium transition-colors ${
                isActive(href)
                  ? "bg-black/8 text-black font-semibold"
                  : "text-black/60 hover:bg-black/5 hover:text-black"
              }`}>
              {label}
            </Link>
          ))}
          {!loading && user && (
            <>
              <div className="mx-5 my-1 border-t border-black/8" />
              <div className="flex h-9 items-center px-5 text-[12px] text-black/40 truncate">{user.email}</div>
              <button
                onClick={handleSignOut}
                className="flex h-10 w-full items-center px-5 text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
