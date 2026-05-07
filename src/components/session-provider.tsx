"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { ensureBrowserSession } from "@/lib/session-client";

type SessionReadyState = {
  isSessionReady: boolean;
  sessionError: string | null;
};

const SessionReadyContext = createContext<SessionReadyState>({
  isSessionReady: false,
  sessionError: null,
});

export function useSessionReady(): SessionReadyState {
  return useContext(SessionReadyContext);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isSessionReady, setReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ensureBrowserSession();
        if (!cancelled) {
          setReady(true);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setSessionError(e instanceof Error ? e.message : "Could not start session.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ isSessionReady, sessionError }), [isSessionReady, sessionError]);

  return <SessionReadyContext.Provider value={value}>{children}</SessionReadyContext.Provider>;
}
