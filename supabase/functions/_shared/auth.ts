import { createClient, type User } from "npm:@supabase/supabase-js@2.57.4";

export async function authenticatedUser(request: Request): Promise<User | null> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const url = Deno.env.get("SUPABASE_URL");
  const key =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) throw new Error("Supabase 함수 환경이 완성되지 않았습니다.");

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  return error ? null : user;
}

export function userScopedClient(request: Request) {
  const url = Deno.env.get("SUPABASE_URL");
  const key =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authorization = request.headers.get("authorization");
  if (!url || !key || !authorization) {
    throw new Error("Supabase 함수 환경이 완성되지 않았습니다.");
  }
  return createClient(url, key, {
    global: { headers: { authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
