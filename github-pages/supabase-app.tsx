import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { NutritionDashboard } from "../app/nutrition-dashboard";
import {
  createSupabaseNutritionClient,
  isSupabaseConfigured,
  supabase,
} from "./supabase";
import "./supabase-app.css";

export function SupabaseApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [googleSigningIn, setGoogleSigningIn] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const nutritionClient = useMemo(
    () => (supabase ? createSupabaseNutritionClient(supabase) : null),
    [],
  );

  async function sendMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !email.trim()) return;
    setSending(true);
    setMessage("");
    const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo.toString() },
    });
    setSending(false);
    setMessage(
      error
        ? `로그인 메일을 보내지 못했습니다: ${error.message}`
        : "메일함에서 로그인 링크를 열어주세요.",
    );
  }

  async function signInWithGoogle() {
    if (!supabase) return;
    setGoogleSigningIn(true);
    setMessage("");
    const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo.toString() },
    });
    if (error) {
      setGoogleSigningIn(false);
      setMessage(`Google 로그인을 시작하지 못했습니다: ${error.message}`);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="auth-kicker">설정 필요</p>
          <h1>Supabase 연결을 기다리고 있어요.</h1>
          <p>
            GitHub 저장소 변수에 <code>VITE_SUPABASE_URL</code>과{" "}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>를 등록하면 로그인 화면이
            활성화됩니다.
          </p>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="auth-shell" aria-live="polite">
        <section className="auth-card">
          <p>로그인 상태를 확인하고 있어요.</p>
        </section>
      </main>
    );
  }

  if (!session || !nutritionClient) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="auth-kicker">개인 식단 기록</p>
          <h1>로그인하세요.</h1>
          <p>
            같은 Google 계정으로 로그인하면 아이폰, 윈도우와 맥에서 같은 기록을 볼 수
            있습니다.
          </p>
          <button
            className="google-auth-button"
            type="button"
            disabled={googleSigningIn}
            onClick={signInWithGoogle}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path
                fill="#4285f4"
                d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.3h5.4a4.6 4.6 0 0 1-2 3v2.8h3.3c1.9-1.8 2.9-4.4 2.9-7.9Z"
              />
              <path
                fill="#34a853"
                d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.8c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.9A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#fbbc05"
                d="M6.5 13.7a6 6 0 0 1 0-3.4v-3H3.1a10 10 0 0 0 0 9.3l3.4-2.9Z"
              />
              <path
                fill="#ea4335"
                d="M12 6.2c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 3.1 7.4l3.4 2.9A5.9 5.9 0 0 1 12 6.2Z"
              />
            </svg>
            {googleSigningIn ? "Google로 이동하는 중…" : "Google로 계속"}
          </button>
          <div className="auth-divider" aria-hidden="true">
            <span>또는</span>
          </div>
          <form className="auth-form" onSubmit={sendMagicLink}>
            <label htmlFor="login-email">이메일</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button type="submit" disabled={sending}>
              {sending ? "보내는 중…" : "로그인 링크 받기"}
            </button>
          </form>
          {message && (
            <p className="auth-message" role="status">
              {message}
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <NutritionDashboard
      client={nutritionClient}
      userEmail={session.user.email}
      onSignOut={async () => {
        await supabase?.auth.signOut();
      }}
    />
  );
}
