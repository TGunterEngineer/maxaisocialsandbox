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
      a2p_registrations: {
        Row: {
          approved_at: string | null
          business_address: string | null
          business_city: string | null
          business_country: string | null
          business_email: string | null
          business_industry: string | null
          business_phone: string | null
          business_postal_code: string | null
          business_state: string | null
          business_type: string | null
          business_website: string | null
          campaign_description: string | null
          campaign_use_case: string | null
          created_at: string
          ein: string | null
          help_keywords: string | null
          help_message: string | null
          id: string
          legal_business_name: string | null
          message_sample_1: string | null
          message_sample_2: string | null
          notes: string | null
          opt_in_keywords: string | null
          opt_in_method: string | null
          opt_out_keywords: string | null
          organization_id: string
          rejection_reason: string | null
          rep_email: string | null
          rep_first_name: string | null
          rep_last_name: string | null
          rep_phone: string | null
          rep_title: string | null
          status: string
          submitted_at: string | null
          twilio_brand_sid: string | null
          twilio_campaign_sid: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          business_address?: string | null
          business_city?: string | null
          business_country?: string | null
          business_email?: string | null
          business_industry?: string | null
          business_phone?: string | null
          business_postal_code?: string | null
          business_state?: string | null
          business_type?: string | null
          business_website?: string | null
          campaign_description?: string | null
          campaign_use_case?: string | null
          created_at?: string
          ein?: string | null
          help_keywords?: string | null
          help_message?: string | null
          id?: string
          legal_business_name?: string | null
          message_sample_1?: string | null
          message_sample_2?: string | null
          notes?: string | null
          opt_in_keywords?: string | null
          opt_in_method?: string | null
          opt_out_keywords?: string | null
          organization_id: string
          rejection_reason?: string | null
          rep_email?: string | null
          rep_first_name?: string | null
          rep_last_name?: string | null
          rep_phone?: string | null
          rep_title?: string | null
          status?: string
          submitted_at?: string | null
          twilio_brand_sid?: string | null
          twilio_campaign_sid?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          business_address?: string | null
          business_city?: string | null
          business_country?: string | null
          business_email?: string | null
          business_industry?: string | null
          business_phone?: string | null
          business_postal_code?: string | null
          business_state?: string | null
          business_type?: string | null
          business_website?: string | null
          campaign_description?: string | null
          campaign_use_case?: string | null
          created_at?: string
          ein?: string | null
          help_keywords?: string | null
          help_message?: string | null
          id?: string
          legal_business_name?: string | null
          message_sample_1?: string | null
          message_sample_2?: string | null
          notes?: string | null
          opt_in_keywords?: string | null
          opt_in_method?: string | null
          opt_out_keywords?: string | null
          organization_id?: string
          rejection_reason?: string | null
          rep_email?: string | null
          rep_first_name?: string | null
          rep_last_name?: string | null
          rep_phone?: string | null
          rep_title?: string | null
          status?: string
          submitted_at?: string | null
          twilio_brand_sid?: string | null
          twilio_campaign_sid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "a2p_registrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_locations: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          location_id: string
          organization_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          location_id: string
          organization_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          location_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_locations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          contact_id: string
          created_at: string
          id: string
          location_id: string | null
          organization_id: string
          phone: string | null
          rating: number | null
          rating_submitted_at: string | null
          rating_token: string
          routed_to: string | null
          send_status: string
          sent_at: string | null
        }
        Insert: {
          campaign_id: string
          contact_id: string
          created_at?: string
          id?: string
          location_id?: string | null
          organization_id: string
          phone?: string | null
          rating?: number | null
          rating_submitted_at?: string | null
          rating_token?: string
          routed_to?: string | null
          send_status?: string
          sent_at?: string | null
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          location_id?: string | null
          organization_id?: string
          phone?: string | null
          rating?: number | null
          rating_submitted_at?: string | null
          rating_token?: string
          routed_to?: string | null
          send_status?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          channel: string
          created_at: string
          created_by: string
          google_review_url: string | null
          id: string
          message_body: string
          name: string
          organization_id: string
          scheduled_at: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          created_by: string
          google_review_url?: string | null
          id?: string
          message_body: string
          name: string
          organization_id: string
          scheduled_at: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string
          google_review_url?: string | null
          id?: string
          message_body?: string
          name?: string
          organization_id?: string
          scheduled_at?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          email: string
          id: string
          location_id: string | null
          name: string
          organization_id: string
          phone: string | null
          sms_opt_in: boolean
          sms_opted_in_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          location_id?: string | null
          name: string
          organization_id: string
          phone?: string | null
          sms_opt_in?: boolean
          sms_opted_in_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          location_id?: string | null
          name?: string
          organization_id?: string
          phone?: string | null
          sms_opt_in?: boolean
          sms_opted_in_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          level: string
          message: string
          organization_id: string | null
          source: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          level?: string
          message: string
          organization_id?: string | null
          source: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          level?: string
          message?: string
          organization_id?: string | null
          source?: string
        }
        Relationships: []
      }
      feedback_responses: {
        Row: {
          campaign_recipient_id: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string
          feedback: string
          id: string
          organization_id: string
          rating: number
        }
        Insert: {
          campaign_recipient_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          feedback: string
          id?: string
          organization_id: string
          rating: number
        }
        Update: {
          campaign_recipient_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          feedback?: string
          id?: string
          organization_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "feedback_responses_campaign_recipient_id_fkey"
            columns: ["campaign_recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_responses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_slots: {
        Row: {
          claimed_at: string
          organization_id: string
          slot_number: number
          user_id: string
        }
        Insert: {
          claimed_at?: string
          organization_id: string
          slot_number: number
          user_id: string
        }
        Update: {
          claimed_at?: string
          organization_id?: string
          slot_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_slots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          google_review_url: string | null
          id: string
          is_primary: boolean
          last_synced_at: string | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          google_review_url?: string | null
          id?: string
          is_primary?: boolean
          last_synced_at?: string | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          google_review_url?: string | null
          id?: string
          is_primary?: boolean
          last_synced_at?: string | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_refresh_log: {
        Row: {
          created_at: string
          id: string
          location_id: string | null
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id?: string | null
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string | null
          organization_id?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          metadata: Json | null
          organization_id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          metadata?: Json | null
          organization_id: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          metadata?: Json | null
          organization_id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          alert_phone: string | null
          created_at: string
          email_footer_text: string | null
          email_from_name: string | null
          id: string
          is_premium_plus: boolean
          logo_url: string | null
          name: string
          plan_status: string | null
          plan_tier: string | null
          primary_color: string | null
          review_gating_enabled: boolean
          sms_bonus_credits: number
          support_email: string | null
          updated_at: string
        }
        Insert: {
          alert_phone?: string | null
          created_at?: string
          email_footer_text?: string | null
          email_from_name?: string | null
          id?: string
          is_premium_plus?: boolean
          logo_url?: string | null
          name: string
          plan_status?: string | null
          plan_tier?: string | null
          primary_color?: string | null
          review_gating_enabled?: boolean
          sms_bonus_credits?: number
          support_email?: string | null
          updated_at?: string
        }
        Update: {
          alert_phone?: string | null
          created_at?: string
          email_footer_text?: string | null
          email_from_name?: string | null
          id?: string
          is_premium_plus?: boolean
          logo_url?: string | null
          name?: string
          plan_status?: string | null
          plan_tier?: string | null
          primary_color?: string | null
          review_gating_enabled?: boolean
          sms_bonus_credits?: number
          support_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pending_admin_alerts: {
        Row: {
          created_at: string
          dispatch_channel: string | null
          dispatch_error: string | null
          id: string
          kind: string
          organization_id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          dispatch_channel?: string | null
          dispatch_error?: string | null
          id?: string
          kind: string
          organization_id: string
          payload?: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          dispatch_channel?: string | null
          dispatch_error?: string | null
          id?: string
          kind?: string
          organization_id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      public_rate_limits: {
        Row: {
          bucket: string
          created_at: string
          id: number
          identifier: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: number
          identifier: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: number
          identifier?: string
        }
        Relationships: []
      }
      review_ingest_keys: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_ingest_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_avatar_url: string | null
          author_name: string
          created_at: string
          external_id: string | null
          id: string
          location_id: string | null
          organization_id: string
          rating: number | null
          raw_payload: Json | null
          replied_at: string | null
          reply_text: string | null
          review_date: string
          review_url: string | null
          sentiment: string | null
          source: string
          text: string | null
          updated_at: string
        }
        Insert: {
          author_avatar_url?: string | null
          author_name: string
          created_at?: string
          external_id?: string | null
          id?: string
          location_id?: string | null
          organization_id: string
          rating?: number | null
          raw_payload?: Json | null
          replied_at?: string | null
          reply_text?: string | null
          review_date?: string
          review_url?: string | null
          sentiment?: string | null
          source: string
          text?: string | null
          updated_at?: string
        }
        Update: {
          author_avatar_url?: string | null
          author_name?: string
          created_at?: string
          external_id?: string | null
          id?: string
          location_id?: string | null
          organization_id?: string
          rating?: number | null
          raw_payload?: Json | null
          replied_at?: string | null
          reply_text?: string | null
          review_date?: string
          review_url?: string | null
          sentiment?: string | null
          source?: string
          text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_send_log: {
        Row: {
          campaign_recipient_id: string | null
          created_at: string
          error_message: string | null
          id: string
          message_sid: string | null
          metadata: Json | null
          organization_id: string | null
          recipient_phone: string
          status: string
        }
        Insert: {
          campaign_recipient_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_sid?: string | null
          metadata?: Json | null
          organization_id?: string | null
          recipient_phone: string
          status: string
        }
        Update: {
          campaign_recipient_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_sid?: string | null
          metadata?: Json | null
          organization_id?: string | null
          recipient_phone?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_send_log_campaign_recipient_id_fkey"
            columns: ["campaign_recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_send_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_suppressions: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          phone: string
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          phone: string
          reason?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          phone?: string
          reason?: string
        }
        Relationships: []
      }
      sms_topups: {
        Row: {
          amount_cents: number | null
          created_at: string
          created_by: string | null
          credits: number
          currency: string | null
          environment: string | null
          id: string
          organization_id: string
          stripe_session_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          created_by?: string | null
          credits: number
          currency?: string | null
          environment?: string | null
          id?: string
          organization_id: string
          stripe_session_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          created_by?: string | null
          credits?: number
          currency?: string | null
          environment?: string | null
          id?: string
          organization_id?: string
          stripe_session_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          environment: string
          founder_slot_number: number | null
          id: string
          organization_id: string
          plan_tier: string | null
          price_id: string | null
          product_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          environment?: string
          founder_slot_number?: number | null
          id?: string
          organization_id: string
          plan_tier?: string | null
          price_id?: string | null
          product_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          environment?: string
          founder_slot_number?: number | null
          id?: string
          organization_id?: string
          plan_tier?: string | null
          price_id?: string | null
          product_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      team_invitation_tokens: {
        Row: {
          created_at: string
          invitation_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          invitation_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          invitation_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitation_tokens_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: true
            referencedRelation: "team_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          location_ids: string[]
          organization_id: string
          role: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          location_ids?: string[]
          organization_id: string
          role: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          location_ids?: string[]
          organization_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_location_access: {
        Row: {
          created_at: string
          id: string
          location_id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_location_access_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_location_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_organizations: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          endpoint_id: string
          event_type: string
          id: string
          last_error: string | null
          last_response_body: string | null
          last_response_status: number | null
          max_attempts: number
          next_attempt_at: string
          organization_id: string
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          endpoint_id: string
          event_type: string
          id?: string
          last_error?: string | null
          last_response_body?: string | null
          last_response_status?: number | null
          max_attempts?: number
          next_attempt_at?: string
          organization_id: string
          payload: Json
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          endpoint_id?: string
          event_type?: string
          id?: string
          last_error?: string | null
          last_response_body?: string | null
          last_response_status?: number | null
          max_attempts?: number
          next_attempt_at?: string
          organization_id?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoint_secrets: {
        Row: {
          created_at: string
          endpoint_id: string
          secret: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          endpoint_id: string
          secret: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          endpoint_id?: string
          secret?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoint_secrets_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: true
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string
          created_by: string
          event_type: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_type?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_type?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: Json }
      can_access_location: {
        Args: { _location_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_realtime_topic: { Args: { _topic: string }; Returns: boolean }
      can_manage_team: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      can_send_sms: { Args: { _org_id: string }; Returns: Json }
      can_write_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      check_manual_refresh_quota: { Args: { _org_id: string }; Returns: Json }
      check_rate_limit: {
        Args: {
          _bucket: string
          _identifier: string
          _max_attempts: number
          _window_minutes: number
        }
        Returns: boolean
      }
      claim_founder_slot: {
        Args: { _org_id: string; _user_id: string }
        Returns: number
      }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      consume_manual_refresh: {
        Args: { _location_id: string; _org_id: string; _user_id: string }
        Returns: Json
      }
      count_sms_this_month: { Args: { _org_id: string }; Returns: number }
      create_organization: {
        Args: { _name: string; _primary_color?: string }
        Returns: string
      }
      create_review_ingest_key: {
        Args: { _name: string; _org_id: string }
        Returns: {
          created_at: string
          id: string
          key: string
          key_prefix: string
          name: string
        }[]
      }
      create_webhook_endpoint: {
        Args: {
          _event_type?: string
          _name: string
          _org_id: string
          _url: string
        }
        Returns: {
          created_at: string
          event_type: string
          id: string
          is_active: boolean
          name: string
          signing_secret: string
          updated_at: string
          url: string
        }[]
      }
      credit_sms_topup: {
        Args: {
          _amount_cents?: number
          _created_by?: string
          _credits: number
          _currency?: string
          _environment?: string
          _org_id: string
          _stripe_session_id: string
        }
        Returns: number
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_organization: { Args: { _org_id: string }; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      enqueue_webhook_event: {
        Args: { _event_type: string; _organization_id: string; _payload: Json }
        Returns: number
      }
      get_founder_slots_remaining: { Args: never; Returns: number }
      get_invitation_by_token: {
        Args: { _token: string }
        Returns: {
          accepted: boolean
          email: string
          expired: boolean
          invitation_id: string
          organization_id: string
          organization_logo_url: string
          organization_name: string
          role: string
        }[]
      }
      get_manual_refresh_limit: { Args: { _plan: string }; Returns: number }
      get_org_analytics_summary: { Args: { _org_id: string }; Returns: Json }
      get_org_plan_tier: { Args: { _org_id: string }; Returns: string }
      get_org_role: {
        Args: { _org_id: string; _user_id: string }
        Returns: string
      }
      get_org_subscription_summary: {
        Args: { _org_id: string }
        Returns: {
          cancel_at_period_end: boolean
          current_period_end: string
          environment: string
          founder_slot_number: number
          id: string
          plan_tier: string
          price_id: string
          status: string
          updated_at: string
        }[]
      }
      get_org_usage: { Args: { _org_id: string }; Returns: Json }
      get_plan_limit: {
        Args: { _plan: string; _resource: string }
        Returns: number
      }
      get_rating_context: {
        Args: { _token: string }
        Returns: {
          already_submitted: boolean
          campaign_id: string
          contact_name: string
          google_review_url: string
          location_name: string
          organization_id: string
          organization_logo_url: string
          organization_name: string
          organization_primary_color: string
          recipient_id: string
        }[]
      }
      has_active_subscription: { Args: { _org_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_sms_suppressed: { Args: { _phone: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      issue_team_invitation_token: {
        Args: { _invitation_id: string }
        Returns: string
      }
      list_founder_slots_admin: {
        Args: never
        Returns: {
          cancel_at_period_end: boolean
          claimed_at: string
          current_period_end: string
          environment: string
          organization_id: string
          organization_name: string
          slot_number: number
          subscription_status: string
          user_email: string
          user_id: string
        }[]
      }
      list_webhook_endpoints: {
        Args: { _org_id: string }
        Returns: {
          created_at: string
          event_type: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          url: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      org_has_elite_features: { Args: { _org_id: string }; Returns: boolean }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      retry_webhook_delivery: {
        Args: { _delivery_id: string }
        Returns: undefined
      }
      rotate_webhook_secret: { Args: { _endpoint_id: string }; Returns: string }
      submit_review_rating: {
        Args: { _feedback?: string; _rating: number; _token: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "member" | "super_admin"
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
      app_role: ["admin", "member", "super_admin"],
    },
  },
} as const
