import type { SupabaseClient } from "@supabase/supabase-js";

const randomSuffix = (): string => {
  return Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
};

export const generateUniqueAccountNumber = async (
  supabase: SupabaseClient,
  tenantId: string
): Promise<string> => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = `${Date.now().toString().slice(-8)}${randomSuffix()}`;
    const { data } = await supabase
      .from("accounts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("account_number", candidate)
      .maybeSingle();

    if (!data?.id) {
      return candidate;
    }
  }

  throw new Error("Unable to generate unique account number");
};
