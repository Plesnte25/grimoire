import React, { useMemo, useState } from "react";

function bufToHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPin(pin: string, saltHex: string) {
  const enc = new TextEncoder();
  const salt = Uint8Array.from(
    saltHex.match(/.{1,2}/g)!.map((h) => parseInt(h, 16))
  );
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 120000 },
    keyMaterial,
    256
  );
  return bufToHex(bits);
}

function randomSaltHex() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Stored = { saltHex: string; hashHex: string };

export function PasscodeGate({ children }: { children: React.ReactNode }) {
  const enabled = localStorage.getItem("mv_pin_enabled") === "1";
  const stored: Stored | null = useMemo(() => {
    const raw = localStorage.getItem("mv_pin_data");
    return raw ? JSON.parse(raw) : null;
  }, []);

  const [unlocked, setUnlocked] = useState(!enabled);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const hasPin = enabled && stored?.saltHex && stored?.hashHex;

  async function unlock() {
    try {
      setErr(null);
      if (!hasPin) return setUnlocked(true);
      const h = await hashPin(pin, stored!.saltHex);
      if (h === stored!.hashHex) setUnlocked(true);
      else setErr("Wrong PIN");
    } catch {
      setErr("Could not unlock");
    }
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="glass rounded-2xl p-6 w-full max-w-sm">
        <div className="text-xl font-semibold">Enter Passcode</div>
        <div className="text-sm opacity-70 mt-1">
          This app is locked locally on this device.
        </div>
        <input
          className="mt-4 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none"
          placeholder="4–6 digits"
          value={pin}
          onChange={(e) =>
            setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          inputMode="numeric"
        />
        {err && <div className="text-sm text-red-300 mt-2">{err}</div>}
        <button
          className="mt-4 w-full rounded-xl px-4 py-3 bg-white/10 hover:bg-white/15 transition"
          onClick={unlock}
        >
          Unlock
        </button>

        {!hasPin && (
          <div className="text-xs opacity-60 mt-3">
            No PIN is set yet. Open Settings after entering.
          </div>
        )}
      </div>
    </div>
  );
}

export async function setPin(pin: string) {
  const saltHex = randomSaltHex();
  const hashHex = await hashPin(pin, saltHex);
  localStorage.setItem("mv_pin_enabled", "1");
  localStorage.setItem("mv_pin_data", JSON.stringify({ saltHex, hashHex }));
}

export function disablePin() {
  localStorage.setItem("mv_pin_enabled", "0");
}
