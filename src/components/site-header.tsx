"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LineChart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Global site header mounted in RootLayout (TA-UX-01).
 *
 * - Left: "Clarifin" wordmark linked to `/`.
 * - Right nav: "Upload Document" (always visible) + "TA Analysis" (gated on
 *   NEXT_PUBLIC_TA_ENABLED === "true" per D-04).
 * - Active state on `/ta/*`: text-primary + underline.
 * - On <640px: "TA Analysis" label is icon-only (LineChart) with aria-label.
 */

// D-04: Read at module-init time so it is tree-shaken when unset.
// NEXT_PUBLIC_ vars are always strings; compare === "true".
const TA_ENABLED = process.env.NEXT_PUBLIC_TA_ENABLED === "true";

export function SiteHeader({ className }: { className?: string }) {
  const pathname = usePathname();
  const isTaActive = pathname?.startsWith("/ta");

  return (
    <header
      role="banner"
      className={cn(
        "sticky top-0 z-50 h-12 border-b border-border bg-secondary",
        className,
      )}
    >
      <nav
        aria-label="Main navigation"
        className="mx-auto flex h-full max-w-7xl items-center justify-between px-4"
      >
        {/* Wordmark */}
        <Link
          href="/"
          className="text-sm font-semibold text-foreground hover:text-foreground/80"
        >
          Clarifin
        </Link>

        {/* Right nav */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" asChild>
            <Link href="/" className="text-sm">
              Upload Document
            </Link>
          </Button>

          {TA_ENABLED && (
            <Button
              variant="ghost"
              asChild
              className={cn(
                isTaActive && "text-primary underline underline-offset-4",
              )}
            >
              <Link href="/ta" aria-current={isTaActive ? "page" : undefined}>
                {/* Desktop: text label */}
                <span className="hidden sm:inline">TA Analysis</span>
                {/* Mobile (<640px): icon only */}
                <LineChart
                  className="sm:hidden"
                  size={18}
                  aria-label="TA Analysis"
                />
              </Link>
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
}
