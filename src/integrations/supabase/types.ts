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
      admin_activity_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      ambiance_pricing: {
        Row: {
          ambiance_tag: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          monthly_price: number
        }
        Insert: {
          ambiance_tag: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          monthly_price?: number
        }
        Update: {
          ambiance_tag?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          monthly_price?: number
        }
        Relationships: []
      }
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
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          country_code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          province: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          province?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          province?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      claim_activity_logs: {
        Row: {
          action_category: string
          action_type: string
          actor_id: string
          actor_role: string
          after_data: Json | null
          before_data: Json | null
          claim_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json | null
          restaurant_id: string | null
          user_agent: string | null
        }
        Insert: {
          action_category: string
          action_type: string
          actor_id: string
          actor_role: string
          after_data?: Json | null
          before_data?: Json | null
          claim_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          restaurant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action_category?: string
          action_type?: string
          actor_id?: string
          actor_role?: string
          after_data?: Json | null
          before_data?: Json | null
          claim_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          restaurant_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_activity_logs_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "restaurant_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_activity_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
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
      claim_verification_secrets: {
        Row: {
          attempts: number
          claim_id: string
          code_hash: string
          created_at: string
          email: string | null
          expires_at: string
          method: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          claim_id: string
          code_hash: string
          created_at?: string
          email?: string | null
          expires_at: string
          method: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          claim_id?: string
          code_hash?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          method?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_verification_secrets_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: true
            referencedRelation: "restaurant_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_restaurants: {
        Row: {
          collection_id: string
          created_at: string
          featured_reason: string | null
          id: string
          restaurant_id: string
          sort_order: number | null
        }
        Insert: {
          collection_id: string
          created_at?: string
          featured_reason?: string | null
          id?: string
          restaurant_id: string
          sort_order?: number | null
        }
        Update: {
          collection_id?: string
          created_at?: string
          featured_reason?: string | null
          id?: string
          restaurant_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_restaurants_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_restaurants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          ambience_tag: string | null
          city_id: string | null
          cover_image: string | null
          created_at: string
          created_by: string | null
          cuisine: string | null
          description: string | null
          description_i18n: Json
          dish_id: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number | null
          subtitle: string | null
          subtitle_i18n: Json
          title: string
          title_i18n: Json
          updated_at: string
        }
        Insert: {
          ambience_tag?: string | null
          city_id?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          cuisine?: string | null
          description?: string | null
          description_i18n?: Json
          dish_id?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number | null
          subtitle?: string | null
          subtitle_i18n?: Json
          title: string
          title_i18n?: Json
          updated_at?: string
        }
        Update: {
          ambience_tag?: string | null
          city_id?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          cuisine?: string | null
          description?: string | null
          description_i18n?: Json
          dish_id?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number | null
          subtitle?: string | null
          subtitle_i18n?: Json
          title?: string
          title_i18n?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          subject: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          subject: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          subject?: string
        }
        Relationships: []
      }
      cross_promotions: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          initiator_restaurant_id: string
          partner_restaurant_id: string
          starts_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          initiator_restaurant_id: string
          partner_restaurant_id: string
          starts_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          initiator_restaurant_id?: string
          partner_restaurant_id?: string
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cross_promotions_initiator_restaurant_id_fkey"
            columns: ["initiator_restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cross_promotions_partner_restaurant_id_fkey"
            columns: ["partner_restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_routing_events: {
        Row: {
          created_at: string
          dish_id: string | null
          id: string
          match_score: number | null
          routing_reason: string
          source_restaurant_id: string
          target_restaurant_id: string
          was_clicked: boolean | null
          was_converted: boolean | null
        }
        Insert: {
          created_at?: string
          dish_id?: string | null
          id?: string
          match_score?: number | null
          routing_reason: string
          source_restaurant_id: string
          target_restaurant_id: string
          was_clicked?: boolean | null
          was_converted?: boolean | null
        }
        Update: {
          created_at?: string
          dish_id?: string | null
          id?: string
          match_score?: number | null
          routing_reason?: string
          source_restaurant_id?: string
          target_restaurant_id?: string
          was_clicked?: boolean | null
          was_converted?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_routing_events_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_routing_events_source_restaurant_id_fkey"
            columns: ["source_restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_routing_events_target_restaurant_id_fkey"
            columns: ["target_restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_grid_points: {
        Row: {
          city_id: string
          created_at: string
          id: string
          is_active: boolean
          last_scanned_at: string | null
          lat: number
          lng: number
          name: string
          radius_meters: number
          search_terms: string[] | null
          type: string
          updated_at: string
        }
        Insert: {
          city_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_scanned_at?: string | null
          lat: number
          lng: number
          name: string
          radius_meters?: number
          search_terms?: string[] | null
          type?: string
          updated_at?: string
        }
        Update: {
          city_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_scanned_at?: string | null
          lat?: number
          lng?: number
          name?: string
          radius_meters?: number
          search_terms?: string[] | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_grid_points_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_results: {
        Row: {
          address: string | null
          city_id: string | null
          discovered_at: string
          id: string
          lat: number | null
          lng: number | null
          matched_restaurant_id: string | null
          name: string
          photo_reference: string | null
          place_id: string
          price_level: number | null
          rating: number | null
          raw_data: Json | null
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_grid_point_id: string | null
          source_search_term: string | null
          status: string
          types: string[] | null
          user_ratings_total: number | null
          venue_category: string
        }
        Insert: {
          address?: string | null
          city_id?: string | null
          discovered_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          matched_restaurant_id?: string | null
          name: string
          photo_reference?: string | null
          place_id: string
          price_level?: number | null
          rating?: number | null
          raw_data?: Json | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_grid_point_id?: string | null
          source_search_term?: string | null
          status?: string
          types?: string[] | null
          user_ratings_total?: number | null
          venue_category?: string
        }
        Update: {
          address?: string | null
          city_id?: string | null
          discovered_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          matched_restaurant_id?: string | null
          name?: string
          photo_reference?: string | null
          place_id?: string
          price_level?: number | null
          rating?: number | null
          raw_data?: Json | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_grid_point_id?: string | null
          source_search_term?: string | null
          status?: string
          types?: string[] | null
          user_ratings_total?: number | null
          venue_category?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_results_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_results_matched_restaurant_id_fkey"
            columns: ["matched_restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_results_source_grid_point_id_fkey"
            columns: ["source_grid_point_id"]
            isOneToOne: false
            referencedRelation: "discovery_grid_points"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_runs: {
        Row: {
          api_calls_used: number
          city_id: string | null
          completed_at: string | null
          duplicates: number
          error_message: string | null
          grid_point_id: string | null
          id: string
          new_results: number
          results_found: number
          started_at: string
          status: string
          triggered_by: string | null
        }
        Insert: {
          api_calls_used?: number
          city_id?: string | null
          completed_at?: string | null
          duplicates?: number
          error_message?: string | null
          grid_point_id?: string | null
          id?: string
          new_results?: number
          results_found?: number
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Update: {
          api_calls_used?: number
          city_id?: string | null
          completed_at?: string | null
          duplicates?: number
          error_message?: string | null
          grid_point_id?: string | null
          id?: string
          new_results?: number
          results_found?: number
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_runs_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_runs_grid_point_id_fkey"
            columns: ["grid_point_id"]
            isOneToOne: false
            referencedRelation: "discovery_grid_points"
            referencedColumns: ["id"]
          },
        ]
      }
      dish_canonical_stage_20260625: {
        Row: {
          action: string | null
          canonical_slug: string | null
          course: string | null
          dish_name: string | null
          dish_slug: string | null
          restaurant_count: number | null
        }
        Insert: {
          action?: string | null
          canonical_slug?: string | null
          course?: string | null
          dish_name?: string | null
          dish_slug?: string | null
          restaurant_count?: number | null
        }
        Update: {
          action?: string | null
          canonical_slug?: string | null
          course?: string | null
          dish_name?: string | null
          dish_slug?: string | null
          restaurant_count?: number | null
        }
        Relationships: []
      }
      dish_ratings: {
        Row: {
          created_at: string
          dish_id: string
          id: string
          rating: number
          review_id: string
        }
        Insert: {
          created_at?: string
          dish_id: string
          id?: string
          rating: number
          review_id: string
        }
        Update: {
          created_at?: string
          dish_id?: string
          id?: string
          rating?: number
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dish_ratings_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_ratings_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      dishes: {
        Row: {
          canonical_slug: string | null
          course: string | null
          created_at: string
          cuisine_tags: string[] | null
          id: string
          is_active: boolean
          is_gluten_free: boolean
          is_halal: boolean
          is_vegan: boolean
          is_vegetarian: boolean
          name: string
          name_en: string | null
          search_count: number
          seasonal_tags: string[] | null
          slug: string
          synonyms: string[] | null
          updated_at: string
        }
        Insert: {
          canonical_slug?: string | null
          course?: string | null
          created_at?: string
          cuisine_tags?: string[] | null
          id?: string
          is_active?: boolean
          is_gluten_free?: boolean
          is_halal?: boolean
          is_vegan?: boolean
          is_vegetarian?: boolean
          name: string
          name_en?: string | null
          search_count?: number
          seasonal_tags?: string[] | null
          slug: string
          synonyms?: string[] | null
          updated_at?: string
        }
        Update: {
          canonical_slug?: string | null
          course?: string | null
          created_at?: string
          cuisine_tags?: string[] | null
          id?: string
          is_active?: boolean
          is_gluten_free?: boolean
          is_halal?: boolean
          is_vegan?: boolean
          is_vegetarian?: boolean
          name?: string
          name_en?: string | null
          search_count?: number
          seasonal_tags?: string[] | null
          slug?: string
          synonyms?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          custom_filter: Json | null
          failed_count: number | null
          html_content: string
          id: string
          last_cursor: string | null
          segment: string
          sent_count: number | null
          started_at: string | null
          status: string
          subject: string
          title: string
          total_recipients: number | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          custom_filter?: Json | null
          failed_count?: number | null
          html_content: string
          id?: string
          last_cursor?: string | null
          segment?: string
          sent_count?: number | null
          started_at?: string | null
          status?: string
          subject: string
          title: string
          total_recipients?: number | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          custom_filter?: Json | null
          failed_count?: number | null
          html_content?: string
          id?: string
          last_cursor?: string | null
          segment?: string
          sent_count?: number | null
          started_at?: string | null
          status?: string
          subject?: string
          title?: string
          total_recipients?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          app_version: string | null
          component_stack: string | null
          created_at: string
          id: string
          message: string
          metadata: Json
          route: string | null
          stack: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          component_stack?: string | null
          created_at?: string
          id?: string
          message: string
          metadata?: Json
          route?: string | null
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          component_stack?: string | null
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          route?: string | null
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
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
      featured_pricing_history: {
        Row: {
          created_at: string
          id: string
          new_price: number
          old_price: number
          reason: string | null
          slot_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_price: number
          old_price: number
          reason?: string | null
          slot_id: string
        }
        Update: {
          created_at?: string
          id?: string
          new_price?: number
          old_price?: number
          reason?: string | null
          slot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_pricing_history_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "featured_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_slots: {
        Row: {
          base_price: number
          city_id: string
          cooling_off_days: number
          created_at: string
          cuisine: string
          demand_multiplier: number
          id: string
          is_active: boolean
          last_price_update: string | null
          max_slots: number
          updated_at: string
        }
        Insert: {
          base_price?: number
          city_id: string
          cooling_off_days?: number
          created_at?: string
          cuisine: string
          demand_multiplier?: number
          id?: string
          is_active?: boolean
          last_price_update?: string | null
          max_slots?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          city_id?: string
          cooling_off_days?: number
          created_at?: string
          cuisine?: string
          demand_multiplier?: number
          id?: string
          is_active?: boolean
          last_price_update?: string | null
          max_slots?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_slots_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_subscriptions: {
        Row: {
          ambiance_addon_price: number
          consecutive_months: number
          cooling_off_until: string | null
          created_at: string
          expires_at: string
          extra_ambiances: string[] | null
          id: string
          included_ambiance: string | null
          max_duration_months: number
          monthly_price: number
          restaurant_id: string
          review_request_sent_at: string | null
          slot_id: string
          starts_at: string
          status: Database["public"]["Enums"]["featured_subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          total_clicks: number
          total_monthly_price: number
          total_views: number
          updated_at: string
        }
        Insert: {
          ambiance_addon_price?: number
          consecutive_months?: number
          cooling_off_until?: string | null
          created_at?: string
          expires_at: string
          extra_ambiances?: string[] | null
          id?: string
          included_ambiance?: string | null
          max_duration_months?: number
          monthly_price: number
          restaurant_id: string
          review_request_sent_at?: string | null
          slot_id: string
          starts_at?: string
          status?: Database["public"]["Enums"]["featured_subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          total_clicks?: number
          total_monthly_price: number
          total_views?: number
          updated_at?: string
        }
        Update: {
          ambiance_addon_price?: number
          consecutive_months?: number
          cooling_off_until?: string | null
          created_at?: string
          expires_at?: string
          extra_ambiances?: string[] | null
          id?: string
          included_ambiance?: string | null
          max_duration_months?: number
          monthly_price?: number
          restaurant_id?: string
          review_request_sent_at?: string | null
          slot_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["featured_subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          total_clicks?: number
          total_monthly_price?: number
          total_views?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_subscriptions_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "featured_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_waitlist: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          notified_at: string | null
          position: number
          price_at_registration: number
          restaurant_id: string
          selected_ambiances: string[] | null
          slot_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          notified_at?: string | null
          position: number
          price_at_registration: number
          restaurant_id: string
          selected_ambiances?: string[] | null
          slot_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          notified_at?: string | null
          position?: number
          price_at_registration?: number
          restaurant_id?: string
          selected_ambiances?: string[] | null
          slot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_waitlist_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_waitlist_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "featured_slots"
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
      internal_feedback: {
        Row: {
          category: string | null
          comment: string | null
          contact_email: string | null
          created_at: string
          id: string
          is_resolved: boolean
          rating: number
          resolved_at: string | null
          restaurant_id: string
        }
        Insert: {
          category?: string | null
          comment?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          is_resolved?: boolean
          rating: number
          resolved_at?: string | null
          restaurant_id: string
        }
        Update: {
          category?: string | null
          comment?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          is_resolved?: boolean
          rating?: number
          resolved_at?: string | null
          restaurant_id?: string
        }
        Relationships: []
      }
      loyalty_programs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          restaurant_id: string
          reward_description: string
          stamps_required: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          restaurant_id: string
          reward_description?: string
          stamps_required?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          restaurant_id?: string
          reward_description?: string
          stamps_required?: number
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_stamps: {
        Row: {
          created_at: string
          id: string
          redeemed: boolean
          restaurant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          redeemed?: boolean
          restaurant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          redeemed?: boolean
          restaurant_id?: string
          user_id?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          allergens: string[] | null
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean | null
          is_gluten_free: boolean | null
          is_vegan: boolean | null
          is_vegetarian: boolean | null
          name: string
          price: number | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          allergens?: string[] | null
          category: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_gluten_free?: boolean | null
          is_vegan?: boolean | null
          is_vegetarian?: boolean | null
          name: string
          price?: number | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          allergens?: string[] | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_gluten_free?: boolean | null
          is_vegan?: boolean | null
          is_vegetarian?: boolean | null
          name?: string
          price?: number | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_scrape_runs: {
        Row: {
          completed_at: string
          created_at: string
          dishes_added: number
          dishes_existing: number
          dishes_extracted: number
          error_message: string | null
          id: string
          restaurant_id: string
          scraped_url: string | null
          source: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          dishes_added?: number
          dishes_existing?: number
          dishes_extracted?: number
          error_message?: string | null
          id?: string
          restaurant_id: string
          scraped_url?: string | null
          source?: string
          started_at?: string
          status: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          dishes_added?: number
          dishes_existing?: number
          dishes_extracted?: number
          error_message?: string | null
          id?: string
          restaurant_id?: string
          scraped_url?: string | null
          source?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_scrape_runs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_editions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          intro_text: string | null
          recipient_count: number | null
          scheduled_for: string | null
          sent_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          intro_text?: string | null
          recipient_count?: number | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          intro_text?: string | null
          recipient_count?: number | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_placements: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string | null
          edition_id: string | null
          id: string
          price_paid: number
          promo_type: string
          restaurant_id: string
          review_request_sent_at: string | null
          scope: string
          status: string
          stripe_payment_id: string | null
          target_city_id: string | null
          target_province: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          edition_id?: string | null
          id?: string
          price_paid?: number
          promo_type?: string
          restaurant_id: string
          review_request_sent_at?: string | null
          scope?: string
          status?: string
          stripe_payment_id?: string | null
          target_city_id?: string | null
          target_province?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string | null
          edition_id?: string | null
          id?: string
          price_paid?: number
          promo_type?: string
          restaurant_id?: string
          review_request_sent_at?: string | null
          scope?: string
          status?: string
          stripe_payment_id?: string | null
          target_city_id?: string | null
          target_province?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_placements_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "newsletter_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_placements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          is_active: boolean
          subscribed_at: string
          unsubscribed_at: string | null
          user_id: string | null
        }
        Insert: {
          email: string
          id?: string
          is_active?: boolean
          subscribed_at?: string
          unsubscribed_at?: string | null
          user_id?: string | null
        }
        Update: {
          email?: string
          id?: string
          is_active?: boolean
          subscribed_at?: string
          unsubscribed_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      nl_provinces: {
        Row: {
          created_at: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          created_at: string
          id: string
          notification_type: string
          restaurant_id: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_type?: string
          restaurant_id: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_type?: string
          restaurant_id?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_hours_exceptions: {
        Row: {
          close_time: string | null
          created_at: string
          exception_date: string
          id: string
          is_closed: boolean
          open_time: string | null
          reason: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          close_time?: string | null
          created_at?: string
          exception_date: string
          id?: string
          is_closed?: boolean
          open_time?: string | null
          reason?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          close_time?: string | null
          created_at?: string
          exception_date?: string
          id?: string
          is_closed?: boolean
          open_time?: string | null
          reason?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opening_hours_exceptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_anomaly_alerts_log: {
        Row: {
          created_at: string
          delta_pct: number | null
          id: string
          metric: string
          restaurant_id: string
          severity: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          delta_pct?: number | null
          id?: string
          metric: string
          restaurant_id: string
          severity: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          delta_pct?: number | null
          id?: string
          metric?: string
          restaurant_id?: string
          severity?: string
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_anomaly_alerts_log_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_email_preferences: {
        Row: {
          anomaly_alert_frequency: string
          anomaly_alert_severity: string
          anomaly_alerts: boolean
          created_at: string
          updated_at: string
          user_id: string
          weekly_report: boolean
        }
        Insert: {
          anomaly_alert_frequency?: string
          anomaly_alert_severity?: string
          anomaly_alerts?: boolean
          created_at?: string
          updated_at?: string
          user_id: string
          weekly_report?: boolean
        }
        Update: {
          anomaly_alert_frequency?: string
          anomaly_alert_severity?: string
          anomaly_alerts?: boolean
          created_at?: string
          updated_at?: string
          user_id?: string
          weekly_report?: boolean
        }
        Relationships: []
      }
      owner_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          restaurant_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          restaurant_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          restaurant_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      owner_pro_subscriptions: {
        Row: {
          billing_interval: string | null
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          review_request_sent_at: string | null
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_interval?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          review_request_sent_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_interval?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          review_request_sent_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      owner_weekly_recommendations: {
        Row: {
          actions: Json
          created_at: string
          id: string
          model: string | null
          restaurant_id: string
          summary: string | null
          week_start: string
        }
        Insert: {
          actions?: Json
          created_at?: string
          id?: string
          model?: string | null
          restaurant_id: string
          summary?: string | null
          week_start: string
        }
        Update: {
          actions?: Json
          created_at?: string
          id?: string
          model?: string | null
          restaurant_id?: string
          summary?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_weekly_recommendations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
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
          instagram_url: string | null
          name: string | null
          preferred_language: string | null
          reviewer_level: string | null
          tiktok_url: string | null
          total_reviews: number | null
          twitter_url: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          food_photos?: string[] | null
          helpful_votes?: number | null
          id: string
          instagram_url?: string | null
          name?: string | null
          preferred_language?: string | null
          reviewer_level?: string | null
          tiktok_url?: string | null
          total_reviews?: number | null
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          food_photos?: string[] | null
          helpful_votes?: number | null
          id?: string
          instagram_url?: string | null
          name?: string | null
          preferred_language?: string | null
          reviewer_level?: string | null
          tiktok_url?: string | null
          total_reviews?: number | null
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      promo_code_redemptions: {
        Row: {
          created_at: string
          id: string
          promo_code_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          promo_code_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          promo_code_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_redemptions_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          restaurant_id: string
          updated_at: string
          use_count: number
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          restaurant_id: string
          updated_at?: string
          use_count?: number
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          restaurant_id?: string
          updated_at?: string
          use_count?: number
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      rate_limit_log: {
        Row: {
          created_at: string
          function_name: string
          id: string
          identifier: string
        }
        Insert: {
          created_at?: string
          function_name: string
          id?: string
          identifier: string
        }
        Update: {
          created_at?: string
          function_name?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      reservation_intents: {
        Row: {
          clicked_at: string
          follow_up_sent_at: string | null
          id: string
          restaurant_id: string
          review_submitted: boolean
          user_id: string
        }
        Insert: {
          clicked_at?: string
          follow_up_sent_at?: string | null
          id?: string
          restaurant_id: string
          review_submitted?: boolean
          user_id: string
        }
        Update: {
          clicked_at?: string
          follow_up_sent_at?: string | null
          id?: string
          restaurant_id?: string
          review_submitted?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_intents_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      response_templates: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          restaurant_id: string
          sentiment: string | null
          title: string
          updated_at: string
          use_count: number
          user_id: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          id?: string
          restaurant_id: string
          sentiment?: string | null
          title: string
          updated_at?: string
          use_count?: number
          user_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          restaurant_id?: string
          sentiment?: string | null
          title?: string
          updated_at?: string
          use_count?: number
          user_id?: string
        }
        Relationships: []
      }
      restaurant_chains: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      restaurant_claims: {
        Row: {
          admin_notes: string | null
          claim_attempt_count: number
          created_at: string
          email_verified: boolean
          email_verified_at: string | null
          id: string
          is_primary: boolean
          phone_code_expires_at: string | null
          phone_number: string | null
          phone_verification_code: string | null
          phone_verified: boolean
          phone_verified_at: string | null
          restaurant_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
          verification_completed_at: string | null
          verification_method:
            | Database["public"]["Enums"]["verification_method"]
            | null
          verification_proof: Json | null
          verification_started_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          claim_attempt_count?: number
          created_at?: string
          email_verified?: boolean
          email_verified_at?: string | null
          id?: string
          is_primary?: boolean
          phone_code_expires_at?: string | null
          phone_number?: string | null
          phone_verification_code?: string | null
          phone_verified?: boolean
          phone_verified_at?: string | null
          restaurant_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
          verification_completed_at?: string | null
          verification_method?:
            | Database["public"]["Enums"]["verification_method"]
            | null
          verification_proof?: Json | null
          verification_started_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          claim_attempt_count?: number
          created_at?: string
          email_verified?: boolean
          email_verified_at?: string | null
          id?: string
          is_primary?: boolean
          phone_code_expires_at?: string | null
          phone_number?: string | null
          phone_verification_code?: string | null
          phone_verified?: boolean
          phone_verified_at?: string | null
          restaurant_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          verification_completed_at?: string | null
          verification_method?:
            | Database["public"]["Enums"]["verification_method"]
            | null
          verification_proof?: Json | null
          verification_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_claims_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_deals: {
        Row: {
          conditions: string | null
          created_at: string
          deal_type: string
          description: string | null
          discount_percentage: number | null
          id: string
          is_active: boolean
          restaurant_id: string
          title: string
          updated_at: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          conditions?: string | null
          created_at?: string
          deal_type?: string
          description?: string | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean
          restaurant_id: string
          title: string
          updated_at?: string
          valid_from?: string
          valid_until: string
        }
        Update: {
          conditions?: string | null
          created_at?: string
          deal_type?: string
          description?: string | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean
          restaurant_id?: string
          title?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_deals_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_dishes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          clicks: number
          confidence_score: number
          course_type: string | null
          created_at: string
          created_by: string | null
          dish_id: string
          id: string
          is_gluten_free: boolean
          is_halal: boolean
          is_signature: boolean
          is_vegan: boolean
          is_vegetarian: boolean
          rejected_reason: string | null
          restaurant_id: string
          source: string | null
          status: string | null
          updated_at: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          clicks?: number
          confidence_score?: number
          course_type?: string | null
          created_at?: string
          created_by?: string | null
          dish_id: string
          id?: string
          is_gluten_free?: boolean
          is_halal?: boolean
          is_signature?: boolean
          is_vegan?: boolean
          is_vegetarian?: boolean
          rejected_reason?: string | null
          restaurant_id: string
          source?: string | null
          status?: string | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          clicks?: number
          confidence_score?: number
          course_type?: string | null
          created_at?: string
          created_by?: string | null
          dish_id?: string
          id?: string
          is_gluten_free?: boolean
          is_halal?: boolean
          is_signature?: boolean
          is_vegan?: boolean
          is_vegetarian?: boolean
          rejected_reason?: string | null
          restaurant_id?: string
          source?: string | null
          status?: string | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
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
      restaurant_events: {
        Row: {
          created_at: string
          current_participants: number | null
          description: string | null
          end_date: string | null
          event_date: string
          event_type: string
          id: string
          image_url: string | null
          is_active: boolean | null
          max_participants: number | null
          price: number | null
          restaurant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_participants?: number | null
          description?: string | null
          end_date?: string | null
          event_date: string
          event_type: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          max_participants?: number | null
          price?: number | null
          restaurant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_participants?: number | null
          description?: string | null
          end_date?: string | null
          event_date?: string
          event_type?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          max_participants?: number | null
          price?: number | null
          restaurant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_managers: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_by: string | null
          restaurant_id: string
          role: Database["public"]["Enums"]["manager_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          restaurant_id: string
          role?: Database["public"]["Enums"]["manager_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          restaurant_id?: string
          role?: Database["public"]["Enums"]["manager_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_managers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_pending_edits: {
        Row: {
          created_at: string
          id: string
          proposed_changes: Json
          restaurant_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          proposed_changes: Json
          restaurant_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          proposed_changes?: Json
          restaurant_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_pending_edits_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_suggestions: {
        Row: {
          address: string | null
          admin_notes: string | null
          city: string | null
          created_at: string
          cuisine: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggested_by: string | null
          suggester_email: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          city?: string | null
          created_at?: string
          cuisine?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_by?: string | null
          suggester_email?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          city?: string | null
          created_at?: string
          cuisine?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_by?: string | null
          suggester_email?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      restaurant_tag_subscriptions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          payment_type: string
          restaurant_id: string
          stripe_subscription_id: string | null
          tag_category: string
          tag_value: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          payment_type?: string
          restaurant_id: string
          stripe_subscription_id?: string | null
          tag_category: string
          tag_value: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          payment_type?: string
          restaurant_id?: string
          stripe_subscription_id?: string | null
          tag_category?: string
          tag_value?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tag_subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_team_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_at: string
          invited_by: string
          invited_email: string
          restaurant_id: string
          role: string
          status: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          invited_by: string
          invited_email: string
          restaurant_id: string
          role?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string
          invited_email?: string
          restaurant_id?: string
          role?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      restaurant_translations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          language_code: string
          name: string | null
          restaurant_id: string
          tagline: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          language_code: string
          name?: string | null
          restaurant_id: string
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          language_code?: string
          name?: string | null
          restaurant_id?: string
          tagline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_translations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          accepts_reservations: boolean
          accepts_routed_demand: boolean | null
          added_by_source: string
          address: string
          ambience_clean: string | null
          ambience_tags: string[] | null
          chain_id: string | null
          city_id: string
          claim_status: Database["public"]["Enums"]["restaurant_claim_status"]
          claimed_by_owner_id: string | null
          concept_clean: string | null
          concepts: string[] | null
          created_at: string
          cuisine_primary: string | null
          cuisines: string[] | null
          current_busy_level: string | null
          dietary_options: string[] | null
          experiences: string[] | null
          featured_until: string | null
          geo_lat: number | null
          geo_lng: number | null
          google_dine_in: boolean | null
          google_enriched_at: string | null
          google_place_id: string | null
          google_primary_type: string | null
          google_rating: number | null
          google_review_count: number | null
          google_reviews_count: number | null
          google_status: string | null
          has_delivery: boolean
          has_takeaway: boolean
          has_terrace: boolean
          id: string
          images: string[] | null
          instagram_url: string | null
          is_active: boolean
          is_featured: boolean
          is_fully_halal: boolean
          is_fully_vegan: boolean
          is_fully_vegetarian: boolean
          is_top_listing: boolean
          meal_types: string[] | null
          meal_types_clean: string | null
          name: string
          needs_manual_review: boolean | null
          opening_hours: Json | null
          owner_tier: string
          phone: string | null
          photos_fetched_at: string | null
          postal_code: string | null
          price_level: number
          rating: number
          reservation_reminder_sent_at: string | null
          reservation_url: string | null
          review_count: number
          review_status: string | null
          routed_demand_dishes: string[] | null
          slug: string
          sustainability_score: number | null
          tiktok_url: string | null
          top_until: string | null
          updated_at: string
          verified_at: string | null
          website_checked_at: string | null
          website_status: string | null
          website_status_code: number | null
          website_url: string | null
          zenchef_id: string | null
        }
        Insert: {
          accepts_reservations?: boolean
          accepts_routed_demand?: boolean | null
          added_by_source?: string
          address: string
          ambience_clean?: string | null
          ambience_tags?: string[] | null
          chain_id?: string | null
          city_id: string
          claim_status?: Database["public"]["Enums"]["restaurant_claim_status"]
          claimed_by_owner_id?: string | null
          concept_clean?: string | null
          concepts?: string[] | null
          created_at?: string
          cuisine_primary?: string | null
          cuisines?: string[] | null
          current_busy_level?: string | null
          dietary_options?: string[] | null
          experiences?: string[] | null
          featured_until?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          google_dine_in?: boolean | null
          google_enriched_at?: string | null
          google_place_id?: string | null
          google_primary_type?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          google_reviews_count?: number | null
          google_status?: string | null
          has_delivery?: boolean
          has_takeaway?: boolean
          has_terrace?: boolean
          id?: string
          images?: string[] | null
          instagram_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          is_fully_halal?: boolean
          is_fully_vegan?: boolean
          is_fully_vegetarian?: boolean
          is_top_listing?: boolean
          meal_types?: string[] | null
          meal_types_clean?: string | null
          name: string
          needs_manual_review?: boolean | null
          opening_hours?: Json | null
          owner_tier?: string
          phone?: string | null
          photos_fetched_at?: string | null
          postal_code?: string | null
          price_level?: number
          rating?: number
          reservation_reminder_sent_at?: string | null
          reservation_url?: string | null
          review_count?: number
          review_status?: string | null
          routed_demand_dishes?: string[] | null
          slug: string
          sustainability_score?: number | null
          tiktok_url?: string | null
          top_until?: string | null
          updated_at?: string
          verified_at?: string | null
          website_checked_at?: string | null
          website_status?: string | null
          website_status_code?: number | null
          website_url?: string | null
          zenchef_id?: string | null
        }
        Update: {
          accepts_reservations?: boolean
          accepts_routed_demand?: boolean | null
          added_by_source?: string
          address?: string
          ambience_clean?: string | null
          ambience_tags?: string[] | null
          chain_id?: string | null
          city_id?: string
          claim_status?: Database["public"]["Enums"]["restaurant_claim_status"]
          claimed_by_owner_id?: string | null
          concept_clean?: string | null
          concepts?: string[] | null
          created_at?: string
          cuisine_primary?: string | null
          cuisines?: string[] | null
          current_busy_level?: string | null
          dietary_options?: string[] | null
          experiences?: string[] | null
          featured_until?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          google_dine_in?: boolean | null
          google_enriched_at?: string | null
          google_place_id?: string | null
          google_primary_type?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          google_reviews_count?: number | null
          google_status?: string | null
          has_delivery?: boolean
          has_takeaway?: boolean
          has_terrace?: boolean
          id?: string
          images?: string[] | null
          instagram_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          is_fully_halal?: boolean
          is_fully_vegan?: boolean
          is_fully_vegetarian?: boolean
          is_top_listing?: boolean
          meal_types?: string[] | null
          meal_types_clean?: string | null
          name?: string
          needs_manual_review?: boolean | null
          opening_hours?: Json | null
          owner_tier?: string
          phone?: string | null
          photos_fetched_at?: string | null
          postal_code?: string | null
          price_level?: number
          rating?: number
          reservation_reminder_sent_at?: string | null
          reservation_url?: string | null
          review_count?: number
          review_status?: string | null
          routed_demand_dishes?: string[] | null
          slug?: string
          sustainability_score?: number | null
          tiktok_url?: string | null
          top_until?: string | null
          updated_at?: string
          verified_at?: string | null
          website_checked_at?: string | null
          website_status?: string | null
          website_status_code?: number | null
          website_url?: string | null
          zenchef_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "restaurant_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurants_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants_backup_20260624: {
        Row: {
          accepts_reservations: boolean | null
          accepts_routed_demand: boolean | null
          added_by_source: string | null
          address: string | null
          ambience_tags: string[] | null
          chain_id: string | null
          city_id: string | null
          claim_status:
            | Database["public"]["Enums"]["restaurant_claim_status"]
            | null
          claimed_by_owner_id: string | null
          concepts: string[] | null
          created_at: string | null
          cuisines: string[] | null
          current_busy_level: string | null
          dietary_options: string[] | null
          experiences: string[] | null
          featured_until: string | null
          geo_lat: number | null
          geo_lng: number | null
          google_enriched_at: string | null
          google_place_id: string | null
          google_rating: number | null
          google_reviews_count: number | null
          has_delivery: boolean | null
          has_takeaway: boolean | null
          has_terrace: boolean | null
          id: string | null
          images: string[] | null
          instagram_url: string | null
          is_active: boolean | null
          is_featured: boolean | null
          is_fully_halal: boolean | null
          is_fully_vegan: boolean | null
          is_fully_vegetarian: boolean | null
          is_top_listing: boolean | null
          meal_types: string[] | null
          name: string | null
          opening_hours: Json | null
          owner_tier: string | null
          phone: string | null
          photos_fetched_at: string | null
          postal_code: string | null
          price_level: number | null
          rating: number | null
          reservation_reminder_sent_at: string | null
          reservation_url: string | null
          review_count: number | null
          routed_demand_dishes: string[] | null
          slug: string | null
          sustainability_score: number | null
          tiktok_url: string | null
          top_until: string | null
          updated_at: string | null
          website_checked_at: string | null
          website_status: string | null
          website_status_code: number | null
          website_url: string | null
          zenchef_id: string | null
        }
        Insert: {
          accepts_reservations?: boolean | null
          accepts_routed_demand?: boolean | null
          added_by_source?: string | null
          address?: string | null
          ambience_tags?: string[] | null
          chain_id?: string | null
          city_id?: string | null
          claim_status?:
            | Database["public"]["Enums"]["restaurant_claim_status"]
            | null
          claimed_by_owner_id?: string | null
          concepts?: string[] | null
          created_at?: string | null
          cuisines?: string[] | null
          current_busy_level?: string | null
          dietary_options?: string[] | null
          experiences?: string[] | null
          featured_until?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          google_enriched_at?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_reviews_count?: number | null
          has_delivery?: boolean | null
          has_takeaway?: boolean | null
          has_terrace?: boolean | null
          id?: string | null
          images?: string[] | null
          instagram_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_fully_halal?: boolean | null
          is_fully_vegan?: boolean | null
          is_fully_vegetarian?: boolean | null
          is_top_listing?: boolean | null
          meal_types?: string[] | null
          name?: string | null
          opening_hours?: Json | null
          owner_tier?: string | null
          phone?: string | null
          photos_fetched_at?: string | null
          postal_code?: string | null
          price_level?: number | null
          rating?: number | null
          reservation_reminder_sent_at?: string | null
          reservation_url?: string | null
          review_count?: number | null
          routed_demand_dishes?: string[] | null
          slug?: string | null
          sustainability_score?: number | null
          tiktok_url?: string | null
          top_until?: string | null
          updated_at?: string | null
          website_checked_at?: string | null
          website_status?: string | null
          website_status_code?: number | null
          website_url?: string | null
          zenchef_id?: string | null
        }
        Update: {
          accepts_reservations?: boolean | null
          accepts_routed_demand?: boolean | null
          added_by_source?: string | null
          address?: string | null
          ambience_tags?: string[] | null
          chain_id?: string | null
          city_id?: string | null
          claim_status?:
            | Database["public"]["Enums"]["restaurant_claim_status"]
            | null
          claimed_by_owner_id?: string | null
          concepts?: string[] | null
          created_at?: string | null
          cuisines?: string[] | null
          current_busy_level?: string | null
          dietary_options?: string[] | null
          experiences?: string[] | null
          featured_until?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          google_enriched_at?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_reviews_count?: number | null
          has_delivery?: boolean | null
          has_takeaway?: boolean | null
          has_terrace?: boolean | null
          id?: string | null
          images?: string[] | null
          instagram_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_fully_halal?: boolean | null
          is_fully_vegan?: boolean | null
          is_fully_vegetarian?: boolean | null
          is_top_listing?: boolean | null
          meal_types?: string[] | null
          name?: string | null
          opening_hours?: Json | null
          owner_tier?: string | null
          phone?: string | null
          photos_fetched_at?: string | null
          postal_code?: string | null
          price_level?: number | null
          rating?: number | null
          reservation_reminder_sent_at?: string | null
          reservation_url?: string | null
          review_count?: number | null
          routed_demand_dishes?: string[] | null
          slug?: string | null
          sustainability_score?: number | null
          tiktok_url?: string | null
          top_until?: string | null
          updated_at?: string | null
          website_checked_at?: string | null
          website_status?: string | null
          website_status_code?: number | null
          website_url?: string | null
          zenchef_id?: string | null
        }
        Relationships: []
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
      scrape_queue: {
        Row: {
          added_dishes: number | null
          attempts: number
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          restaurant_id: string
          restaurant_name: string
          source: string | null
          started_at: string | null
          status: string
          updated_at: string
          website_url: string
        }
        Insert: {
          added_dishes?: number | null
          attempts?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          restaurant_id: string
          restaurant_name: string
          source?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          website_url: string
        }
        Update: {
          added_dishes?: number | null
          attempts?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          restaurant_id?: string
          restaurant_name?: string
          source?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          website_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrape_queue_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_landing_pages: {
        Row: {
          canonical_url: string | null
          city_id: string | null
          created_at: string
          created_by: string | null
          dish_id: string | null
          extended_description: string | null
          faq_content: Json | null
          h1_title: string
          id: string
          intro_text: string | null
          is_active: boolean | null
          is_auto_generated: boolean | null
          keywords: string[] | null
          meta_description: string
          meta_title: string
          slug: string
          updated_at: string
        }
        Insert: {
          canonical_url?: string | null
          city_id?: string | null
          created_at?: string
          created_by?: string | null
          dish_id?: string | null
          extended_description?: string | null
          faq_content?: Json | null
          h1_title: string
          id?: string
          intro_text?: string | null
          is_active?: boolean | null
          is_auto_generated?: boolean | null
          keywords?: string[] | null
          meta_description: string
          meta_title: string
          slug: string
          updated_at?: string
        }
        Update: {
          canonical_url?: string | null
          city_id?: string | null
          created_at?: string
          created_by?: string | null
          dish_id?: string | null
          extended_description?: string | null
          faq_content?: Json | null
          h1_title?: string
          id?: string
          intro_text?: string | null
          is_active?: boolean | null
          is_auto_generated?: boolean | null
          keywords?: string[] | null
          meta_description?: string
          meta_title?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_landing_pages_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_landing_pages_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_list_restaurants: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          list_id: string
          restaurant_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          list_id: string
          restaurant_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          list_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_list_restaurants_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shared_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_list_restaurants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_list_votes: {
        Row: {
          created_at: string
          id: string
          list_id: string
          restaurant_id: string
          voter_id: string | null
          voter_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          list_id: string
          restaurant_id: string
          voter_id?: string | null
          voter_name: string
        }
        Update: {
          created_at?: string
          id?: string
          list_id?: string
          restaurant_id?: string
          voter_id?: string | null
          voter_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_list_votes_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shared_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_list_votes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_lists: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          share_code: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          share_code?: string
          title?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          share_code?: string
          title?: string
        }
        Relationships: []
      }
      sponsored_products: {
        Row: {
          base_price: number
          city_id: string
          created_at: string
          default_duration_days: number
          dish_id: string
          id: string
          is_active: boolean
          max_duration_days: number
          max_slots: number
          min_duration_days: number
          updated_at: string
        }
        Insert: {
          base_price?: number
          city_id: string
          created_at?: string
          default_duration_days?: number
          dish_id: string
          id?: string
          is_active?: boolean
          max_duration_days?: number
          max_slots?: number
          min_duration_days?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          city_id?: string
          created_at?: string
          default_duration_days?: number
          dish_id?: string
          id?: string
          is_active?: boolean
          max_duration_days?: number
          max_slots?: number
          min_duration_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_products_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_products_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsored_purchases: {
        Row: {
          created_at: string
          duration_days: number
          expires_at: string
          id: string
          is_active: boolean
          price_paid: number
          product_id: string
          purchased_by: string
          restaurant_id: string
          review_request_sent_at: string | null
          starts_at: string
          stripe_payment_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_days?: number
          expires_at: string
          id?: string
          is_active?: boolean
          price_paid: number
          product_id: string
          purchased_by: string
          restaurant_id: string
          review_request_sent_at?: string | null
          starts_at?: string
          stripe_payment_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_days?: number
          expires_at?: string
          id?: string
          is_active?: boolean
          price_paid?: number
          product_id?: string
          purchased_by?: string
          restaurant_id?: string
          review_request_sent_at?: string | null
          starts_at?: string
          stripe_payment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sponsored_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_purchases_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_conversations: {
        Row: {
          created_at: string
          escalated: boolean
          escalated_at: string | null
          id: string
          session_id: string | null
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          escalated?: boolean
          escalated_at?: string | null
          id?: string
          session_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          escalated?: boolean
          escalated_at?: string | null
          id?: string
          session_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          needs_human: boolean
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          needs_human?: boolean
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          needs_human?: boolean
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_confirmations: {
        Row: {
          created_at: string
          id: string
          is_confirmed: boolean
          restaurant_id: string
          tag: string
          tag_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_confirmed?: boolean
          restaurant_id: string
          tag: string
          tag_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_confirmed?: boolean
          restaurant_id?: string
          tag?: string
          tag_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_confirmations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_level: number | null
          badge_type: string
          created_at: string
          earned_at: string | null
          id: string
          progress: number | null
          target: number
          updated_at: string
          user_id: string
        }
        Insert: {
          badge_level?: number | null
          badge_type: string
          created_at?: string
          earned_at?: string | null
          id?: string
          progress?: number | null
          target: number
          updated_at?: string
          user_id: string
        }
        Update: {
          badge_level?: number | null
          badge_type?: string
          created_at?: string
          earned_at?: string | null
          id?: string
          progress?: number | null
          target?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_claim_limits: {
        Row: {
          active_unverified_claims: number
          blocked_reason: string | null
          blocked_until: string | null
          created_at: string
          id: string
          is_blocked: boolean
          last_claim_at: string | null
          total_claims_attempted: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_unverified_claims?: number
          blocked_reason?: string | null
          blocked_until?: string | null
          created_at?: string
          id?: string
          is_blocked?: boolean
          last_claim_at?: string | null
          total_claims_attempted?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_unverified_claims?: number
          blocked_reason?: string | null
          blocked_until?: string | null
          created_at?: string
          id?: string
          is_blocked?: boolean
          last_claim_at?: string | null
          total_claims_attempted?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_list_items: {
        Row: {
          added_at: string
          id: string
          list_id: string
          note: string | null
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          added_at?: string
          id?: string
          list_id: string
          note?: string | null
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          added_at?: string
          id?: string
          list_id?: string
          note?: string | null
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "user_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_list_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_lists: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          emoji: string | null
          id: string
          is_public: boolean
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          is_public?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          is_public?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_perks: {
        Row: {
          created_at: string
          discount_percent: number | null
          id: string
          is_redeemed: boolean | null
          perk_code: string | null
          perk_type: string
          redeemed_at: string | null
          user_id: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          discount_percent?: number | null
          id?: string
          is_redeemed?: boolean | null
          perk_code?: string | null
          perk_type: string
          redeemed_at?: string | null
          user_id: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          discount_percent?: number | null
          id?: string
          is_redeemed?: boolean | null
          perk_code?: string | null
          perk_type?: string
          redeemed_at?: string | null
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_perks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_perks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
      user_stats: {
        Row: {
          cities_visited: string[] | null
          created_at: string
          cuisines_tried: string[] | null
          favorite_cuisine: string | null
          favorite_price_level: number | null
          first_review_date: string | null
          id: string
          last_activity_date: string | null
          streak_days: number | null
          total_restaurants_visited: number | null
          total_reviews_written: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cities_visited?: string[] | null
          created_at?: string
          cuisines_tried?: string[] | null
          favorite_cuisine?: string | null
          favorite_price_level?: number | null
          first_review_date?: string | null
          id?: string
          last_activity_date?: string | null
          streak_days?: number | null
          total_restaurants_visited?: number | null
          total_reviews_written?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cities_visited?: string[] | null
          created_at?: string
          cuisines_tried?: string[] | null
          favorite_cuisine?: string | null
          favorite_price_level?: number | null
          first_review_date?: string | null
          id?: string
          last_activity_date?: string | null
          streak_days?: number | null
          total_restaurants_visited?: number | null
          total_reviews_written?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tag_preferences: {
        Row: {
          created_at: string
          id: string
          tag: string
          tag_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tag: string
          tag_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tag?: string
          tag_type?: string
          user_id?: string
        }
        Relationships: []
      }
      verification_credits: {
        Row: {
          amount: number
          claim_id: string
          created_at: string
          id: string
          is_redeemed: boolean
          redeemed_at: string | null
          redeemed_on_checkout: string | null
          restaurant_id: string
          stripe_payment_intent: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          claim_id: string
          created_at?: string
          id?: string
          is_redeemed?: boolean
          redeemed_at?: string | null
          redeemed_on_checkout?: string | null
          restaurant_id: string
          stripe_payment_intent?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          claim_id?: string
          created_at?: string
          id?: string
          is_redeemed?: boolean
          redeemed_at?: string | null
          redeemed_on_checkout?: string | null
          restaurant_id?: string
          stripe_payment_intent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_credits_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "restaurant_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_credits_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      yearly_wrapped: {
        Row: {
          cities_list: string[] | null
          cuisines_list: string[] | null
          foodie_personality: string | null
          generated_at: string
          id: string
          top_cuisine: string | null
          top_dish: string | null
          top_restaurant_id: string | null
          total_cuisines: number | null
          total_photos: number | null
          total_restaurants: number | null
          total_reviews: number | null
          user_id: string
          year: number
        }
        Insert: {
          cities_list?: string[] | null
          cuisines_list?: string[] | null
          foodie_personality?: string | null
          generated_at?: string
          id?: string
          top_cuisine?: string | null
          top_dish?: string | null
          top_restaurant_id?: string | null
          total_cuisines?: number | null
          total_photos?: number | null
          total_restaurants?: number | null
          total_reviews?: number | null
          user_id: string
          year: number
        }
        Update: {
          cities_list?: string[] | null
          cuisines_list?: string[] | null
          foodie_personality?: string | null
          generated_at?: string
          id?: string
          top_cuisine?: string | null
          top_dish?: string | null
          top_restaurant_id?: string | null
          total_cuisines?: number | null
          total_photos?: number | null
          total_restaurants?: number | null
          total_reviews?: number | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "yearly_wrapped_top_restaurant_id_fkey"
            columns: ["top_restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yearly_wrapped_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yearly_wrapped_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      featured_subscriptions_public: {
        Row: {
          consecutive_months: number | null
          created_at: string | null
          expires_at: string | null
          extra_ambiances: string[] | null
          id: string | null
          included_ambiance: string | null
          monthly_price: number | null
          restaurant_id: string | null
          slot_id: string | null
          starts_at: string | null
          status:
            | Database["public"]["Enums"]["featured_subscription_status"]
            | null
          total_clicks: number | null
          total_views: number | null
        }
        Insert: {
          consecutive_months?: number | null
          created_at?: string | null
          expires_at?: string | null
          extra_ambiances?: string[] | null
          id?: string | null
          included_ambiance?: string | null
          monthly_price?: number | null
          restaurant_id?: string | null
          slot_id?: string | null
          starts_at?: string | null
          status?:
            | Database["public"]["Enums"]["featured_subscription_status"]
            | null
          total_clicks?: number | null
          total_views?: number | null
        }
        Update: {
          consecutive_months?: number | null
          created_at?: string | null
          expires_at?: string | null
          extra_ambiances?: string[] | null
          id?: string | null
          included_ambiance?: string | null
          monthly_price?: number | null
          restaurant_id?: string | null
          slot_id?: string | null
          starts_at?: string | null
          status?:
            | Database["public"]["Enums"]["featured_subscription_status"]
            | null
          total_clicks?: number | null
          total_views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "featured_subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_subscriptions_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "featured_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          helpful_votes: number | null
          id: string | null
          name: string | null
          reviewer_level: string | null
          total_reviews: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          helpful_votes?: number | null
          id?: string | null
          name?: string | null
          reviewer_level?: string | null
          total_reviews?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          helpful_votes?: number | null
          id?: string | null
          name?: string | null
          reviewer_level?: string | null
          total_reviews?: number | null
        }
        Relationships: []
      }
      restaurant_dish_scores: {
        Row: {
          dish_id: string | null
          dish_name: string | null
          restaurant_id: string | null
          review_count: number | null
          simple_rating: number | null
          weighted_rating: number | null
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
      restaurant_tag_scores: {
        Row: {
          confidence_score: number | null
          confirmations: number | null
          disputes: number | null
          restaurant_id: string | null
          tag: string | null
          tag_type: string | null
          total_votes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tag_confirmations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsored_purchases_public: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string | null
          is_active: boolean | null
          product_id: string | null
          restaurant_id: string | null
          starts_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          product_id?: string | null
          restaurant_id?: string | null
          starts_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          product_id?: string | null
          restaurant_id?: string | null
          starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sponsored_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_purchases_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_apply_restaurant_categorization: {
        Args: { _data: Json }
        Returns: number
      }
      audit_and_fix_dish_classifications: { Args: never; Returns: Json }
      auto_enrich_dish_dietary_labels: { Args: never; Returns: Json }
      calculate_featured_market_price: {
        Args: { p_city_id: string; p_cuisine: string }
        Returns: Json
      }
      calculate_reviewer_level: {
        Args: { helpful_count: number; review_count: number }
        Returns: string
      }
      calculate_sponsored_price: {
        Args: { p_city_id: string; p_dish_id: string; p_duration_days?: number }
        Returns: number
      }
      can_create_claim: { Args: { _user_id: string }; Returns: boolean }
      check_and_log_rate_limit: {
        Args: {
          p_function: string
          p_identifier: string
          p_max: number
          p_window_seconds: number
        }
        Returns: Json
      }
      cleanup_discovery_duplicates: { Args: { p_rules?: Json }; Returns: Json }
      cleanup_rate_limit_log: { Args: never; Returns: number }
      clear_expired_verification_codes: { Args: never; Returns: undefined }
      create_biweekly_newsletter_draft: { Args: never; Returns: string }
      deduplicate_dishes: { Args: never; Returns: Json }
      deduplicate_restaurant_dishes: { Args: never; Returns: Json }
      generate_amsterdam_grid: { Args: never; Returns: number }
      generate_city_grid: {
        Args: {
          _center_lat: number
          _center_lng: number
          _city_id: string
          _city_name: string
          _cols: number
          _radius_meters?: number
          _rows: number
          _spacing_km?: number
        }
        Returns: number
      }
      get_available_slots: { Args: { p_product_id: string }; Returns: number }
      get_featured_active_count: {
        Args: { p_slot_id: string }
        Returns: number
      }
      get_guest_cohorts: {
        Args: { p_restaurant_id: string; p_weeks?: number }
        Returns: {
          new_visitors: number
          returning_visitors: number
          week_start: string
        }[]
      }
      get_owner_attribution: {
        Args: { p_days?: number; p_restaurant_id: string }
        Returns: {
          channel: string
          clicks: number
          conversions: number
          views: number
        }[]
      }
      get_owner_funnel: {
        Args: { p_days?: number; p_restaurant_id: string }
        Returns: {
          clicks: number
          conversions: number
          views: number
        }[]
      }
      get_owner_funnel_anomalies: {
        Args: { p_restaurant_id: string }
        Returns: {
          current_value: number
          delta_pct: number
          metric: string
          previous_value: number
          severity: string
        }[]
      }
      get_owner_historical_benchmark: {
        Args: { p_days?: number; p_restaurant_id: string }
        Returns: {
          current_clicks: number
          current_conversions: number
          current_views: number
          previous_clicks: number
          previous_conversions: number
          previous_views: number
        }[]
      }
      get_search_term_heatmap: {
        Args: { p_days?: number; p_limit?: number; p_restaurant_id: string }
        Returns: {
          hits: number
          search_term: string
        }[]
      }
      get_trending_dishes: {
        Args: { dish_limit?: number }
        Returns: {
          id: string
          name: string
          restaurant_count: number
          search_count: number
          seasonal_tags: string[]
          slug: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_waitlist_position: {
        Args: { p_restaurant_id: string; p_slot_id: string }
        Returns: number
      }
      has_restaurant_access: {
        Args: {
          _min_role?: Database["public"]["Enums"]["manager_role"]
          _restaurant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_in_cooling_off: {
        Args: { p_restaurant_id: string; p_slot_id: string }
        Returns: boolean
      }
      is_moderator_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_owner_pro: { Args: { _user_id: string }; Returns: boolean }
      is_primary_owner: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      is_verified_owner: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      rescan_discovery_duplicates: { Args: { p_rules?: Json }; Returns: Json }
      search_dishes_by_term: {
        Args: { search_term: string }
        Returns: {
          canonical_slug: string | null
          course: string | null
          created_at: string
          cuisine_tags: string[] | null
          id: string
          is_active: boolean
          is_gluten_free: boolean
          is_halal: boolean
          is_vegan: boolean
          is_vegetarian: boolean
          name: string
          name_en: string | null
          search_count: number
          seasonal_tags: string[] | null
          slug: string
          synonyms: string[] | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "dishes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_owner_pro_restaurants: {
        Args: { _user_id: string }
        Returns: undefined
      }
      update_user_badges: { Args: { p_user_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "user" | "owner" | "admin" | "moderator"
      dish_source:
        | "cuisine_rules"
        | "website_hints"
        | "user_review"
        | "admin"
        | "owner"
      dish_status:
        | "suggested"
        | "approved_by_admin"
        | "verified_by_owner"
        | "rejected"
      featured_subscription_status:
        | "active"
        | "pending_payment"
        | "cooling_off"
        | "expired"
        | "cancelled"
      manager_role: "viewer" | "editor" | "finance" | "primary_owner"
      price_level: "1" | "2" | "3" | "4"
      restaurant_claim_status:
        | "unclaimed"
        | "claimed_unverified"
        | "verified_owner"
        | "disputed"
        | "locked"
      review_status: "published" | "pending" | "flagged"
      verification_method:
        | "micro_payment"
        | "dns_txt"
        | "html_file"
        | "google_business"
        | "domain_email"
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
      app_role: ["user", "owner", "admin", "moderator"],
      dish_source: [
        "cuisine_rules",
        "website_hints",
        "user_review",
        "admin",
        "owner",
      ],
      dish_status: [
        "suggested",
        "approved_by_admin",
        "verified_by_owner",
        "rejected",
      ],
      featured_subscription_status: [
        "active",
        "pending_payment",
        "cooling_off",
        "expired",
        "cancelled",
      ],
      manager_role: ["viewer", "editor", "finance", "primary_owner"],
      price_level: ["1", "2", "3", "4"],
      restaurant_claim_status: [
        "unclaimed",
        "claimed_unverified",
        "verified_owner",
        "disputed",
        "locked",
      ],
      review_status: ["published", "pending", "flagged"],
      verification_method: [
        "micro_payment",
        "dns_txt",
        "html_file",
        "google_business",
        "domain_email",
      ],
    },
  },
} as const
