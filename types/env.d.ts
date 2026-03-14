declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    SUPABASE_JWT_SECRET?: string;
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    AUTH_REDIRECT_BASE_URL?: string;
    NEXT_PUBLIC_APP_URL?: string;
    AUTH_ALLOW_RATE_LIMIT_SIGNUP_FALLBACK?: string;
    DOCUMENT_UPLOAD_ROOT?: string;
  }
}
