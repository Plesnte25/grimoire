import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAccountPreferences,
  fetchTrustedDevices,
  setAccountPin,
  lock,
  revokeTrustedDevice,
  updateAccountPreferences,
} from "../app/api";
import { useTheme } from "../app/ThemeProvider";
import type { AccountPreferences } from "../types";
import { BackupTools } from "../components/BackupTools";

function browserCountry() {
  try {
    return new Intl.Locale(navigator.language).region ?? null;
  } catch {
    return null;
  }
}

export function Settings() {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const { theme, setTheme, textSize, setTextSize, reduceMotion, setReduceMotion } = useTheme();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [revokeOtherDevices, setRevokeOtherDevices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const { data: preferences, isLoading: preferencesLoading, isError: preferencesLoadError } = useQuery({
    queryKey: ["account-preferences"],
    queryFn: fetchAccountPreferences,
  });
  const {
    data: devices = [],
    isLoading: devicesLoading,
    isError: devicesError,
    refetch: refetchDevices,
  } = useQuery({ queryKey: ["trusted-devices"], queryFn: fetchTrustedDevices });
  const deviceMutation = useMutation({
    mutationFn: revokeTrustedDevice,
    onSuccess: async ({ isCurrent }) => {
      await refetchDevices();
      if (isCurrent) window.location.reload();
    },
    onError: (e: any) => setError(e?.response?.data?.error ?? "Could not revoke this device"),
  });
  const browserRegion = browserCountry();
  const [watchCountryDraft, setWatchCountryDraft] = useState("");
  useEffect(() => {
    setWatchCountryDraft(preferences?.watchCountry ?? browserRegion ?? "");
  }, [preferences?.watchCountry, browserRegion]);
  const preferencesMutation = useMutation({
    mutationFn: (patch: Partial<AccountPreferences>) => updateAccountPreferences(patch),
    onSuccess: (next) => {
      setPreferencesError(null);
      queryClient.setQueryData(["account-preferences"], next);
    },
    onError: (error: any) => setPreferencesError(error?.response?.data?.error ?? "Could not save preferences"),
  });

  async function handleChangePin() {
    setError(null);
    setSuccess(false);
    if (newPin.length < 4) return setError("New PIN must be at least 4 digits");
    if (newPin !== confirmPin) return setError("New PINs don't match");
    setBusy(true);
    try {
      await setAccountPin(currentPin, newPin, revokeOtherDevices);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setRevokeOtherDevices(false);
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
      <div className="font-display mt-4 text-4xl font-medium">Settings</div>

      <section className="surface-card mt-6 rounded-[var(--radius-panel)] p-4 md:p-5" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" className="text-base font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-[var(--tx3)]">Choose how Grimoire looks on this device.</p>

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-medium">Theme</legend>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Theme">
            {(["system", "light", "dark"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                aria-pressed={theme === choice}
                onClick={() => setTheme(choice)}
                className={`min-h-11 rounded-xl border px-3 text-sm capitalize transition-colors ${
                  theme === choice
                    ? "border-[var(--acc)] bg-[var(--s2)] text-[var(--tx)]"
                    : "border-[var(--line2)] text-[var(--tx2)] hover:bg-[var(--s2)]"
                }`}
              >
                {choice}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Text size
            <select
              value={textSize}
              onChange={(event) => setTextSize(event.target.value as typeof textSize)}
              className="min-h-11 rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-3 text-sm text-[var(--tx)]"
            >
              <option value="small">Small</option>
              <option value="default">Default</option>
              <option value="large">Large</option>
            </select>
          </label>
          <label className="flex min-h-11 items-center justify-between gap-3 self-end rounded-xl border border-[var(--line)] px-3 text-sm">
            <span>Reduce motion</span>
            <input
              type="checkbox"
              checked={reduceMotion}
              onChange={(event) => setReduceMotion(event.target.checked)}
              className="h-5 w-5 accent-[var(--accbg)]"
            />
          </label>
        </div>
      </section>

      <section className="surface-card mt-4 rounded-[var(--radius-panel)] p-4 md:p-5" aria-labelledby="content-preferences-heading">
        <h2 id="content-preferences-heading" className="text-base font-semibold">Content preferences</h2>
        <p className="mt-1 text-sm text-[var(--tx3)]">These choices follow your account across devices.</p>
        {preferencesLoading ? <p className="mt-4 text-sm text-[var(--tx3)]">Loading preferences…</p> : null}
        {preferencesLoadError ? (
          <p role="alert" className="mt-4 text-sm text-[var(--err)]">Could not load account preferences.</p>
        ) : null}
        {preferences ? (
          <div className="mt-4 space-y-3">
            <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-3 text-sm">
              <span>Show 18+ titles</span>
              <input
                type="checkbox"
                checked={preferences.showAdultContent}
                disabled={preferencesMutation.isPending}
                onChange={(event) => preferencesMutation.mutate({ showAdultContent: event.target.checked })}
                className="h-5 w-5 accent-[var(--accbg)]"
              />
            </label>
            <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-3 text-sm">
              <span>Spoiler shield</span>
              <input
                type="checkbox"
                checked={preferences.spoilerShield}
                disabled={preferencesMutation.isPending}
                onChange={(event) => preferencesMutation.mutate({ spoilerShield: event.target.checked })}
                className="h-5 w-5 accent-[var(--accbg)]"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Where to watch
              <select
                value={watchCountryDraft}
                disabled={preferencesMutation.isPending}
                onChange={(event) => setWatchCountryDraft(event.target.value)}
                className="min-h-11 rounded-xl border border-[var(--line2)] bg-[var(--s1)] px-3 text-sm text-[var(--tx)]"
              >
                <option value="">Choose a country</option>
                {browserRegion && !["GB", "JP", "KR", "PK", "TR", "US"].includes(browserRegion) ? (
                  <option value={browserRegion}>
                    {new Intl.DisplayNames(undefined, { type: "region" }).of(browserRegion)} (this device)
                  </option>
                ) : null}
                <option value="GB">United Kingdom</option>
                <option value="JP">Japan</option>
                <option value="KR">South Korea</option>
                <option value="PK">Pakistan</option>
                <option value="TR">Turkey</option>
                <option value="US">United States</option>
              </select>
            </label>
            {watchCountryDraft !== (preferences.watchCountry ?? "") ? (
              <button
                type="button"
                disabled={preferencesMutation.isPending}
                onClick={() => preferencesMutation.mutate({ watchCountry: watchCountryDraft || null })}
                className="min-h-11 rounded-xl bg-[var(--accbg)] px-4 text-sm font-semibold text-[var(--acc-ink)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {preferencesMutation.isPending ? "Saving…" : "Save country"}
              </button>
            ) : null}
          </div>
        ) : null}
        {preferencesError ? <p role="alert" className="mt-3 text-sm text-[var(--err)]">{preferencesError}</p> : null}
      </section>

      <div className="surface-card mt-4 rounded-[var(--radius-panel)] p-4 md:p-5">
        <div className="font-semibold">Passcode</div>
        <div className="text-sm opacity-70 mt-1">
          Same PIN unlocks every device you've verified by email.
        </div>

        <label className="mt-4 block text-xs font-medium text-[var(--tx2)]" htmlFor="current-pin">Current PIN</label>
        <input id="current-pin" type="password" autoComplete="current-password"
          className="mt-1 min-h-11 w-full rounded-xl border border-[var(--line2)] bg-[var(--bg)] px-3 text-sm text-[var(--tx)]"
          value={currentPin} onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" />
        <label className="mt-3 block text-xs font-medium text-[var(--tx2)]" htmlFor="new-pin">New PIN (4–6 digits)</label>
        <input id="new-pin" type="password" autoComplete="new-password"
          className="mt-1 min-h-11 w-full rounded-xl border border-[var(--line2)] bg-[var(--bg)] px-3 text-sm text-[var(--tx)]"
          value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" />
        <label className="mt-3 block text-xs font-medium text-[var(--tx2)]" htmlFor="confirm-pin">Confirm new PIN</label>
        <input id="confirm-pin" type="password" autoComplete="new-password"
          className="mt-1 min-h-11 w-full rounded-xl border border-[var(--line2)] bg-[var(--bg)] px-3 text-sm text-[var(--tx)]"
          value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" />
        <label className="mt-3 flex min-h-11 items-center gap-3 text-sm text-[var(--tx2)]">
          <input
            type="checkbox"
            checked={revokeOtherDevices}
            onChange={(event) => setRevokeOtherDevices(event.target.checked)}
            className="h-5 w-5 accent-[var(--accbg)]"
          />
          Also revoke every other trusted device
        </label>
        {error && <div role="alert" className="mt-2 text-sm text-[var(--err)]">{error}</div>}
        {success && <div role="status" className="mt-2 text-sm text-[var(--ok)]">PIN changed.</div>}
        <button
          disabled={busy}
          className="mt-3 min-h-11 rounded-xl bg-[var(--accbg)] px-4 text-sm font-semibold text-[var(--acc-ink)] transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleChangePin}
        >
          {busy ? "Changing…" : "Change PIN"}
        </button>
      </div>

      <section className="surface-card mt-4 rounded-[var(--radius-panel)] p-4 md:p-5" aria-labelledby="devices-heading">
        <h2 id="devices-heading" className="font-semibold">Trusted devices</h2>
        <p className="mt-1 text-sm text-[var(--tx3)]">Remove a device you no longer use. It will need email verification to sign in again.</p>
        {devicesLoading ? <p className="mt-4 text-sm text-[var(--tx3)]">Loading devices…</p> : null}
        {devicesError ? <p role="alert" className="mt-4 text-sm text-[var(--err)]">Could not load trusted devices.</p> : null}
        {devices.length ? (
          <ul className="mt-4 divide-y divide-[var(--line)]">
            {devices.map((device) => {
              const browser = /Edg\//.test(device.userAgent ?? "") ? "Edge"
                : /Firefox\//.test(device.userAgent ?? "") ? "Firefox"
                  : /Chrome\//.test(device.userAgent ?? "") ? "Chrome"
                    : /Safari\//.test(device.userAgent ?? "") ? "Safari"
                      : "Unknown browser";
              return (
                <li key={device.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{device.label || browser}{device.isCurrent ? " · This device" : ""}</p>
                    <p className="mt-1 text-xs text-[var(--tx3)]">
                      First seen {new Date(device.createdAt).toLocaleDateString()} · Last active {new Date(device.lastSeenAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={deviceMutation.isPending}
                    onClick={() => deviceMutation.mutate(device.id)}
                    className="min-h-11 rounded-xl border border-[var(--line2)] px-3 text-sm text-[var(--err)] hover:bg-[var(--s2)] disabled:opacity-50"
                  >
                    {deviceMutation.isPending ? "Revoking…" : "Revoke"}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : !devicesLoading && !devicesError ? <p className="mt-4 text-sm text-[var(--tx3)]">No trusted devices found.</p> : null}
      </section>

      <BackupTools />

      <div className="surface-card mt-4 rounded-[var(--radius-panel)] p-4 md:p-5">
        <div className="font-semibold">This device</div>
        <div className="mt-1 text-sm text-[var(--tx3)]">
          Lock now to require the PIN again next time — this device stays
          verified, no email step needed to unlock again.
        </div>
        <button
          className="mt-3 min-h-11 rounded-xl border border-[var(--line2)] px-4 text-sm font-semibold text-[var(--tx)] transition-colors hover:bg-[var(--s2)]"
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
