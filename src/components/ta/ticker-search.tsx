"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

/**
 * Debounced ticker autocomplete (TA-TICKER-01).
 *
 * - Queries /api/ta/search?q={q}&limit=8 with a 300ms debounce.
 * - Minimum query length: 1 character (no request on empty).
 * - On select: router.push('/ta/{TICKER}') — ticker is uppercase from API.
 * - Keyboard: arrows navigate, Enter selects, Escape closes (Command built-in).
 * - Empty results: "No IDX tickers matching '{query}'" (locked copy).
 * - T-13-22: only API-returned uppercase tickers used in push() — never raw input.
 * - T-13-23: 300ms debounce + min-length 1 + limit=8 prevents keystroke flooding.
 */

interface TickerResult {
  ticker: string;
  name_en: string;
  name_id?: string | null;
  sector?: string | null;
}

export function TickerSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TickerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Track whether dropdown is expanded for aria-expanded
  const isExpanded = open && (results.length > 0 || query.length >= 1);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/ta/search?q=${encodeURIComponent(query)}&limit=8`,
        );
        const json = await res.json();
        setResults(json.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  function handleSelect(ticker: string) {
    // T-13-22: use only the API-returned uppercase ticker, never raw user input
    router.push(`/ta/${ticker}`);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div className={cn("relative", className)}>
      <Command
        shouldFilter={false}
        className="rounded-lg border border-border shadow-sm"
        onFocus={() => setOpen(true)}
      >
        <CommandInput
          placeholder="Search IDX tickers or company names…"
          value={query}
          onValueChange={setQuery}
          aria-label="Search IDX tickers"
          aria-expanded={isExpanded}
        />
        {(query.length >= 1) && (
          <CommandList className="max-h-[320px] overflow-y-auto">
            {!loading && results.length === 0 && (
              <CommandEmpty className="py-4 px-3 text-sm text-muted-foreground text-left">
                No IDX tickers matching &apos;{query}&apos;
              </CommandEmpty>
            )}
            {results.length > 0 && (
              <CommandGroup>
                {results.map((result) => (
                  <CommandItem
                    key={result.ticker}
                    value={result.ticker}
                    onSelect={() => handleSelect(result.ticker)}
                    className="flex min-h-[40px] cursor-pointer items-center gap-2 px-3"
                  >
                    <span className="text-sm font-mono font-semibold text-foreground">
                      {result.ticker}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {result.name_en}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        )}
      </Command>
    </div>
  );
}
