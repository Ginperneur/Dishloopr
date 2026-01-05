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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          city_id: string | null
          created_at: string
          dish_id: string | null
          event_type: string
          id: string
          metadata: Json | null
          restaurant_id: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          dish_id?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          restaurant_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          city_id?: string | null
          created_at?: string
          dish_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          restaurant_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          country_code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      claim_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          notes: string | null
          proof_documents: string[] | null
          restaurant_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          proof_documents?: string[] | null
          restaurant_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          proof_documents?: string[] | null
          restaurant_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      dishes: {
        Row: {
          created_at: string
          cuisine_tags: string[] | null
          id: string
          is_active: boolean
          name: string
          search_count: number
          slug: string
          synonyms: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cuisine_tags?: string[] | null
          id?: string
          is_active?: boolean
          name: string
          search_count?: number
          slug: string
          synonyms?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cuisine_tags?: string[] | null
          id?: string
          is_active?: boolean
          name?: string
          search_count?: number
          slug?: string
          synonyms?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      helpful_votes: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpful_votes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          food_photos: string[] | null
          helpful_votes: number | null
          id: string
          name: string | null
          preferred_language: string | null
          reviewer_level: string | null
          total_reviews: number | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          food_photos?: string[] | null
          helpful_votes?: number | null
          id: string
          name?: string | null
          preferred_language?: string | null
          reviewer_level?: string | null
          total_reviews?: number | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          food_photos?: string[] | null
          helpful_votes?: number | null
          id?: string
          name?: string | null
          preferred_language?: string | null
          reviewer_level?: string | null
          total_reviews?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_dishes: {
        Row: {
          clicks: number
          confidence_score: number
          created_at: string
          dish_id: string
          id: string
          restaurant_id: string
        }
        Insert: {
          clicks?: number
          confidence_score?: number
          created_at?: string
          dish_id: string
          id?: string
          restaurant_id: string
        }
        Update: {
          clicks?: number
          confidence_score?: number
          created_at?: string
          dish_id?: string
          id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_dishes_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_dishes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string
          ambience_tags: string[] | null
          city_id: string
          claimed_by_owner_id: string | null
          concepts: string[] | null
          created_at: string
          cuisines: string[] | null
          featured_until: string | null
          geo_lat: number | null
          geo_lng: number | null
          id: string
          images: string[] | null
          is_active: boolean
          is_featured: boolean
          is_top_listing: boolean
          name: string
          opening_hours: Json | null
          phone: string | null
          postal_code: string | null
          price_level: number
          rating: number
          reservation_url: string | null
          review_count: number
          slug: string
          top_until: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          address: string
          ambience_tags?: string[] | null
          city_id: string
          claimed_by_owner_id?: string | null
          concepts?: string[] | null
          created_at?: string
          cuisines?: string[] | null
          featured_until?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          is_featured?: boolean
          is_top_listing?: boolean
          name: string
          opening_hours?: Json | null
          phone?: string | null
          postal_code?: string | null
          price_level?: number
          rating?: number
          reservation_url?: string | null
          review_count?: number
          slug: string
          top_until?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          address?: string
          ambience_tags?: string[] | null
          city_id?: string
          claimed_by_owner_id?: string | null
          concepts?: string[] | null
          created_at?: string
          cuisines?: string[] | null
          featured_until?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          is_featured?: boolean
          is_top_listing?: boolean
          name?: string
          opening_hours?: Json | null
          phone?: string | null
          postal_code?: string | null
          price_level?: number
          rating?: number
          reservation_url?: string | null
          review_count?: number
          slug?: string
          top_until?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          dishes_eaten: string[] | null
          id: string
          is_verified: boolean | null
          owner_response: string | null
          owner_response_at: string | null
          photos: string[] | null
          rating: number
          restaurant_id: string
          status: Database["public"]["Enums"]["review_status"]
          suggested_tags: string[] | null
          tag_votes: Json | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dishes_eaten?: string[] | null
          id?: string
          is_verified?: boolean | null
          owner_response?: string | null
          owner_response_at?: string | null
          photos?: string[] | null
          rating: number
          restaurant_id: string
          status?: Database["public"]["Enums"]["review_status"]
          suggested_tags?: string[] | null
          tag_votes?: Json | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dishes_eaten?: string[] | null
          id?: string
          is_verified?: boolean | null
          owner_response?: string | null
          owner_response_at?: string | null
          photos?: string[] | null
          rating?: number
          restaurant_id?: string
          status?: Database["public"]["Enums"]["review_status"]
          suggested_tags?: string[] | null
          tag_votes?: Json | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_reviewer_level: {
        Args: { helpful_count: number; review_count: number }
        Returns: string
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "owner" | "admin"
      price_level: "1" | "2" | "3" | "4"
      review_status: "published" | "pending" | "flagged"
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
      app_role: ["user", "owner", "admin"],
      price_level: ["1", "2", "3", "4"],
      review_status: ["published", "pending", "flagged"],
    },
  },
} as const
