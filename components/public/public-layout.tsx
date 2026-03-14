import { PublicNavbar } from "@/components/public/public-navbar";
import { getAuthContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type PublicLayoutProps = {
  children: React.ReactNode;
};

export const PublicLayout = async ({ children }: PublicLayoutProps) => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const context = user ? await getAuthContext() : null;
  const isAuthenticated = Boolean(user);
  const isAdmin = context?.roles.includes("admin") ?? false;

  return (
    <div className="min-h-screen">
      <PublicNavbar isAdmin={isAdmin} isAuthenticated={isAuthenticated} />
      <div>{children}</div>
    </div>
  );
};
