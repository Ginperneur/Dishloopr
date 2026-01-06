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
          search_count?: number
          seasonal_tags?: string[] | null
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
          price: number
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
          price: number
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
          price?: number
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
      restaurants: {
        Row: {
          accepts_routed_demand: boolean | null
          address: string
          ambience_tags: string[] | null
          city_id: string
          claimed_by_owner_id: string | null
          concepts: string[] | null
          created_at: string
          cuisines: string[] | null
          current_busy_level: string | null
          experiences: string[] | null
          featured_until: string | null
          geo_lat: number | null
          geo_lng: number | null
          id: string
          images: string[] | null
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
          top_until: string | null
          updated_at: string
          website_url: string | null
          zenchef_id: string | null
        }
        Insert: {
          accepts_routed_demand?: boolean | null
          address: string
          ambience_tags?: string[] | null
          city_id: string
          claimed_by_owner_id?: string | null
          concepts?: string[] | null
          created_at?: string
          cuisines?: string[] | null
          current_busy_level?: string | null
          experiences?: string[] | null
          featured_until?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          images?: string[] | null
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
          top_until?: string | null
          updated_at?: string
          website_url?: string | null
          zenchef_id?: string | null
        }
        Update: {
          accepts_routed_demand?: boolean | null
          address?: string
          ambience_tags?: string[] | null
          city_id?: string
          claimed_by_owner_id?: string | null
          concepts?: string[] | null
          created_at?: string
          cuisines?: string[] | null
          current_busy_level?: string | null
          experiences?: string[] | null
          featured_until?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          images?: string[] | null
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
          top_until?: string | null
          updated_at?: string
          website_url?: string | null
          zenchef_id?: string | null
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
      calculate_reviewer_level: {
        Args: { helpful_count: number; review_count: number }
        Returns: string
      }
      calculate_sponsored_price: {
        Args: { p_city_id: string; p_dish_id: string; p_duration_days?: number }
        Returns: number
      }
      get_available_slots: { Args: { p_product_id: string }; Returns: number }
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
      update_user_badges: { Args: { p_user_id: string }; Returns: undefined }
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
