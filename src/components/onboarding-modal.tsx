"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getOnboardingSeen, setOnboardingSeen } from "@/lib/onboarding-client";

/**
 * First-time visitor onboarding modal (DISCLAIM-03).
 *
 * Reads localStorage on mount. If the user has not seen the modal,
 * opens it immediately. Dismissing the modal sets the localStorage flag.
 *
 * Mounted at the app root (layout.tsx) so it fires on all routes,
 * including direct /doc/[id] deep links.
 */
export function OnboardingModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Read localStorage only on the client (useEffect runs after hydration).
    // getOnboardingSeen() includes its own SSR guard but the useEffect
    // wrapper is a second safety layer.
    if (!getOnboardingSeen()) {
      setOpen(true);
    }
  }, []);

  function handleDismiss() {
    setOnboardingSeen();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleDismiss(); }}>
      <DialogContent data-testid="onboarding-modal" className="max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to Clarifin</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <p>
                <strong>What Clarifin does:</strong> Upload a financial PDF from an
                IDX-listed company and get a plain-English explanation of its financial
                health — written for investors who don&apos;t speak finance.
              </p>
              <p>
                <strong>What to upload:</strong> IDX annual reports (laporan tahunan),
                quarterly filings, balance sheets, income statements, or cash flow
                statements. PDF format only.
              </p>
              <p>
                <strong>AI disclaimer:</strong> Clarifin generates AI analysis, not
                financial advice. Information may be inaccurate; verify all figures
                against the source PDF before making decisions.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            data-testid="onboarding-dismiss-btn"
            onClick={handleDismiss}
            className="w-full"
          >
            I understand, let me continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
