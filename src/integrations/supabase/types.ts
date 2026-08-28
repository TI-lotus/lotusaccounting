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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string | null
          company_id: string | null
          created_at: string | null
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          company_id?: string | null
          created_at?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          company_id?: string | null
          created_at?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_payload: Json
          action_type: string
          conditions: Json
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          name: string
          tenant_id: string
          trigger_event_type: string
          updated_at: string
        }
        Insert: {
          action_payload?: Json
          action_type: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          name: string
          tenant_id: string
          trigger_event_type: string
          updated_at?: string
        }
        Update: {
          action_payload?: Json
          action_type?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          name?: string
          tenant_id?: string
          trigger_event_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          created_at: string
          domain_event_id: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          result: Json
          rule_id: string | null
          started_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          domain_event_id?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          result?: Json
          rule_id?: string | null
          started_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          domain_event_id?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          result?: Json
          rule_id?: string | null
          started_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_domain_event_id_fkey"
            columns: ["domain_event_id"]
            isOneToOne: false
            referencedRelation: "domain_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          city: string | null
          cnpj: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          responsible_user_id: string | null
          responsible_user_name: string | null
          service_fee: number | null
          state: string | null
          status: string | null
          tax_regime: string | null
          tenant_id: string | null
        }
        Insert: {
          city?: string | null
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          responsible_user_id?: string | null
          responsible_user_name?: string | null
          service_fee?: number | null
          state?: string | null
          status?: string | null
          tax_regime?: string | null
          tenant_id?: string | null
        }
        Update: {
          city?: string | null
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          responsible_user_id?: string | null
          responsible_user_name?: string | null
          service_fee?: number | null
          state?: string | null
          status?: string | null
          tax_regime?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          billing_cycle: string | null
          company_id: string | null
          created_at: string | null
          id: string
          monthly_fee: number | null
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          billing_cycle?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          monthly_fee?: number | null
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          billing_cycle?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          monthly_fee?: number | null
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          channel: string | null
          company_id: string | null
          created_at: string | null
          id: string
          tenant_id: string | null
          title: string | null
        }
        Insert: {
          channel?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          tenant_id?: string | null
          title?: string | null
        }
        Update: {
          channel?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          tenant_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          amount: number | null
          classification_confidence: number | null
          classified_automatically: boolean | null
          company_id: string | null
          created_at: string | null
          doc_date: string | null
          document_type: string | null
          file_path: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          month: number | null
          name: string | null
          original_file_name: string | null
          read_at: string | null
          status: string | null
          tenant_id: string | null
          uploaded_by: string | null
          year: number | null
        }
        Insert: {
          amount?: number | null
          classification_confidence?: number | null
          classified_automatically?: boolean | null
          company_id?: string | null
          created_at?: string | null
          doc_date?: string | null
          document_type?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          month?: number | null
          name?: string | null
          original_file_name?: string | null
          read_at?: string | null
          status?: string | null
          tenant_id?: string | null
          uploaded_by?: string | null
          year?: number | null
        }
        Update: {
          amount?: number | null
          classification_confidence?: number | null
          classified_automatically?: boolean | null
          company_id?: string | null
          created_at?: string | null
          doc_date?: string | null
          document_type?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          month?: number | null
          name?: string | null
          original_file_name?: string | null
          read_at?: string | null
          status?: string | null
          tenant_id?: string | null
          uploaded_by?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_events: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          id: string
          payload: Json | null
          tenant_id: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          payload?: Json | null
          tenant_id?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          payload?: Json | null
          tenant_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_obligations: {
        Row: {
          company_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          document_id: string | null
          due_date: string
          id: string
          name: string
          payment_id: string | null
          period_month: number | null
          period_year: number | null
          priority: string
          recurrence: string
          status: string
          task_id: string | null
          tax_regime: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_id?: string | null
          due_date: string
          id?: string
          name: string
          payment_id?: string | null
          period_month?: number | null
          period_year?: number | null
          priority?: string
          recurrence?: string
          status?: string
          task_id?: string | null
          tax_regime?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_id?: string | null
          due_date?: string
          id?: string
          name?: string
          payment_id?: string | null
          period_month?: number | null
          period_year?: number | null
          priority?: string
          recurrence?: string
          status?: string
          task_id?: string | null
          tax_regime?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_obligations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_obligations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_obligations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_obligations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_obligations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          account_label: string | null
          config: Json
          connected_at: string | null
          created_at: string
          created_by: string | null
          credential_reference: string | null
          credentials: Json
          expires_at: string | null
          id: string
          integration_id: string
          last_error_at: string | null
          last_sync_at: string | null
          metadata: Json
          provider: string
          provider_account_id: string | null
          provider_account_name: string | null
          scopes: string[]
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          usage: Json
        }
        Insert: {
          account_label?: string | null
          config?: Json
          connected_at?: string | null
          created_at?: string
          created_by?: string | null
          credential_reference?: string | null
          credentials?: Json
          expires_at?: string | null
          id?: string
          integration_id: string
          last_error_at?: string | null
          last_sync_at?: string | null
          metadata?: Json
          provider: string
          provider_account_id?: string | null
          provider_account_name?: string | null
          scopes?: string[]
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          usage?: Json
        }
        Update: {
          account_label?: string | null
          config?: Json
          connected_at?: string | null
          created_at?: string
          created_by?: string | null
          credential_reference?: string | null
          credentials?: Json
          expires_at?: string | null
          id?: string
          integration_id?: string
          last_error_at?: string | null
          last_sync_at?: string | null
          metadata?: Json
          provider?: string
          provider_account_id?: string | null
          provider_account_name?: string | null
          scopes?: string[]
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          usage?: Json
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          connection_id: string
          created_at: string
          expires_at: string | null
          id: string
          provider: string
          rotated_at: string | null
          secret_payload: Json
          secret_type: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          provider: string
          rotated_at?: string | null
          secret_payload: Json
          secret_type: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          provider?: string
          rotated_at?: string | null
          secret_payload?: Json
          secret_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_credentials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_errors: {
        Row: {
          attempt_number: number
          connection_id: string | null
          context: Json
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          operation: string
          provider: string
          resolved: boolean
          resolved_at: string | null
          retryable: boolean
          source: string
          tenant_id: string
        }
        Insert: {
          attempt_number?: number
          connection_id?: string | null
          context?: Json
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          operation: string
          provider: string
          resolved?: boolean
          resolved_at?: string | null
          retryable?: boolean
          source: string
          tenant_id: string
        }
        Update: {
          attempt_number?: number
          connection_id?: string | null
          context?: Json
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          operation?: string
          provider?: string
          resolved?: boolean
          resolved_at?: string | null
          retryable?: boolean
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_errors_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_errors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_events: {
        Row: {
          attempt_count: number
          connection_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error_code: string | null
          error_message: string | null
          event_type: string
          external_event_id: string | null
          id: string
          normalized_payload: Json
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          connection_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_code?: string | null
          error_message?: string | null
          event_type: string
          external_event_id?: string | null
          id?: string
          normalized_payload?: Json
          payload?: Json
          processed_at?: string | null
          provider: string
          received_at?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          connection_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_code?: string | null
          error_message?: string | null
          event_type?: string
          external_event_id?: string | null
          id?: string
          normalized_payload?: Json
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_events_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_jobs: {
        Row: {
          attempt_count: number
          completed_at: string | null
          connection_id: string | null
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
          scheduled_for: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          connection_id?: string | null
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          scheduled_for?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          connection_id?: string | null
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          scheduled_for?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_jobs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_runs: {
        Row: {
          connection_id: string | null
          created_at: string
          cursor: string | null
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          items_failed: number
          items_processed: number
          items_received: number
          metadata: Json
          provider: string
          started_at: string | null
          status: string
          sync_type: string
          tenant_id: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          cursor?: string | null
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          items_failed?: number
          items_processed?: number
          items_received?: number
          metadata?: Json
          provider: string
          started_at?: string | null
          status?: string
          sync_type: string
          tenant_id: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          cursor?: string | null
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          items_failed?: number
          items_processed?: number
          items_received?: number
          metadata?: Json
          provider?: string
          started_at?: string | null
          status?: string
          sync_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_runs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_sync_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_webhook_events: {
        Row: {
          attempt_count: number
          connection_id: string | null
          created_at: string
          external_event_id: string | null
          headers: Json
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
          signature_valid: boolean
          status: string
          tenant_id: string | null
        }
        Insert: {
          attempt_count?: number
          connection_id?: string | null
          created_at?: string
          external_event_id?: string | null
          headers?: Json
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          provider: string
          received_at?: string
          signature_valid?: boolean
          status?: string
          tenant_id?: string | null
        }
        Update: {
          attempt_count?: number
          connection_id?: string | null
          created_at?: string
          external_event_id?: string | null
          headers?: Json
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          signature_valid?: boolean
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_webhook_events_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_webhook_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          account_type: string
          company_id: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string | null
          id: string
          invited_by: string | null
          status: string
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          account_type: string
          company_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          status?: string
          tenant_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          account_type?: string
          company_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          status?: string
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string | null
          due_date: string | null
          id: string
          issued_at: string | null
          number: string | null
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          amount: number
          company_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          issued_at?: string | null
          number?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          issued_at?: string | null
          number?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          company_id: string | null
          conversation_id: string | null
          created_at: string | null
          id: string
          message: string | null
          sender_id: string | null
          tenant_id: string | null
        }
        Insert: {
          company_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          sender_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          company_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          sender_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          category: string | null
          company_id: string | null
          created_at: string | null
          description: string | null
          direction: string | null
          due_date: string | null
          id: string
          invoice_id: string | null
          method: string | null
          paid_at: string | null
          reconciled_at: string | null
          reconciled_by: string | null
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          direction?: string | null
          due_date?: string | null
          id?: string
          invoice_id?: string | null
          method?: string | null
          paid_at?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          direction?: string | null
          due_date?: string | null
          id?: string
          invoice_id?: string | null
          method?: string | null
          paid_at?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          company_id: string | null
          created_at: string
          full_name: string | null
          id: string
          job_title: string | null
          phone: string | null
          status: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          assigned_to_name: string | null
          category: string | null
          company_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          document_id: string | null
          due_date: string | null
          id: string
          payment_id: string | null
          priority: string | null
          status: string | null
          task_type: string | null
          tenant_id: string | null
          title: string | null
        }
        Insert: {
          assigned_to?: string | null
          assigned_to_name?: string | null
          category?: string | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          document_id?: string | null
          due_date?: string | null
          id?: string
          payment_id?: string | null
          priority?: string | null
          status?: string | null
          task_type?: string | null
          tenant_id?: string | null
          title?: string | null
        }
        Update: {
          assigned_to?: string | null
          assigned_to_name?: string | null
          category?: string | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          document_id?: string | null
          due_date?: string | null
          id?: string
          payment_id?: string | null
          priority?: string | null
          status?: string | null
          task_type?: string | null
          tenant_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          id: string
          name: string
          owner_user_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          owner_user_id?: string | null
          slug?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          owner_user_id?: string | null
          slug?: string
        }
        Relationships: []
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
          role: Database["public"]["Enums"]["app_role"]
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
      users: {
        Row: {
          created_at: string | null
          id: string
          name: string | null
          role: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          name?: string | null
          role?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string | null
          role?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_settings: {
        Row: {
          automation_preferences: Json
          created_at: string
          currency: string
          fiscal_year_end: string
          notification_channels: Json
          office_name: string | null
          tenant_id: string
          theme_preference: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          automation_preferences?: Json
          created_at?: string
          currency?: string
          fiscal_year_end?: string
          notification_channels?: Json
          office_name?: string | null
          tenant_id: string
          theme_preference?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          automation_preferences?: Json
          created_at?: string
          currency?: string
          fiscal_year_end?: string
          notification_channels?: Json
          office_name?: string | null
          tenant_id?: string
          theme_preference?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_current_tenant: { Args: never; Returns: boolean }
      claim_next_integration_job: {
        Args: { worker_id: string }
        Returns: {
          attempt_count: number
          completed_at: string | null
          connection_id: string | null
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
          scheduled_for: string
          status: string
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "integration_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_integration_job: {
        Args: { job_id: string }
        Returns: {
          attempt_count: number
          completed_at: string | null
          connection_id: string | null
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
          scheduled_for: string
          status: string
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "integration_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_user_account_type: { Args: never; Returns: string }
      current_user_company_id: { Args: never; Returns: string }
      current_user_tenant_id: { Args: never; Returns: string }
      fail_integration_job: {
        Args: { error_message: string; job_id: string }
        Returns: {
          attempt_count: number
          completed_at: string | null
          connection_id: string | null
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
          scheduled_for: string
          status: string
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "integration_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      integration_next_retry_at: {
        Args: { attempt_number: number }
        Returns: string
      }
      sanitize_integration_headers: { Args: { headers: Json }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "collaborator" | "client"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "collaborator", "client"],
    },
  },
} as const
