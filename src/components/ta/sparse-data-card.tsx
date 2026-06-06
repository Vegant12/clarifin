import { BarChart2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Sparse data state card (TA-CHART-08).
 *
 * Shown when a ticker has <30 candles of OHLCV history — not enough
 * data for technical indicators to be reliable.
 *
 * Copy locked from UI-SPEC lines 316-317.
 * No chart or indicator panels are rendered when this card is shown.
 */

interface SparseDataCardProps {
  ticker: string;
}

export function SparseDataCard({ ticker }: SparseDataCardProps) {
  return (
    <div className="max-w-md mx-auto mt-16">
      <Card className="items-center text-center px-6">
        <CardHeader className="items-center">
          <BarChart2 className="size-8 text-muted-foreground mb-2" />
          <CardTitle className="text-xl font-semibold">
            Insufficient price history
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Technical indicators need at least 30 trading days of data to be
            reliable. &apos;{ticker}&apos; was recently listed and doesn&apos;t
            have enough history yet. Check back in a few weeks.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
