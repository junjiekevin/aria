import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function getAuthenticatedUserId(
  req: Request,
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const { data, error } = await authClient.auth.getUser();
  if (error || !data?.user) return null;
  return data.user.id;
}

