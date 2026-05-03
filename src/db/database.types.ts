/**
 * Database type stub — generated programmatically by `pnpm db:types` after
 * Plan 06 applies the init migration to local Supabase.
 *
 * This stub allows `src/db/client.ts` to typecheck before the live DB exists.
 * After Plan 06 runs `supabase gen types typescript --local`, this file is
 * overwritten with the real generated types.
 */
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
