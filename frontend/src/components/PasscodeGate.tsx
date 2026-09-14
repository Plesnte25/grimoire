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
  | "bootstrap"
  | "verify-request"
  | "verify-code"
  | "pin"
  | "unlocked";

function errMessage(e: any, fallback: string) {
  return e?.response?.data?.error ?? fallback;
}

export function PasscodeGate({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [code, setCode] = useState("");

  async function refreshStatus() {
    const status = await authStatus();
    if (status.bootstrap) setStage("bootstrap");
    else if (!status.deviceTrusted) setStage("verify-request");
    else if (!status.unlocked) setStage("pin");
    else setStage("unlocked");
  }

  useEffect(() => {
    refreshStatus().catch(() => setStage("bootstrap"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleBootstrap() {
    setError(null);
    if (pin.length < 4) return setError("PIN must be at least 4 digits");
    if (pin !== confirmPin) return setError("PINs don't match");
    setBusy(true);
    try {
      await bootstrapAccount(email.trim(), pin);
      await refreshStatus();
    } catch (e: any) {
      setError(errMessage(e, "Could not set up account"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestOtp() {
    setError(null);
    setBusy(true);
    try {
      await requestOtp(email.trim());
      setStage("verify-code");
    } catch (e: any) {
      setError(errMessage(e, "Could not send code"));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode() {
    setError(null);
    setBusy(true);
    try {
      await verifyOtp(code.trim());
      await refreshStatus();
    } catch (e: any) {
      setError(errMessage(e, "Incorrect code"));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock() {
    setError(null);
    setBusy(true);
    try {
      await unlockWithPin(pin);
      await refreshStatus();
    } catch (e: any) {
      setError(errMessage(e, "Incorrect PIN"));
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
        {stage === "bootstrap" && (
          <>
            <div className="text-xl font-semibold">Set up MediaVault</div>
            <div className="text-sm opacity-70 mt-1">
              Your email verifies new devices. The PIN unlocks the app on every
              device you've verified.
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
              onClick={handleBootstrap}
            >
              {busy ? "Setting up…" : "Set up"}
            </button>
          </>
        )}

        {stage === "verify-request" && (
          <>
            <div className="text-xl font-semibold">Verify this device</div>
            <div className="text-sm opacity-70 mt-1">
              Enter your account email — we'll send a 6-digit code.
            </div>
            <input
              className="mt-4 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <div className="text-sm text-red-300 mt-2">{error}</div>}
            <button
              disabled={busy}
              className="mt-4 w-full rounded-xl px-4 py-3 bg-white/10 hover:bg-white/15 transition disabled:opacity-50"
              onClick={handleRequestOtp}
            >
              {busy ? "Sending…" : "Send code"}
            </button>
          </>
        )}

        {stage === "verify-code" && (
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
              onClick={handleVerifyCode}
            >
              {busy ? "Verifying…" : "Verify"}
            </button>
            <button
              disabled={busy}
              className="mt-2 w-full text-xs opacity-60 hover:opacity-100 transition"
              onClick={handleRequestOtp}
            >
              Resend code
            </button>
          </>
        )}

        {stage === "pin" && (
          <>
            <div className="text-xl font-semibold">Enter Passcode</div>
            <div className="text-sm opacity-70 mt-1">
              This device is trusted — enter your PIN to unlock.
            </div>
            <input
              className="mt-4 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none"
              placeholder="PIN"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            {error && <div className="text-sm text-red-300 mt-2">{error}</div>}
            <button
              disabled={busy}
              className="mt-4 w-full rounded-xl px-4 py-3 bg-white/10 hover:bg-white/15 transition disabled:opacity-50"
              onClick={handleUnlock}
            >
              {busy ? "Unlocking…" : "Unlock"}
            </button>
          </>
        )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
