import React, { useState } from "react";
import { supabase, supabaseConfigured } from "../../lib/supabase";

export default function AuthPage() {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  if (!supabaseConfigured) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>JabangPro</h1>
          <p className="auth-error">
            Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
          </p>
        </div>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } }
        });
        if (err) throw err;
        setNotice("Account created. You can now sign in, or you may already be signed in.");
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand auth-brand">
          <span className="brand-mark">J</span>
          <div>
            <b>JabangPro</b>
            <small>Business Management</small>
          </div>
        </div>
        <h1>{mode === "login" ? "Sign in" : "Create your account"}</h1>

        {mode === "signup" && (
          <label>
            Full name
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>

        {error && <p className="auth-error">{error}</p>}
        {notice && <p className="auth-notice">{notice}</p>}

        <button className="complete-btn auth-submit" disabled={busy} type="submit">
          {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Sign up"}
        </button>

        <button
          type="button"
          className="link-btn auth-toggle"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError("");
            setNotice("");
          }}
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
