---
phase: 04
slug: embeddings-vector-store
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-10
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| SQL migration → production DB | DDL runs with elevated Supabase CLI credentials | Schema definitions only; no user data |
| RPC `match_document_chunks` → callers | Service role only; anon/authenticated revoked | Embedding vectors + chunk text |
| `GEMINI_API_KEY` → Google API | Server-only module; never client-visible | API key (outbound) |
| `/api/internal/embed-batch` → internal | INTERNAL_PARSE_SECRET via timingSafeEqual | Document IDs |
| Server `after()` → internal URL | Bearer token header; not client-visible | Document IDs |
| RAG helper → Postgres RPC | Service role only; doc_id from trusted server context | Query embeddings + chunk content |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-04-01-a | I | `match_document_chunks` | mitigate | REVOKE ALL from PUBLIC/anon/authenticated; GRANT EXECUTE to service_role; WHERE c.doc_id = p_doc_id | closed |
| T-04-01-b | E | Migration apply | mitigate | Migration file in repo; supabase db push documented | closed |
| T-04-01-c | I | API key exposure in SQL | accept | Migration is DDL-only — no secrets present | closed |
| T-04-01-d | E | Service role misuse | mitigate | supabaseAdmin only from src/db/client.ts; no NEXT_PUBLIC_* | closed |
| T-04-02-a | I | Gemini API key | mitigate | gemini-embed.ts: `import "server-only"` at line 1; GEMINI_API_KEY in server env schema only | closed |
| T-04-02-b | I | Unauthenticated embed trigger | mitigate | gemini-embed.ts exports only functions/constants — no HTTP route | closed |
| T-04-02-c | S | API key in logs | mitigate | Error logging captures only res.status; API key never logged | closed |
| T-04-02-d | E | Rate limit / 429 | mitigate | fetchWithBackoff: exponential backoff, max 4 retries, delay capped at 10s | closed |
| T-04-03-a | I | Unauthenticated embed-batch trigger | mitigate | timingSafeEqual from node:crypto on INTERNAL_PARSE_SECRET in route.ts | closed |
| T-04-03-b | E | Service role key | mitigate | embed-document-batch.ts: `import "server-only"`; supabaseAdmin from src/db/client.ts | closed |
| T-04-03-c | I | Cross-doc leak via orchestrator | mitigate | All chunks queries include .eq("doc_id", docId); DB pick filtered by status="embedding" | closed |
| T-04-03-d | I | GEMINI_API_KEY in route | mitigate | Route imports only INTERNAL_PARSE_SECRET; GEMINI_API_KEY accessed only via embed helper | closed |
| T-04-04-a | I | Secret in URL logs | mitigate | scheduleEmbedBatchesForDoc uses Authorization: Bearer header (not ?secret= query param) | closed |
| T-04-04-b | I | Unauthenticated embed via cron | mitigate | Cron GET uses ?secret= matching INTERNAL_PARSE_SECRET; timingSafeEqual applied | closed |
| T-04-04-c | E | SSRF / open redirect | accept | getInternalAppBaseUrl() resolves only from operator env vars or localhost constant; no user input | closed |
| T-04-04-d | I | Cross-doc via after() | mitigate | docId UUID-validated before use; forwarded unchanged to scheduleEmbedBatchesForDoc | closed |
| T-04-05-a | I | Cross-doc data leak via RPC | mitigate | matchDocumentChunks: p_doc_id = args.docId; RPC enforces WHERE c.doc_id = p_doc_id | closed |
| T-04-05-b | I | RPC exposed to anon | mitigate | match-document-chunks.ts exports function only — no HTTP handlers; import "server-only" | closed |
| T-04-05-c | I | Query text logged | mitigate | No console.* or logger calls in match-document-chunks.ts; query consumed only by embedQueryText | closed |
| T-04-05-d | E | Service role misuse in RAG | mitigate | match-document-chunks.ts: `import "server-only"` at line 1; uses supabaseAdmin | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-01-c | Migration is pure DDL — no API keys, credentials, or secrets reference SQL content | gsd-security-auditor | 2026-05-10 |
| AR-04-02 | T-04-04-c | SSRF surface is zero — base URL resolved only from operator-controlled env vars (CLARIFIN_APP_URL, VERCEL_URL) or compiled localhost constant; no user input reaches URL construction | gsd-security-auditor | 2026-05-10 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-10 | 20 | 20 | 0 | gsd-security-auditor (claude-sonnet-4-6) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-10
