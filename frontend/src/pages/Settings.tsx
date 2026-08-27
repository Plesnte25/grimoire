import { useState } from "react";
import { disablePin, setPin } from "../components/PasscodeGate";
import { useNavigate } from "react-router-dom";

export function Settings() {
  const nav = useNavigate();
  const enabled = localStorage.getItem("mv_pin_enabled") === "1";
  const [pin, setPinState] = useState("");

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
        <div className="font-semibold">Passcode Lock</div>
        <div className="text-sm opacity-70 mt-1">
          Local PIN stored securely (PBKDF2 hash). No login.
        </div>

        {!enabled ? (
          <>
            <input
              className="mt-4 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none text-sm"
              placeholder="Set 4–6 digit PIN"
              value={pin}
              onChange={(e) =>
                setPinState(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
            />
            <button
              className="mt-3 rounded-xl px-4 py-2 bg-white/10 hover:bg-white/15 transition"
              onClick={async () => {
                if (pin.length < 4) return;
                await setPin(pin);
                window.location.reload();
              }}
            >
              Enable
            </button>
          </>
        ) : (
          <button
            className="mt-4 rounded-xl px-4 py-2 bg-white/10 hover:bg-white/15 transition"
            onClick={() => {
              disablePin();
              window.location.reload();
            }}
          >
            Disable passcode
          </button>
        )}
      </div>
    </div>
  );
}
