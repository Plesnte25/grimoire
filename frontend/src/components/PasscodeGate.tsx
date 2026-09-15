import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  authStatus,
  bootstrapAccount,
  requestOtp,
  verifyOtp,
  unlockWithPin,
} from "../app/api";

const EASE = [0.22, 1, 0.36, 1] as const;

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

export function PasscodeGate({ children }: { children: ReactNode }) {
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
    refreshStatus().catch(() => setStage("register"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (stage === "unlocked") return <>{children}</>;

  if (stage === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-sm opacity-60">Loading…</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">
      {/* ambient background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-1/4 -left-1/4 h-[60vh] w-[60vh] rounded-full opacity-40 blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.55), transparent 70%)" }}
        />
        <div
          className="absolute -bottom-1/4 -right-1/4 h-[55vh] w-[55vh] rounded-full opacity-30 blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(236,72,153,0.45), transparent 70%)" }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={stage}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.24, ease: EASE }}
          className="relative glass rounded-2xl p-6 w-full max-w-sm shadow-2xl shadow-black/40"
        >
          {stage === "login" && (
            <>
              <div className="text-xl font-semibold">Log in</div>
              <div className="text-sm opacity-70 mt-1">
                {deviceTrusted
                  ? "Enter your PIN to unlock."
                  : "New device — we'll email a code after this."}
              </div>
              <input
                className="mt-4 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="mt-3 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none"
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
                className="mt-4 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none text-center tracking-[0.3em] text-lg"
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
                className="mt-4 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="mt-3 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none"
                placeholder="PIN (4-6 digits)"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <input
                className="mt-3 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none"
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
                className="mt-4 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none text-center tracking-[0.3em] text-lg"
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
