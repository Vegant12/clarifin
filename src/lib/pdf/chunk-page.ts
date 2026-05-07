import type { StructuredTextItem } from "unpdf";

export type PageChunkType = "prose" | "table" | "heading" | "list";

export type PageChunkRow = {
  content: string;
  chunk_type: PageChunkType;
  source_page_start: number;
  source_page_end: number;
  page_number: number;
};

const PROSE_TARGET_TOKENS = 500;
const PROSE_OVERLAP_TOKENS = 75;

export function tokenEstimate(s: string): number {
  return Math.max(1, Math.ceil(s.length / 4));
}

/** Split long prose with ~500-token targets and ~75-token overlap. Break on ¶, newline, sentence, space. */
export function splitProseSegments(text: string): string[] {
  const t = text.trim();
  if (!t) {
    return [];
  }
  if (tokenEstimate(t) <= PROSE_TARGET_TOKENS) {
    return [t];
  }
  const out: string[] = [];
  let i = 0;
  const maxChars = PROSE_TARGET_TOKENS * 4;
  while (i < t.length) {
    let end = Math.min(t.length, i + maxChars);
    if (end < t.length) {
      const slice = t.slice(i, end);
      let cut = -1;
      const para = slice.lastIndexOf("\n\n");
      if (para > 80) {
        cut = i + para + 2;
      }
      if (cut < 0) {
        const nl = slice.lastIndexOf("\n");
        if (nl > slice.length * 0.4) {
          cut = i + nl + 1;
        }
      }
      if (cut < 0) {
        const dot = slice.lastIndexOf(". ");
        if (dot > slice.length * 0.45) {
          cut = i + dot + 2;
        }
      }
      if (cut < 0) {
        const sp = slice.lastIndexOf(" ");
        if (sp > 60) {
          cut = i + sp + 1;
        }
      }
      if (cut > i) {
        end = cut;
      }
    }
    const piece = t.slice(i, end).trim();
    if (piece) {
      out.push(piece);
    }
    if (end >= t.length) {
      break;
    }
    const back = PROSE_OVERLAP_TOKENS * 4;
    i = Math.max(i + 1, end - back);
    while (i < t.length && /\s/.test(t[i]!)) {
      i++;
    }
  }
  return out;
}

function sortReadingOrder(items: StructuredTextItem[]): StructuredTextItem[] {
  return [...items].sort((a, b) => b.y - a.y || a.x - b.x);
}

function clusterRows(sorted: StructuredTextItem[]): StructuredTextItem[][] {
  const rows: StructuredTextItem[][] = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (!last) {
      rows.push([it]);
      continue;
    }
    const ref = last[0]!;
    const threshold = Math.max(ref.fontSize * 0.35, 3);
    if (Math.abs(it.y - ref.y) <= threshold) {
      last.push(it);
    } else {
      rows.push([it]);
    }
  }
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
  }
  return rows;
}

function rowLooksTabular(row: StructuredTextItem[]): boolean {
  if (row.length < 2) {
    return false;
  }
  const span = row[row.length - 1]!.x - row[0]!.x;
  return span > 35;
}

function detectTable(rows: StructuredTextItem[][]): boolean {
  if (rows.length < 2) {
    return false;
  }
  return rows.every((r) => r.length >= 2 && rowLooksTabular(r));
}

function tableChunkFromRows(rows: StructuredTextItem[][]): string {
  return rows
    .map((r) =>
      r
        .map((i) => i.str.trim())
        .filter(Boolean)
        .join("\t"),
    )
    .join("\n");
}

/**
 * Strategy: detect multi-row tabular blocks from positional items; remainder becomes prose (prefer `plainText`, else joined non-table items). Single-page slices only — page fields are identical.
 */
export function chunkSinglePage(params: {
  pageNumber: number;
  plainText: string;
  items: StructuredTextItem[];
}): PageChunkRow[] {
  const { pageNumber: pn } = params;
  const rowsOut: PageChunkRow[] = [];

  if (params.items.length === 0) {
    const trimmed = params.plainText.trim();
    if (!trimmed) {
      return [];
    }
    for (const seg of splitProseSegments(trimmed)) {
      rowsOut.push({
        content: seg,
        chunk_type: "prose",
        source_page_start: pn,
        source_page_end: pn,
        page_number: pn,
      });
    }
    return rowsOut;
  }

  const sorted = sortReadingOrder(params.items);
  const rows = clusterRows(sorted);

  if (detectTable(rows)) {
    const tsv = tableChunkFromRows(rows);
    if (tsv.trim()) {
      rowsOut.push({
        content: tsv,
        chunk_type: "table",
        source_page_start: pn,
        source_page_end: pn,
        page_number: pn,
      });
    }
    const proseSource = params.plainText.trim();
    if (proseSource) {
      for (const seg of splitProseSegments(proseSource)) {
        rowsOut.push({
          content: seg,
          chunk_type: "prose",
          source_page_start: pn,
          source_page_end: pn,
          page_number: pn,
        });
      }
    }
    return rowsOut;
  }

  const joined = sorted
    .map((i) => i.str)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const proseSource = params.plainText.trim() || joined;
  if (!proseSource) {
    return rowsOut;
  }
  for (const seg of splitProseSegments(proseSource)) {
    rowsOut.push({
      content: seg,
      chunk_type: "prose",
      source_page_start: pn,
      source_page_end: pn,
      page_number: pn,
    });
  }
  return rowsOut;
}
