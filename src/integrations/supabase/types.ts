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
          dish_id: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number | null
          subtitle: string | null
          title: string
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
          dish_id?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number | null
          subtitle?: string | null
          title: string
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
          dish_id?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number | null
          subtitle?: string | null
          title?: string
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
          created_at: string
          cuisine_tags: string[] | null
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          search_count: number
          seasonal_tags: string[] | null
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
          name_en?: string | null
          search_count?: number
          seasonal_tags?: string[] | null
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
          status: string
          stripe_payment_id: string | null
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
          status?: string
          stripe_payment_id?: string | null
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
          status?: string
          stripe_payment_id?: string | null
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
      restaurants: {
        Row: {
          accepts_routed_demand: boolean | null
          address: string
          ambience_tags: string[] | null
          chain_id: string | null
          city_id: string
          claim_status: Database["public"]["Enums"]["restaurant_claim_status"]
          claimed_by_owner_id: string | null
          concepts: string[] | null
          created_at: string
          cuisines: string[] | null
          current_busy_level: string | null
          dietary_options: string[] | null
          experiences: string[] | null
          featured_until: string | null
          geo_lat: number | null
          geo_lng: number | null
          has_terrace: boolean
          id: string
          images: string[] | null
          instagram_url: string | null
          is_active: boolean
          is_featured: boolean
          is_top_listing: boolean
          meal_types: string[] | null
          name: string
          opening_hours: Json | null
          phone: string | null
          postal_code: string | null
          price_level: number
          rating: number
          reservation_url: string | null
          review_count: number
          routed_demand_dishes: string[] | null
          slug: string
          sustainability_score: number | null
          tiktok_url: string | null
          top_until: string | null
          updated_at: string
          website_url: string | null
          zenchef_id: string | null
        }
        Insert: {
          accepts_routed_demand?: boolean | null
          address: string
          ambience_tags?: string[] | null
          chain_id?: string | null
          city_id: string
          claim_status?: Database["public"]["Enums"]["restaurant_claim_status"]
          claimed_by_owner_id?: string | null
          concepts?: string[] | null
          created_at?: string
          cuisines?: string[] | null
          current_busy_level?: string | null
          dietary_options?: string[] | null
          experiences?: string[] | null
          featured_until?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          has_terrace?: boolean
          id?: string
          images?: string[] | null
          instagram_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          is_top_listing?: boolean
          meal_types?: string[] | null
          name: string
          opening_hours?: Json | null
          phone?: string | null
          postal_code?: string | null
          price_level?: number
          rating?: number
          reservation_url?: string | null
          review_count?: number
          routed_demand_dishes?: string[] | null
          slug: string
          sustainability_score?: number | null
          tiktok_url?: string | null
          top_until?: string | null
          updated_at?: string
          website_url?: string | null
          zenchef_id?: string | null
        }
        Update: {
          accepts_routed_demand?: boolean | null
          address?: string
          ambience_tags?: string[] | null
          chain_id?: string | null
          city_id?: string
          claim_status?: Database["public"]["Enums"]["restaurant_claim_status"]
          claimed_by_owner_id?: string | null
          concepts?: string[] | null
          created_at?: string
          cuisines?: string[] | null
          current_busy_level?: string | null
          dietary_options?: string[] | null
          experiences?: string[] | null
          featured_until?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          has_terrace?: boolean
          id?: string
          images?: string[] | null
          instagram_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          is_top_listing?: boolean
          meal_types?: string[] | null
          name?: string
          opening_hours?: Json | null
          phone?: string | null
          postal_code?: string | null
          price_level?: number
          rating?: number
          reservation_url?: string | null
          review_count?: number
          routed_demand_dishes?: string[] | null
          slug?: string
          sustainability_score?: number | null
          tiktok_url?: string | null
          top_until?: string | null
          updated_at?: string
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
    }
    Functions: {
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
      get_available_slots: { Args: { p_product_id: string }; Returns: number }
      get_featured_active_count: {
        Args: { p_slot_id: string }
        Returns: number
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
      is_primary_owner: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      is_verified_owner: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      update_user_badges: { Args: { p_user_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "user" | "owner" | "admin"
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
      app_role: ["user", "owner", "admin"],
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
