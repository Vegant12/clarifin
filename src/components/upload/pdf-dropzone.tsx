"use client";

import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { useSessionReady } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getBrowserSessionToken } from "@/lib/session-client";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type UploadStage = "idle" | "busy";

export function PdfDropzone() {
  const inputId = useId();
  const router = useRouter();
  const { isSessionReady, sessionError } = useSessionReady();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [stage, setStage] = useState<UploadStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [uploadHint, setUploadHint] = useState("Uploading your PDF…");

  const disabled = stage === "busy" || !isSessionReady;
  const showSessionBlock = !!sessionError;

  async function execUpload(file: File) {
    setError(null);
    setStage("busy");
    setUploadHint("Uploading your PDF…");
    setPickedName(file.name);

    const hintTimer = window.setInterval(() => {
      setUploadHint((prev) =>
        prev.includes("Finishing") ? "Uploading your PDF…" : "Finishing upload…",
      );
    }, 2500);

    try {
      const sessionToken = getBrowserSessionToken();
      if (!sessionToken) {
        throw new Error("We couldn't start your session. Refresh the page and try again.");
      }

      const initRes = await fetch("/api/upload-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: sessionToken,
          filename: file.name,
          size_bytes: file.size,
          content_type: file.type && file.type.length > 0 ? file.type : PDF_MIME,
        }),
      });

      const initBody: unknown = await initRes.json().catch(() => ({}));

      if (!initRes.ok) {
        throw mapInitError(initBody, initRes.status);
      }

      const init = initBody as {
        doc_id: string;
        path: string;
        token: string;
      };

      const supabase = getBrowserSupabase();
      const { error: uploadError } = await supabase.storage
        .from("pdfs")
        .uploadToSignedUrl(init.path, init.token, file, {
          contentType: PDF_MIME,
          upsert: false,
        });

      if (uploadError) {
        throw new Error("Upload failed. Please try again in a moment.");
      }

      const headBuf = await file.slice(0, 8).arrayBuffer();
      const bytes = new Uint8Array(headBuf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!);
      }
      const file_head_base64 = btoa(binary);

      const completeRes = await fetch("/api/upload-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_id: init.doc_id,
          session_token: sessionToken,
          file_head_base64,
        }),
      });

      const completeBody: unknown = await completeRes.json().catch(() => ({}));

      const done = completeBody as { ok?: boolean; error?: string };
      if (!completeRes.ok || !done.ok) {
        if (done.error?.includes("valid PDF")) {
          throw new Error("This file doesn't look like a valid PDF. Try another file.");
        }
        throw new Error(done.error ?? "Upload failed. Please try again in a moment.");
      }

      router.push(`/doc/${init.doc_id}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Upload failed. Please try again.";
      setError(message);
    } finally {
      window.clearInterval(hintTimer);
      setStage("idle");
    }
  }

  function onPick() {
    fileInputRef.current?.click();
  }

  async function onInputChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (file) {
      await execUpload(file);
    }
  }

  async function onDrop(ev: React.DragEvent) {
    ev.preventDefault();
    setDragOver(false);
    const file = ev.dataTransfer.files.item(0);
    if (!file) {
      return;
    }
    await execUpload(file);
  }

  return (
    <section data-testid="pdf-dropzone" aria-label="PDF upload">
      <Card
        aria-disabled={disabled}
        className={`border-2 border-dashed p-12 transition-colors ${
          dragOver
            ? "border-primary bg-muted/50 ring-2 ring-primary/30"
            : "border-border bg-muted/30"
        } ${disabled ? "opacity-70" : ""}`}
        onDragEnter={(ev) => {
          ev.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDragOver={(ev) => {
          ev.preventDefault();
          setDragOver(true);
        }}
        onDrop={disabled ? undefined : onDrop}
      >
        <CardContent className="flex flex-col items-center gap-3 p-0 text-center">
          <Upload aria-hidden className="size-8 text-muted-foreground" />
          <p className="font-semibold text-base">Drop your IDX PDF here</p>
          <p className="text-muted-foreground text-sm">
            PDF up to 20 MB. Annual report, quarterly filing, or financial statement.
          </p>

          {pickedName ? (
            <p className="text-muted-foreground text-sm">
              Selected: <span className="font-medium text-foreground">{pickedName}</span>
            </p>
          ) : null}

          {showSessionBlock ? (
            <p role="alert" className="text-destructive text-sm">
              {sessionError}
            </p>
          ) : null}

          {error ? (
            <div role="alert" className="flex flex-col gap-3">
              <p className="text-destructive text-sm">{error}</p>
              <Button
                className="h-11 min-w-[9rem]"
                onClick={() => setError(null)}
                variant="outline"
              >
                Try again
              </Button>
            </div>
          ) : null}

          {!error && stage === "busy" ? (
            <div aria-live="polite" className="flex flex-col items-center gap-2">
              <Loader2 aria-hidden className="size-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">{uploadHint}</p>
            </div>
          ) : null}

          <label className={disabled ? "pointer-events-none" : "cursor-pointer"} htmlFor={inputId}>
            <input
              ref={fileInputRef}
              accept=".pdf,application/pdf"
              className="sr-only"
              disabled={disabled}
              id={inputId}
              onChange={onInputChange}
              type="file"
            />
          </label>

          <Button
            className="h-11 min-h-11 px-8"
            disabled={disabled || !!sessionError}
            type="button"
            onClick={() => void onPick()}
          >
            {disabled && !sessionError ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Preparing…
              </span>
            ) : (
              "Choose file"
            )}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

/** Keep in sync with `PDF_MIME_TYPE` on the server (`upload-validation`). */
const PDF_MIME = "application/pdf";

function mapInitError(body: unknown, status: number): Error {
  const obj = body as { error?: string };
  const msg = typeof obj?.error === "string" ? obj.error : "";

  if (status === 400 || status === 404) {
    if (/Maximum allowed is 20 MB/i.test(msg)) {
      return new Error("This file is too large. Maximum size is 20 MB.");
    }
    if (/Only PDF files are supported/i.test(msg)) {
      return new Error("Only PDF files are supported.");
    }
    if (msg.includes("Session not found")) {
      return new Error("We couldn't verify your session. Refresh the page and try again.");
    }
    if (msg) {
      return new Error(msg.length > 200 ? "Invalid upload request." : msg);
    }
  }

  if (status >= 502) {
    return new Error(obj.error ?? "Upload failed. Please try again in a moment.");
  }

  if (!msg || status >= 500) {
    return new Error("We couldn't reach the server. Check your connection and try again.");
  }

  return new Error(msg.length > 200 ? "Upload failed." : msg);
}
