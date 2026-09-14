import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setAccountPin, lock } from "../app/api";

export function Settings() {
  const nav = useNavigate();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleChangePin() {
    setError(null);
    setSuccess(false);
    if (newPin.length < 4) return setError("New PIN must be at least 4 digits");
    if (newPin !== confirmPin) return setError("New PINs don't match");
    setBusy(true);
    try {
      await setAccountPin(currentPin, newPin);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setSuccess(true);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Could not change PIN");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen px-4 md:px-8 py-6 max-w-2xl mx-auto">
      <button
        className="text-sm opacity-70 hover:opacity-100"
        onClick={() => nav(-1)}
      >
        ← Back
      </button>
      <div className="mt-4 text-2xl font-semibold">Settings</div>

      <div className="mt-6 glass rounded-2xl p-4">
        <div className="font-semibold">Passcode</div>
        <div className="text-sm opacity-70 mt-1">
          Same PIN unlocks every device you've verified by email.
        </div>

        <input
          className="mt-4 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none text-sm"
          placeholder="Current PIN"
          value={currentPin}
          onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
        />
        <input
          className="mt-3 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none text-sm"
          placeholder="New PIN (4-6 digits)"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
        />
        <input
          className="mt-3 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none text-sm"
          placeholder="Confirm new PIN"
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
        />
        {error && <div className="text-sm text-red-300 mt-2">{error}</div>}
        {success && <div className="text-sm text-emerald-300 mt-2">PIN changed.</div>}
        <button
          disabled={busy}
          className="mt-3 rounded-xl px-4 py-2 bg-white/10 hover:bg-white/15 transition disabled:opacity-50"
          onClick={handleChangePin}
        >
          {busy ? "Changing…" : "Change PIN"}
        </button>
      </div>

      <div className="mt-4 glass rounded-2xl p-4">
        <div className="font-semibold">This device</div>
        <div className="text-sm opacity-70 mt-1">
          Lock now to require the PIN again next time — this device stays
          verified, no email step needed to unlock again.
        </div>
        <button
          className="mt-3 rounded-xl px-4 py-2 bg-white/10 hover:bg-white/15 transition"
          onClick={async () => {
            await lock();
            window.location.reload();
          }}
        >
          Lock now
        </button>
      </div>
    </div>
  );
}
