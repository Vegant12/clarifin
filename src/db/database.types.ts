export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          citations: Json | null
          content: string
          created_at: string
          doc_id: string | null
          id: string
          role: string
          session_id: string
        }
        Insert: {
          citations?: Json | null
          content: string
          created_at?: string
          doc_id?: string | null
          id?: string
          role: string
          session_id: string
        }
        Update: {
          citations?: Json | null
          content?: string
          created_at?: string
          doc_id?: string | null
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          last_active: string
          session_token: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_active?: string
          session_token: string
        }
        Update: {
          created_at?: string
          id?: string
          last_active?: string
          session_token?: string
        }
        Relationships: []
      }
      chunks: {
        Row: {
          chunk_index: number
          chunk_type: Database["public"]["Enums"]["chunk_type_enum"]
          content: string
          created_at: string
          doc_id: string
          embedding: string | null
          id: string
          page_number: number
          section: string | null
          source_page_end: number
          source_page_start: number
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          chunk_type: Database["public"]["Enums"]["chunk_type_enum"]
          content: string
          created_at?: string
          doc_id: string
          embedding?: string | null
          id?: string
          page_number: number
          section?: string | null
          source_page_end: number
          source_page_start: number
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          chunk_type?: Database["public"]["Enums"]["chunk_type_enum"]
          content?: string
          created_at?: string
          doc_id?: string
          embedding?: string | null
          id?: string
          page_number?: number
          section?: string | null
          source_page_end?: number
          source_page_start?: number
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chunks_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_analysis: {
        Row: {
          created_at: string
          doc_id: string
          explanation: Json | null
          explanation_at: string | null
          id: string
          score: number | null
          score_at: string | null
          score_breakdown: Json | null
          score_reasoning: string | null
          starter_questions: Json | null
        }
        Insert: {
          created_at?: string
          doc_id: string
          explanation?: Json | null
          explanation_at?: string | null
          id?: string
          score?: number | null
          score_at?: string | null
          score_breakdown?: Json | null
          score_reasoning?: string | null
          starter_questions?: Json | null
        }
        Update: {
          created_at?: string
          doc_id?: string
          explanation?: Json | null
          explanation_at?: string | null
          id?: string
          score?: number | null
          score_at?: string | null
          score_breakdown?: Json | null
          score_reasoning?: string | null
          starter_questions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "document_analysis_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          error_message: string | null
          extraction_source: string | null
          failed_at: string | null
          filename: string
          gemini_file_resource_name: string | null
          id: string
          parse_next_page: number
          session_id: string | null
          size_bytes: number
          status: Database["public"]["Enums"]["document_status"]
          stock_data: Json | null
          stock_fetched_at: string | null
          storage_path: string
          ticker: string | null
          total_pages: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          extraction_source?: string | null
          failed_at?: string | null
          filename: string
          gemini_file_resource_name?: string | null
          id?: string
          parse_next_page?: number
          session_id?: string | null
          size_bytes: number
          status?: Database["public"]["Enums"]["document_status"]
          stock_data?: Json | null
          stock_fetched_at?: string | null
          storage_path: string
          ticker?: string | null
          total_pages?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          extraction_source?: string | null
          failed_at?: string | null
          filename?: string
          gemini_file_resource_name?: string | null
          id?: string
          parse_next_page?: number
          session_id?: string | null
          size_bytes?: number
          status?: Database["public"]["Enums"]["document_status"]
          stock_data?: Json | null
          stock_fetched_at?: string | null
          storage_path?: string
          ticker?: string | null
          total_pages?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_document_chunks: {
        Args: {
          p_doc_id: string
          p_match_count?: number
          p_query_embedding: string
        }
        Returns: {
          chunk_type: Database["public"]["Enums"]["chunk_type_enum"]
          content: string
          distance: number
          id: string
          page_number: number
          section: string
          source_page_end: number
          source_page_start: number
        }[]
      }
    }
    Enums: {
      chunk_type_enum: "prose" | "table" | "heading" | "list"
      document_status:
        | "uploaded"
        | "parsing"
        | "embedding"
        | "analyzing"
        | "ready"
        | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      chunk_type_enum: ["prose", "table", "heading", "list"],
      document_status: [
        "uploaded",
        "parsing",
        "embedding",
        "analyzing",
        "ready",
        "failed",
      ],
    },
  },
} as const
