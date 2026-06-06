import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Error card for the TA analysis page.
 *
 * Two variants (controlled by the optional `variant` prop):
 *   - "not-found" (default): ticker not in ticker_metadata.
 *     Heading: "Ticker not found" (locked copy from UI-SPEC line 313)
 *   - "fetch-error": API failure.
 *     Heading: "Could not load chart data" (locked copy from UI-SPEC line 318)
 *
 * Both variants accept a `ticker` prop and interpolate it into the body copy.
 * Centered on page: max-w-md mx-auto mt-16 (UI-SPEC line 276).
 */

interface TAErrorCardProps {
  ticker: string;
  variant?: "not-found" | "fetch-error";
}

export function TAErrorCard({ ticker, variant = "not-found" }: TAErrorCardProps) {
  const isNotFound = variant === "not-found";

  const heading = isNotFound ? "Ticker not found" : "Could not load chart data";

  const body = isNotFound
    ? `'${ticker}' is not in our list of IDX-listed companies. Check the spelling, or search by company name above.`
    : `Something went wrong loading data for '${ticker}'. This is usually temporary.`;

  const ctaLabel = isNotFound ? "Search again" : "Try again";
  const ctaHref = "/ta";

  return (
    <div className="max-w-md mx-auto mt-16">
      <Card className="items-center text-center px-6">
        <CardHeader className="items-center">
          <AlertCircle className="size-8 text-destructive mb-2" />
          <CardTitle className="text-xl font-semibold">{heading}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{body}</p>
        </CardContent>
        <CardFooter className="justify-center">
          <Button variant="outline" asChild>
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
