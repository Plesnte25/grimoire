import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import {
  authStatus,
  bootstrapAccount,
  lock,
  refreshSession,
  requestOtp,
  verifyOtp,
  unlockWithPin,
} from "../app/api";

type Stage =
  | "loading"
  | "login"
  | "login-code"
  | "register"
  | "register-code"
  | "unlocked";

const IDLE_LOCK_MS = 15 * 60 * 1000;

function errMessage(e: any, fallback: string) {
  return e?.response?.data?.error ?? fallback;
}

export function PasscodeGate() {
  const location = useLocation();
  const isPublicShare = location.pathname.startsWith("/shared/");
  const [stage, setStage] = useState<Stage>("loading");
  const [deviceTrusted, setDeviceTrusted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [code, setCode] = useState("");

  async function refreshStatus() {
    const status = await authStatus();
    setDeviceTrusted(status.deviceTrusted);
    if (status.unlocked) setStage("unlocked");
    else if (status.bootstrap) setStage("register");
    else setStage("login");
  }

  useEffect(() => {
    if (isPublicShare) return;
    refreshStatus().catch(() => setStage("register"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublicShare]);

  useEffect(() => {
    if (isPublicShare || stage !== "unlocked") return;
    let lastActiveAt = Date.now();
    let lastRefreshAt = lastActiveAt;
    let backgroundedAt: number | null = null;
    let timeout: number;
    let locking = false;
    let active = true;

    const lockAfterIdle = async () => {
      if (locking) return;
      locking = true;
      window.clearTimeout(timeout);
      try {
        await lock();
      } catch (lockError) {
        setError(errMessage(lockError, "Could not end the current session"));
      } finally {
        setPin("");
        setStage("login");
        locking = false;
      }
    };
    const schedule = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        if (Date.now() - lastActiveAt >= IDLE_LOCK_MS) void lockAfterIdle();
        else schedule();
      }, Math.max(0, IDLE_LOCK_MS - (Date.now() - lastActiveAt)));
    };
    const onActivity = () => {
      if (document.visibilityState !== "visible") return;
      lastActiveAt = Date.now();
      if (lastActiveAt - lastRefreshAt >= 60_000) {
        lastRefreshAt = lastActiveAt;
        void refreshSession().catch((sessionError) => {
          if (!active) return;
          setError(errMessage(sessionError, "Your session expired. Unlock to continue."));
          setPin("");
          setStage("login");
        });
      }
      schedule();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        backgroundedAt = Date.now();
      } else if (backgroundedAt !== null) {
        const elapsed = Date.now() - backgroundedAt;
        backgroundedAt = null;
        if (elapsed >= IDLE_LOCK_MS || Date.now() - lastActiveAt >= IDLE_LOCK_MS) void lockAfterIdle();
        else onActivity();
      }
    };
    const activityEvents: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart", "scroll"];
    activityEvents.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibilityChange);
    schedule();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      activityEvents.forEach((event) => window.removeEventListener(event, onActivity));
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isPublicShare, stage]);

  // --- Login (default, once an account exists) ---

  async function handleLogin() {
    setError(null);
    setBusy(true);
    try {
      if (deviceTrusted) {
        if (pin.length < 4) {
          setError("Enter your PIN");
          return;
        }
        await unlockWithPin(pin);
        await refreshStatus();
      } else {
        if (!email.trim()) {
          setError("Enter your email");
          return;
        }
        await requestOtp(email.trim());
        setStage("login-code");
      }
    } catch (e: any) {
      setError(errMessage(e, "Could not log in"));
      if (deviceTrusted) setPin("");
    } finally {
      setBusy(false);
    }
  }

  async function handleLoginCode() {
    setError(null);
    setBusy(true);
    try {
      await verifyOtp(code.trim());
      setDeviceTrusted(true);
      setCode("");
      setPin("");
      setStage("login");
    } catch (e: any) {
      setError(errMessage(e, "Incorrect code"));
    } finally {
      setBusy(false);
    }
  }

  async function handleResendLoginCode() {
    setError(null);
    setBusy(true);
    try {
      await requestOtp(email.trim());
    } catch (e: any) {
      setError(errMessage(e, "Could not resend code"));
    } finally {
      setBusy(false);
    }
  }

  // --- Register (only reachable when no account exists yet) ---

  async function handleRegister() {
    setError(null);
    if (!email.trim()) return setError("Enter your email");
    if (pin.length < 4) return setError("PIN must be at least 4 digits");
    if (pin !== confirmPin) return setError("PINs don't match");
    setBusy(true);
    try {
      await requestOtp(email.trim());
      setStage("register-code");
    } catch (e: any) {
      setError(errMessage(e, "Could not send code"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRegisterCode() {
    setError(null);
    setBusy(true);
    try {
      await verifyOtp(code.trim());
      await bootstrapAccount(email.trim(), pin);
      await refreshStatus();
    } catch (e: any) {
      setError(errMessage(e, "Incorrect code"));
    } finally {
      setBusy(false);
    }
  }

  async function handleResendRegisterCode() {
    setError(null);
    setBusy(true);
    try {
      await requestOtp(email.trim());
    } catch (e: any) {
      setError(errMessage(e, "Could not resend code"));
    } finally {
      setBusy(false);
    }
  }

  if (isPublicShare || stage === "unlocked") return <Outlet />;

  if (stage === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-sm opacity-60">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
        <div className="surface-card w-full max-w-sm rounded-[var(--radius-dialog)] p-6">
          {stage === "login" && (
            <>
              <div className="mb-4 flex justify-center text-[var(--acc)]" aria-hidden="true"><span className="font-display text-5xl">✦</span></div>
              <div className="text-center font-display text-3xl font-semibold">{deviceTrusted ? "Welcome back" : "Sign in"}</div>
              <div className="mt-1 text-center text-sm text-[var(--tx3)]">
                {deviceTrusted ? "Enter your PIN to unlock." : "New device — verify your email once."}
              </div>
              {deviceTrusted ? (
                <>
                  <label className={`pin-dots mt-6 flex min-h-12 items-center justify-center gap-3 ${error ? "animate-shake" : ""}`} aria-label={`${pin.length} PIN digits entered`}>
                    {Array.from({ length: 6 }, (_, index) => <span key={index} className={`h-3.5 w-3.5 rounded-full border border-[var(--acc)] ${pin.length > index ? "bg-[var(--acc)]" : ""}`} />)}
                    <input
                      autoFocus
                      aria-label="PIN"
                      className="absolute h-px w-px opacity-0"
                      inputMode="numeric"
                      value={pin}
                      onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                  </label>
                  <div className="mx-auto mt-5 grid max-w-[16rem] grid-cols-3 gap-2">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map((key) => (
                      <button
                        key={key}
                        type="button"
                        disabled={busy}
                        aria-label={key === "clear" ? "Clear PIN" : key === "back" ? "Delete last PIN digit" : `Digit ${key}`}
                        onClick={() => setPin((current) => key === "clear" ? "" : key === "back" ? current.slice(0, -1) : current.length < 6 ? current + key : current)}
                        className="grid h-14 place-items-center rounded-full bg-[var(--s2)] text-lg font-semibold text-[var(--tx)] transition-colors hover:bg-[var(--s3)] active:scale-95 disabled:opacity-50"
                      >
                        {key === "clear" ? "×" : key === "back" ? "⌫" : key}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <input
                  autoFocus
                  className="mt-5 min-h-12 w-full rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-4 py-3"
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              )}
              {error && <div role="alert" className="mt-3 text-center text-sm text-[var(--err)]">{error}</div>}
              <button
                disabled={busy}
                className="mt-5 min-h-12 w-full rounded-xl bg-[var(--acc)] px-4 py-3 font-semibold text-[var(--bg)] transition hover:brightness-110 disabled:opacity-50"
                onClick={handleLogin}
              >
                {busy ? "…" : deviceTrusted ? "Unlock" : "Continue"}
              </button>
            </>
          )}

          {stage === "login-code" && (
            <>
              <div className="text-xl font-semibold">Enter code</div>
              <div className="text-sm opacity-70 mt-1">
                Check {email || "your email"} for a 6-digit code.
              </div>
              <input
                className="mt-4 min-h-11 w-full rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-4 py-3 text-center text-lg tracking-[0.3em]"
                placeholder="000000"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              {error && <div className="text-sm text-red-300 mt-2">{error}</div>}
              <button
                disabled={busy}
                className="mt-4 w-full rounded-xl px-4 py-3 bg-white/10 hover:bg-white/15 transition disabled:opacity-50"
                onClick={handleLoginCode}
              >
                {busy ? "Verifying…" : "Verify & log in"}
              </button>
              <button
                disabled={busy}
                className="mt-2 w-full text-xs opacity-60 hover:opacity-100 transition"
                onClick={handleResendLoginCode}
              >
                Resend code
              </button>
            </>
          )}

          {stage === "register" && (
            <>
              <div className="text-xl font-semibold">Create your account</div>
              <div className="text-sm opacity-70 mt-1">
                Your email verifies new devices. The PIN unlocks the app on
                every device you've verified.
              </div>
              <input
                className="mt-4 min-h-11 w-full rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-4 py-3"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="mt-3 min-h-11 w-full rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-4 py-3"
                placeholder="PIN (4-6 digits)"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <input
                className="mt-3 min-h-11 w-full rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-4 py-3"
                placeholder="Confirm PIN"
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) =>
                  setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
              {error && <div className="text-sm text-red-300 mt-2">{error}</div>}
              <button
                disabled={busy}
                className="mt-4 w-full rounded-xl px-4 py-3 bg-white/10 hover:bg-white/15 transition disabled:opacity-50"
                onClick={handleRegister}
              >
                {busy ? "Sending…" : "Create account"}
              </button>
            </>
          )}

          {stage === "register-code" && (
            <>
              <div className="text-xl font-semibold">Enter code</div>
              <div className="text-sm opacity-70 mt-1">
                Check {email || "your email"} for a 6-digit code.
              </div>
              <input
                className="mt-4 min-h-11 w-full rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-4 py-3 text-center text-lg tracking-[0.3em]"
                placeholder="000000"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              {error && <div className="text-sm text-red-300 mt-2">{error}</div>}
              <button
                disabled={busy}
                className="mt-4 w-full rounded-xl px-4 py-3 bg-white/10 hover:bg-white/15 transition disabled:opacity-50"
                onClick={handleRegisterCode}
              >
                {busy ? "Verifying…" : "Verify & create account"}
              </button>
              <button
                disabled={busy}
                className="mt-2 w-full text-xs opacity-60 hover:opacity-100 transition"
                onClick={handleResendRegisterCode}
              >
                Resend code
              </button>
            </>
          )}
        </div>
    </div>
  );
}
