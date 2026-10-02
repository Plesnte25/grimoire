import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import {
  authStatus,
  bootstrapAccount,
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

  // --- Login (default, once an account exists) ---

  async function handleLogin() {
    setError(null);
    if (!email.trim()) return setError("Enter your email");
    if (pin.length < 4) return setError("Enter your PIN");
    setBusy(true);
    try {
      if (deviceTrusted) {
        await unlockWithPin(pin);
        await refreshStatus();
      } else {
        await requestOtp(email.trim());
        setStage("login-code");
      }
    } catch (e: any) {
      setError(errMessage(e, "Could not log in"));
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
      try {
        await unlockWithPin(pin);
        await refreshStatus();
      } catch (e: any) {
        // device is verified now — just missing/wrong PIN. Send them back to
        // a plain login retry rather than stranding them on the code screen.
        setError(errMessage(e, "Incorrect PIN"));
        setPin("");
        setStage("login");
      }
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
              <div className="text-xl font-semibold">Log in</div>
              <div className="text-sm opacity-70 mt-1">
                {deviceTrusted
                  ? "Enter your PIN to unlock."
                  : "New device — we'll email a code after this."}
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
                placeholder="PIN"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              {error && <div className="text-sm text-red-300 mt-2">{error}</div>}
              <button
                disabled={busy}
                className="mt-4 w-full rounded-xl px-4 py-3 bg-white/10 hover:bg-white/15 transition disabled:opacity-50"
                onClick={handleLogin}
              >
                {busy ? "…" : "Log in"}
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
