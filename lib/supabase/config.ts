const SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_PUBLISHABLE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
const SUPABASE_LEGACY_ANON_KEY_ENV = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

const required = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const getSupabasePublicConfig = (): SupabasePublicConfig => {
  const url = required(process.env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_URL_ENV);
  const publishableKey = required(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    `${SUPABASE_PUBLISHABLE_KEY_ENV} (or legacy ${SUPABASE_LEGACY_ANON_KEY_ENV})`
  );

  return { url, publishableKey };
};
