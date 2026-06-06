import Link from "next/link";
import { Monitor } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Mobile info card shown on viewports <640px (D-05, UI-SPEC line 120).
 *
 * The CALLER wraps this component with `block sm:hidden` — this card itself
 * does not apply responsive visibility classes, so it can be tested in isolation.
 *
 * Copy locked from UI-SPEC Copywriting Contract lines 309-311.
 * CTA "Upload a document instead" links to `/` (v1.0 document reader works on mobile).
 */
export function MobileInfoCard() {
  return (
    <Card className="items-center text-center px-6">
      <CardHeader className="items-center">
        <Monitor className="size-8 text-muted-foreground mb-2" />
        <CardTitle className="text-xl font-semibold">
          TA Analysis works best on desktop
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          We&apos;re building the mobile experience for a future release. For
          now, open this page on a desktop or laptop to see the interactive
          chart and indicators. Or use Clarifin&apos;s document reader — it
          works great on mobile.
        </p>
      </CardContent>
      <CardFooter className="justify-center">
        <Button asChild>
          <Link href="/">Upload a document instead</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
