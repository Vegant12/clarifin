import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PdfDropzone } from "@/components/upload/pdf-dropzone";

const HERO_HEADLINE = "Read IDX financial reports in plain English.";
const HERO_SUBCOPY =
  "Upload an Indonesian-listed company's financial PDF and get a plain-English explanation, an AI assessment score, and a chat interface to ask follow-up questions.";
const HERO_DISCLAIMER = "AI analysis · not financial advice.";
const FOOTER_DISCLAIMER =
  "Clarifin generates AI analysis, not financial advice. Information may be inaccurate; verify against the source PDF before making decisions.";

const STEPS = [
  {
    n: "1",
    title: "Upload PDF",
    body: "Annual report, quarterly filing, or financial statement.",
  },
  {
    n: "2",
    title: "Read explanation",
    body: "Plain-English summary with page citations.",
  },
  {
    n: "3",
    title: "Ask follow-ups",
    body: "Chat with your document. Answers cite the source.",
  },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-16 px-6 py-16">
      {/* Hero */}
      <section className="flex flex-col gap-4">
        <p className="font-mono font-semibold text-2xl tracking-tight">Clarifin</p>
        <h1
          data-testid="hero-headline"
          className="text-balance font-semibold text-3xl leading-tight sm:text-4xl"
        >
          {HERO_HEADLINE}
        </h1>
        <p className="text-pretty text-base text-muted-foreground">{HERO_SUBCOPY}</p>
        <p data-testid="hero-disclaimer" className="text-muted-foreground text-sm italic">
          {HERO_DISCLAIMER}
        </p>
      </section>

      {/* 3-step "how it works" */}
      <section className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step) => (
          <Card key={step.n} className="p-6">
            <CardContent className="flex flex-col gap-2 p-0">
              <span className="font-mono text-muted-foreground text-sm">Step {step.n}</span>
              <h3 className="font-semibold text-base">{step.title}</h3>
              <p className="text-muted-foreground text-sm">{step.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* PDF upload (Phase 2) */}
      <section aria-label="PDF upload">
        <PdfDropzone />
      </section>

      <Separator />

      {/* Footer */}
      <footer className="flex flex-col gap-2 text-muted-foreground text-sm">
        <p data-testid="footer-disclaimer">{FOOTER_DISCLAIMER}</p>
        <p>{`© ${new Date().getFullYear()} Clarifin · Built for IDX investors.`}</p>
      </footer>
    </main>
  );
}
