# Phase 12: Polish & Public Launch — Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 8 new/modified files (disclaimer label, onboarding modal, localStorage flag, mobile overflow fixes, rate-limit middleware, env var addition)
**Analogs found:** 7 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/doc/explanation-panel.tsx` (modify) | component | request-response | `src/components/chat/chat-message.tsx` | exact — same DISCLAIM-01 pattern |
| `src/components/ui/dialog.tsx` (new) | UI primitive | request-response | `src/components/ui/tooltip.tsx` | role-match — same radix-ui wrapper style |
| `src/components/onboarding-modal.tsx` (new) | component | request-response | `src/components/doc/jargon-tooltip.tsx` | partial — client component + localStorage read |
| `src/lib/onboarding-client.ts` (new) | utility | request-response | `src/lib/session-client.ts` | exact — same localStorage key pattern |
| `src/app/page.tsx` (modify) | component | request-response | itself + `src/components/doc/document-reader-layout.tsx` | exact — md: breakpoint pattern |
| `src/app/api/upload-init/route.ts` (modify) | API route | request-response | itself + `src/app/api/session/route.ts` | exact — same route structure |
| `src/lib/rate-limit.ts` (new) | utility | request-response | `src/lib/ingest/embed-document-batch.ts` (count pattern) | partial — Supabase count query |
| `src/lib/env.ts` (modify) | config | — | itself | exact |

---

## Pattern Assignments

### 1. Disclaimer Labels (DISCLAIM-01)

**Requirement:** "AI analysis · not financial advice" labels adjacent to score, explanation, and chat output.

**Existing implementations — copy these verbatim:**

**Score card disclaimer** — `src/components/doc/score-card.tsx` lines 37–39:
```tsx
<span className="text-muted-foreground text-sm">
  AI Assessment · not financial advice
</span>
```
Sits directly beneath the `text-5xl` score number, inside a `flex flex-col items-center gap-1` wrapper.

**Chat message disclaimer** — `src/components/chat/chat-message.tsx` lines 72–74:
```tsx
<p className="text-xs text-muted-foreground px-1">
  This is not investment advice.
</p>
```
Rendered below every assistant bubble, outside the `rounded-2xl` bubble div.

**Landing page disclaimer** — `src/app/page.tsx` lines 8–9 and 43–45:
```tsx
const HERO_DISCLAIMER = "AI analysis · not financial advice.";
// ...
<p data-testid="hero-disclaimer" className="text-muted-foreground text-sm italic">
  {HERO_DISCLAIMER}
</p>
```

**Gap for ExplanationPanel:** `src/components/doc/explanation-panel.tsx` has NO inline disclaimer beneath the explanation sections. DISCLAIM-01 requires one. Add a disclaimer element after the `<article>` content, following the `chat-message.tsx` pattern:
```tsx
<p className="text-xs text-muted-foreground px-6 pb-4">
  AI analysis · not financial advice. Verify all figures against the source PDF.
</p>
```
Place it as the last child inside the `<article>` at line 178 of `src/components/doc/explanation-panel.tsx`, after the `SECTION_ORDER.map(...)` block.

**Text variants in use (canonical):**
- Short inline: `"AI Assessment · not financial advice"` (score-card, hero)
- Full footer: `"Clarifin generates AI analysis, not financial advice. Information may be inaccurate; verify against the source PDF before making decisions."` (page.tsx footer)
- Chat bubble: `"This is not investment advice."` (chat-message.tsx)

---

### 2. Dialog / Modal Primitive (DISCLAIM-03 onboarding modal)

**Gap:** No `src/components/ui/dialog.tsx` exists yet. The installed `radix-ui` package (v1.4.3) re-exports `@radix-ui/react-dialog` at `radix-ui` — the dep is available without adding anything to package.json.

**How to add the shadcn dialog component:**
```bash
pnpm dlx shadcn@latest add dialog
```
This writes `src/components/ui/dialog.tsx` using the project's `components.json` config (style: new-york, aliases: `@/components/ui`).

**Pattern to follow for the new file** — mirror `src/components/ui/tooltip.tsx` lines 1–57:
```tsx
"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"   // same import style as tooltip.tsx line 4
import { cn } from "@/lib/utils"

// Named exports matching shadcn convention:
// Dialog, DialogTrigger, DialogPortal, DialogOverlay,
// DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription
```

**Existing Tooltip component structure for reference** — `src/components/ui/tooltip.tsx`:
- Line 1: `"use client"` directive
- Line 4: `import { Tooltip as TooltipPrimitive } from "radix-ui"` (unified package, not `@radix-ui/react-tooltip`)
- Lines 8–19: Provider wrapper with `data-slot="tooltip-provider"`
- Lines 33–55: Content with Portal wrapper, animation classes from `tw-animate-css`, `cn()` for merging

**Popover as secondary reference** — `src/components/ui/popover.tsx` lines 1–89:
- Same `"use client"` + `radix-ui` unified import pattern
- `PopoverPrimitive.Portal` wraps content (copy for `DialogPrimitive.Portal`)
- Animation classes: `animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95`

---

### 3. Onboarding Modal Component (`src/components/onboarding-modal.tsx`)

**Analog:** `src/components/doc/jargon-tooltip.tsx` (client component that reads state on mount).

**Component structure to follow** — `src/components/doc/jargon-tooltip.tsx` lines 1–32:
```tsx
"use client";

import { useId } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function JargonTooltip(props: { ... }) {
  // ...
}
```

**New component pattern:**
```tsx
"use client";

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getOnboardingSeen, setOnboardingSeen } from "@/lib/onboarding-client";

export function OnboardingModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Same SSR-safe pattern as session-client.ts lines 5–9
    if (!getOnboardingSeen()) {
      setOpen(true);
    }
  }, []);

  function handleDismiss() {
    setOnboardingSeen();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Welcome to Clarifin</DialogTitle>
          <DialogDescription>
            {/* Disclaimer text — mirrors FOOTER_DISCLAIMER from page.tsx line 10 */}
            Clarifin generates AI analysis, not financial advice.
            Information may be inaccurate; verify against the source PDF
            before making decisions.
          </DialogDescription>
        </DialogHeader>
        <Button onClick={handleDismiss}>I understand, continue</Button>
      </DialogContent>
    </Dialog>
  );
}
```

**Mount location:** Add `<OnboardingModal />` in `src/app/layout.tsx` (or `src/app/page.tsx`) so it renders on every page — same placement pattern as `<SessionProvider>` which is mounted at the layout level.

---

### 4. localStorage Flag (`src/lib/onboarding-client.ts`)

**Exact analog:** `src/lib/session-client.ts` (entire file, lines 1–33).

**Copy this pattern:**
```ts
// src/lib/session-client.ts lines 1–10
"use client";

export const SESSION_STORAGE_KEY = "clarifin_session_token";

export function getBrowserSessionToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(SESSION_STORAGE_KEY);
}
```

**New file follows identical shape:**
```ts
"use client";

export const ONBOARDING_SEEN_KEY = "clarifin_onboarding_seen";

/** Returns true if the user has already dismissed the onboarding modal. */
export function getOnboardingSeen(): boolean {
  if (typeof window === "undefined") return false;   // SSR guard — same as session-client.ts line 6
  return localStorage.getItem(ONBOARDING_SEEN_KEY) === "1";
}

/** Marks onboarding as seen. Call after the user dismisses the modal. */
export function setOnboardingSeen(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
}
```

**SSR safety pattern** — always guard with `typeof window === "undefined"` check before any `localStorage` access. This is the universal pattern in the codebase:
- `src/lib/session-client.ts` line 6: `if (typeof window === "undefined") { return null; }`
- `src/components/doc/document-reader-layout.tsx` lines 63–67: inline guard in `safeStorage` shim

---

### 5. Mobile / Responsive Layout Patterns

**Primary breakpoint pattern** — the project uses a **single breakpoint: `md` (768px)**. No `sm:` or `lg:` on layout-critical elements.

**Mobile vs desktop switch** — `src/components/doc/document-reader-layout.tsx` lines 180–215:
```tsx
{/* Mobile (<=768px): tab switcher */}
<div className="flex h-full md:hidden">
  <MobileTabView ... />
</div>

{/* Desktop (>=769px): resizable split */}
<div className="hidden h-full md:flex">
  {mounted && <DesktopSplitPane ... />}
</div>
```
Pattern: `md:hidden` for mobile-only content, `hidden md:flex` for desktop-only content.

**Landing page responsive classes** — `src/app/page.tsx`:
- Line 32: `className="mx-auto flex min-h-screen max-w-3xl flex-col gap-16 px-6 py-16"` — `max-w-3xl` + `px-6` constrains to safe width on all viewports
- Line 38: `className="text-balance font-semibold text-3xl leading-tight sm:text-4xl"` — only `sm:` breakpoint used for font scaling (not layout)
- Line 49: `className="grid gap-4 sm:grid-cols-3"` — 1-column on mobile, 3-column on `sm:+`

**MobileTabView full-screen pattern** — `src/components/doc/mobile-tab-view.tsx` lines 54–107:
```tsx
<Tabs value={tab} onValueChange={...} className="flex h-screen w-full flex-col">
  <TabsList className="w-full justify-start rounded-none border-border border-b bg-muted">
    ...
  </TabsList>
  <TabsContent value="explanation" className="flex-1 overflow-auto">
    ...
  </TabsContent>
  <TabsContent value="chat" className="flex-1 overflow-hidden">
    ...
  </TabsContent>
</Tabs>
```
Key classes for scroll containment: `h-screen w-full flex-col` on root, `flex-1 overflow-auto` on scrollable tab content, `flex-1 overflow-hidden` on panels that manage their own scroll.

**Mobile overflow prevention rules (from existing code):**
- Use `max-w-3xl px-6` on page-level containers (page.tsx line 32) — prevents content spilling past 375px
- Use `w-full` + `justify-start` on `TabsList` — prevents tab bar overflow
- Use `overflow-auto` on scroll containers, `overflow-hidden` on fixed-height panels
- Use `min-h-0` on flex children that need to shrink (document-reader-layout.tsx line 93)
- Do NOT use fixed pixel widths on containers — always `w-full` or `max-w-*`

**Items to audit for 375px overflow:** Components that may need `min-w-0` or `overflow-x-hidden`:
- `src/components/doc/score-card.tsx` — the dimension row `flex w-full items-center gap-2 pr-2` is safe; `text-sm` text truncates naturally
- `src/components/chat/chat-message.tsx` — `max-w-[85%]` and `max-w-[90%]` on bubbles is safe at 375px
- `src/components/doc/explanation-panel.tsx` — `px-6 py-8` gives 24px horizontal padding on 375px = 327px content width, which is fine

---

### 6. Rate Limiting — IP Extraction and Supabase Count (INFRA-02)

**No existing rate-limit code** — this is a greenfield file. However, two sub-patterns exist and can be composed:

#### 6a. IP Header Extraction

**Source:** `src/app/api/internal/analyze-batch/route.ts` lines 31–37 — shows how to read a request header:
```ts
function extractBearer(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) {
    return null;
  }
  return h.slice(7);
}
```

**IP extraction pattern** (Vercel-specific, no existing code — reference only):
```ts
// In src/lib/rate-limit.ts
export function extractClientIp(request: Request): string {
  // Vercel sets x-forwarded-for; take the first (leftmost) IP
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  // Fallback for local dev — not present in edge/Node runtimes
  return "unknown";
}
```

#### 6b. Supabase Count Query Pattern

**Best analog:** `src/lib/ingest/embed-document-batch.ts` lines 33–43:
```ts
async function countNullEmbeddings(docId: string): Promise<number> {
  const r = await supabaseAdmin
    .from("chunks")
    .select("id", { count: "exact", head: true })
    .eq("doc_id", docId)
    .is("embedding", null);
  if (r.error) {
    return -1;
  }
  return r.count ?? 0;
}
```

**Rate-limit count pattern** (for uploads per IP per day):
```ts
// src/lib/rate-limit.ts
import { supabaseAdmin } from "@/db/client";

const DAILY_UPLOAD_LIMIT = 5;

export async function isIpRateLimited(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin
    .from("documents")
    .select("id", { count: "exact", head: true })   // same as embed-document-batch.ts line 36
    .eq("ip_address", ip)
    .gte("created_at", since);                       // same .gte pattern as session-restore.ts line 35
  if (error) return false;  // fail open on DB error
  return (count ?? 0) >= DAILY_UPLOAD_LIMIT;
}
```

**Note:** The `documents` table (defined in `src/db/database.types.ts` lines 183–249) has no `ip_address` column. A DB migration must add `ip_address text` to the `documents` table before `INFRA-02` can be implemented.

#### 6c. Route Integration Pattern

**Where to call rate-limit check** — `src/app/api/upload-init/route.ts` lines 24–31 show the guard pattern:
```ts
export async function POST(request: Request): Promise<Response> {
  try {
    const json: unknown = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
    }
    // Add rate-limit check HERE, before session lookup:
    // const ip = extractClientIp(request);
    // if (await isIpRateLimited(ip)) {
    //   return NextResponse.json({ error: "Upload limit reached. Try again tomorrow." }, { status: 429 });
    // }
```

---

### 7. API Route Structure (reference for any new routes)

**Canonical pattern** from `src/app/api/upload-init/route.ts` and `src/app/api/session/route.ts`:

**Imports** (lines 1–6 of upload-init/route.ts):
```ts
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/db/client";
import { validatePdfUpload } from "@/lib/upload-validation";
```

**Request body validation** (lines 8–13):
```ts
const bodySchema = z.object({
  session_token: z.string().uuid(),
  filename: z.string().min(1).max(500),
  // ...
});
```

**Handler skeleton** (lines 24–91):
```ts
export async function POST(request: Request): Promise<Response> {
  try {
    const json: unknown = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "..." }, { status: 400 });
    }
    // ... business logic ...
    return NextResponse.json({ ... });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
```

**Error response shapes:**
- Validation error: `{ error: "..." }` with status 400
- Not found: `{ error: "..." }` with status 404
- Server error: `{ error: "..." }` with status 500
- Auth/rate-limit: `{ error: "..." }` with status 401/429
- Success: flat object with relevant data (no `{ data: ... }` wrapper)

---

## Shared Patterns

### `cn()` utility for class merging
**Source:** `src/lib/utils.ts` (imported by all UI components)
**Apply to:** All new component files
```ts
import { cn } from "@/lib/utils";
// Usage: className={cn("base-classes", conditionalClass && "extra", props.className)}
```

### `"use client"` directive
**Apply to:** `onboarding-modal.tsx`, `onboarding-client.ts` (and any hook-using components)
All client components in the codebase use `"use client"` as the very first line (before imports). See `src/components/doc/score-card.tsx` line 1, `src/lib/session-client.ts` line 1.

### `"server-only"` guard
**Apply to:** `src/lib/rate-limit.ts` (contains supabaseAdmin which must not reach the browser)
```ts
import "server-only";  // same as src/lib/session-restore.ts line 1
```

### Tailwind design tokens
**Source:** `src/app/globals.css` lines 11–44
| Token | Value | Use for |
|-------|-------|---------|
| `text-muted-foreground` | zinc-500 | Disclaimer text, secondary labels |
| `text-foreground` | zinc-900 | Primary body text |
| `border-border` | zinc-200 | Card / modal borders |
| `bg-background` | white | Modal content background |
| `bg-muted` | zinc-100 | Tab bars, secondary backgrounds |
| `text-primary` | emerald-600 | Score number, focus rings |
| `rounded-lg` | 0.5rem | Card/modal corners |

### `data-testid` attribute convention
**Source:** `src/app/page.tsx` lines 40, 44, 71
```tsx
<p data-testid="hero-disclaimer" ...>
<p data-testid="footer-disclaimer" ...>
```
Add `data-testid="onboarding-modal"` and `data-testid="onboarding-dismiss-btn"` to the modal for testability.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/rate-limit.ts` | utility | request-response | No rate-limiting exists yet; IP extraction pattern is new. Sub-patterns (header read, Supabase count) are borrowed from analyze-batch and embed-document-batch. |
| `src/db/migrations/add_ip_address_to_documents.sql` | migration | — | No SQL migrations tracked in the codebase (Supabase managed); pattern for `supabase migration new` via CLI |

---

## Key Gaps / Flags for Planner

1. **`src/components/ui/dialog.tsx` does not exist.** Run `pnpm dlx shadcn@latest add dialog` before implementing `OnboardingModal`. The `radix-ui` package already ships `@radix-ui/react-dialog` as a transitive dep, so no new `package.json` entry is needed.

2. **`documents` table lacks `ip_address` column.** INFRA-02 rate limiting requires a Supabase migration: `ALTER TABLE documents ADD COLUMN ip_address text;`. This migration must be created and applied before modifying `upload-init/route.ts`.

3. **No `sm:` breakpoints exist in layout-critical components.** The project's mobile strategy is `md:hidden` / `hidden md:flex` (single breakpoint at 768px). Do not introduce `sm:` breakpoints in layout containers — only in typography sizing (matching `page.tsx` line 38 precedent).

4. **`OnboardingModal` mount location is TBD.** Candidates: `src/app/layout.tsx` (shows on all pages) or `src/app/page.tsx` (shows only on landing). Given DISCLAIM-03 says "first-time visitors," `layout.tsx` is correct so it also shows on direct `/doc/[id]` deep links.

5. **No `DAILY_UPLOAD_LIMIT` env var currently defined.** The limit (e.g., 5/IP/day) should be either hardcoded as a constant or added to `src/lib/env.ts` following the existing `z.string().min(1)` pattern. If adding to env.ts, add to both `server` schema and `runtimeEnv` map (lines 15–67).

---

## Metadata

**Analog search scope:** `src/components/`, `src/app/api/`, `src/lib/`, `src/db/`
**Files scanned:** 18 source files read directly + grep across all `.ts`/`.tsx` files
**Pattern extraction date:** 2026-05-24
