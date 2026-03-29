"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getMe, login } from "@/lib/api";
import { PublicOnly } from "@/components/AuthGuards";
import { setStoredRefreshToken, setStoredRole, setStoredToken } from "@/lib/session";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const tokenData = await login(email, password);
      const me = await getMe(tokenData.access);

      setStoredToken(tokenData.access);
      setStoredRefreshToken(tokenData.refresh);
      setStoredRole(me.role);

      if (me.role === "HOSPITAL") {
        router.push("/dashboard/hospital");
      } else {
        router.push("/dashboard/donor");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicOnly>
      <main className="page">
        <section className="container hero">
        <div className="actions compact-actions" style={{ marginBottom: 12 }}>
          <button className="btn" type="button" onClick={handleBack}>Back</button>
          <Link href="/" className="btn btn-subtle">Home</Link>
        </div>
        <div className="brand">BloodLink Access</div>
        <h1 className="title">
          Sign <span className="accent">In</span>
        </h1>
        <p className="subtitle">Login with your donor or hospital account to access the respective dashboard.</p>

        <div className="panel section" style={{ maxWidth: 680 }}>
          <div className="panel-head">
            <div className="panel-title">Account Sign In</div>
          </div>
          <div style={{ padding: 16 }}>
            <form className="form-grid" onSubmit={handleSubmit}>
              <input
                className="input"
                type="email"
                value={email}
                required
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
              />
              <input
                className="input"
                type="password"
                value={password}
                required
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
              />
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
            <div className="notice">{message || "New user? Create an account first."}</div>
            <div className="notice">
              <Link href="/auth/signup" className="accent-link">
                Go to Sign Up
              </Link>
            </div>
          </div>
        </div>
        </section>
      </main>
    </PublicOnly>
  );
}
