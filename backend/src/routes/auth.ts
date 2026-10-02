import { createRequire } from "module";
import crypto from "node:crypto";
import { Router } from "express";
import type { Response } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { parseOrThrow } from "../utils/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireSession } from "../middleware/requireSession.js";
import { sendEmail } from "../services/email.js";
import {
    hashWithSalt,
    verifyWithSalt,
    packSaltedHash,
    verifyPackedSaltedHash,
} from "../services/secretHash.js";

const require = createRequire(import.meta.url);
const rateLimit = require("express-rate-limit");

export const authRouter = Router();

const isProd = process.env.NODE_ENV === "production";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h — daily PIN unlock
const DEVICE_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // ~1yr
const PENDING_DEVICE_COOKIE_MAX_AGE_MS = 15 * 60 * 1000; // covers the 10-min OTP TTL
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_THRESHOLD = 5;
const PIN_LOCKOUT_MS = 15 * 60 * 1000;

const pinSchema = z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits");

function httpError(status: number, code: string, message: string) {
    const err: any = new Error(message);
    err.status = status;
    err.code = code;
    return err;
}

function baseCookieOpts() {
    return { httpOnly: true, sameSite: "lax" as const, secure: isProd, path: "/" };
}

function setDeviceCookie(res: Response, deviceId: string) {
    res.cookie("gr_device", deviceId, { ...baseCookieOpts(), maxAge: DEVICE_COOKIE_MAX_AGE_MS });
}

function setPendingDeviceCookie(res: Response, pendingDeviceId: string) {
    res.cookie("gr_pending_device", pendingDeviceId, {
        ...baseCookieOpts(),
        maxAge: PENDING_DEVICE_COOKIE_MAX_AGE_MS,
    });
}

function setSessionCookie(res: Response, sessionId: string) {
    res.cookie("gr_session", sessionId, { ...baseCookieOpts(), maxAge: SESSION_TTL_MS });
}

const otpRequestLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 3 });
const otpVerifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 8 });
const unlockLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

authRouter.get(
    "/status",
    asyncHandler(async (req, res) => {
        const account = await prisma.accountConfig.findUnique({ where: { id: 1 } });
        if (!account) {
            return res.json({ bootstrap: true, deviceTrusted: false, unlocked: false });
        }

        const deviceId = req.cookies?.gr_device;
        const device = deviceId
            ? await prisma.trustedDevice.findUnique({ where: { id: deviceId } })
            : null;

        const sessionId = req.cookies?.gr_session;
        const session = sessionId
            ? await prisma.session.findUnique({ where: { id: sessionId } })
            : null;
        const unlocked = !!session && session.expiresAt > new Date();

        res.json({ bootstrap: false, deviceTrusted: !!device, unlocked });
    })
);

authRouter.post(
    "/bootstrap",
    asyncHandler(async (req, res) => {
        const existing = await prisma.accountConfig.findUnique({ where: { id: 1 } });
        if (existing) throw httpError(409, "ALREADY_BOOTSTRAPPED", "Account already set up");

        const data = parseOrThrow(
            z.object({ email: z.string().email(), pin: pinSchema }),
            req.body
        );
        const email = data.email.toLowerCase().trim();

        // Only the device that just completed OTP verification for this
        // exact email may bootstrap the account — otherwise anyone who
        // verifies an OTP for *any* inbox could set up the account with a
        // different (unverified) email address.
        const deviceId = req.cookies?.gr_device;
        const device = deviceId
            ? await prisma.trustedDevice.findUnique({ where: { id: deviceId } })
            : null;
        if (!device || !device.verifiedEmail || device.verifiedEmail !== email) {
            throw httpError(
                403,
                "EMAIL_NOT_VERIFIED",
                "This device hasn't verified that email via OTP"
            );
        }

        const { saltHex, hashHex } = hashWithSalt(data.pin);
        await prisma.accountConfig.create({
            data: {
                id: 1,
                email,
                pinSaltHex: saltHex,
                pinHashHex: hashHex,
            },
        });

        res.json({ ok: true });
    })
);

authRouter.post(
    "/otp/request",
    otpRequestLimiter,
    asyncHandler(async (req, res) => {
        const data = parseOrThrow(z.object({ email: z.string().email() }), req.body);
        const account = await prisma.accountConfig.findUnique({ where: { id: 1 } });

        let pendingDeviceId: string = req.cookies?.gr_pending_device;
        if (!pendingDeviceId) pendingDeviceId = crypto.randomBytes(16).toString("hex");
        setPendingDeviceCookie(res, pendingDeviceId);

        // No account yet -> this is a registration email, always send (there's
        // nothing to enumerate). Account exists -> only send when the email
        // matches it, and always respond 200 either way so this endpoint can't
        // be used to probe the account's real email.
        const targetEmail = data.email.toLowerCase().trim();
        const shouldSend = account ? targetEmail === account.email : true;
        if (shouldSend) {
            const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
            await prisma.otpCode.create({
                data: {
                    codeHash: packSaltedHash(code),
                    email: account ? account.email : targetEmail,
                    pendingDeviceId,
                    expiresAt: new Date(Date.now() + OTP_TTL_MS),
                },
            });
            await sendEmail(
                account ? account.email : targetEmail,
                "Grimoire verification code",
                `Your verification code is ${code}. It expires in 10 minutes.`
            );
        }

        res.json({ ok: true });
    })
);

authRouter.post(
    "/otp/verify",
    otpVerifyLimiter,
    asyncHandler(async (req, res) => {
        const data = parseOrThrow(z.object({ code: z.string().regex(/^\d{6}$/) }), req.body);

        const pendingDeviceId = req.cookies?.gr_pending_device;
        if (!pendingDeviceId) throw httpError(400, "NO_PENDING_OTP", "No pending verification");

        const otp = await prisma.otpCode.findFirst({
            where: { pendingDeviceId, consumedAt: null },
            orderBy: { createdAt: "desc" },
        });

        if (!otp || otp.expiresAt < new Date()) {
            throw httpError(400, "OTP_EXPIRED", "Code expired or not found");
        }
        if (otp.attempts >= OTP_MAX_ATTEMPTS) {
            throw httpError(429, "OTP_LOCKED", "Too many attempts — request a new code");
        }

        const ok = verifyPackedSaltedHash(data.code, otp.codeHash);
        if (!ok) {
            await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
            throw httpError(401, "OTP_INCORRECT", "Incorrect code");
        }

        await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

        // Bind the device to the email that was actually verified (stored on
        // the OTP record at /otp/request time), not anything client-supplied,
        // so /bootstrap can't be hijacked with a different address.
        const verifiedEmail = otp.email;

        const existingDeviceId = req.cookies?.gr_device;
        const existingDevice = existingDeviceId
            ? await prisma.trustedDevice.findUnique({ where: { id: existingDeviceId } })
            : null;

        const device = existingDevice
            ? await prisma.trustedDevice.update({
                  where: { id: existingDevice.id },
                  data: { verifiedEmail },
              })
            : await prisma.trustedDevice.create({ data: { verifiedEmail } });

        // A brand-new device just joined an existing account — tell the owner,
        // so a login they didn't make doesn't go unnoticed. Best-effort: a mail
        // failure mustn't block the login itself.
        const account = await prisma.accountConfig.findUnique({ where: { id: 1 } });
        if (account && !existingDevice) {
            sendEmail(
                account.email,
                "Grimoire: new device signed in",
                [
                    "A new device was just verified for your Grimoire account.",
                    "",
                    `Time: ${new Date().toUTCString()}`,
                    `IP address: ${req.ip ?? "unknown"}`,
                    `Browser: ${req.get("user-agent") ?? "unknown"}`,
                    "",
                    "If this wasn't you, change your PIN in Settings straight away —",
                    "that also signs out every other session.",
                ].join("\n")
            ).catch((err) => console.error("NEW_DEVICE_ALERT_FAILED:", err));
        }

        setDeviceCookie(res, device.id);
        res.clearCookie("gr_pending_device", { path: "/" });

        res.json({ ok: true });
    })
);

authRouter.post(
    "/unlock",
    unlockLimiter,
    asyncHandler(async (req, res) => {
        const data = parseOrThrow(z.object({ pin: pinSchema }), req.body);

        const deviceId = req.cookies?.gr_device;
        const device = deviceId
            ? await prisma.trustedDevice.findUnique({ where: { id: deviceId } })
            : null;
        if (!device) throw httpError(401, "DEVICE_NOT_TRUSTED", "This device hasn't been verified");

        const account = await prisma.accountConfig.findUnique({ where: { id: 1 } });
        if (!account) throw httpError(409, "NOT_BOOTSTRAPPED", "Account not set up yet");

        if (account.lockedUntil && account.lockedUntil > new Date()) {
            throw httpError(429, "PIN_LOCKED", "Too many attempts — try again later");
        }

        const ok = verifyWithSalt(data.pin, account.pinSaltHex, account.pinHashHex);
        if (!ok) {
            const attempts = account.failedPinAttempts + 1;
            const lockedUntil =
                attempts >= PIN_LOCKOUT_THRESHOLD ? new Date(Date.now() + PIN_LOCKOUT_MS) : null;
            await prisma.accountConfig.update({
                where: { id: 1 },
                data: { failedPinAttempts: attempts, lockedUntil },
            });
            throw httpError(401, "PIN_INCORRECT", "Incorrect PIN");
        }

        await prisma.accountConfig.update({
            where: { id: 1 },
            data: { failedPinAttempts: 0, lockedUntil: null },
        });
        await prisma.trustedDevice.update({ where: { id: device.id }, data: {} }); // bumps lastSeenAt

        const session = await prisma.session.create({
            data: { deviceId: device.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
        });
        setSessionCookie(res, session.id);

        res.json({ ok: true });
    })
);

authRouter.post(
    "/lock",
    asyncHandler(async (req, res) => {
        const sessionId = req.cookies?.gr_session;
        if (sessionId) await prisma.session.deleteMany({ where: { id: sessionId } });
        res.clearCookie("gr_session", { path: "/" });
        res.json({ ok: true });
    })
);

authRouter.post(
    "/pin",
    unlockLimiter,
    requireSession,
    asyncHandler(async (req, res) => {
        const data = parseOrThrow(
            z.object({ currentPin: pinSchema, newPin: pinSchema }),
            req.body
        );

        const account = await prisma.accountConfig.findUnique({ where: { id: 1 } });
        if (!account) throw httpError(409, "NOT_BOOTSTRAPPED", "Account not set up yet");

        const ok = verifyWithSalt(data.currentPin, account.pinSaltHex, account.pinHashHex);
        if (!ok) throw httpError(401, "PIN_INCORRECT", "Current PIN is incorrect");

        const { saltHex, hashHex } = hashWithSalt(data.newPin);
        await prisma.accountConfig.update({
            where: { id: 1 },
            data: { pinSaltHex: saltHex, pinHashHex: hashHex },
        });
        // A PIN change is the "someone else got in" response, so it ends every
        // other unlocked session; this one stays signed in.
        await prisma.session.deleteMany({ where: { id: { not: req.cookies.gr_session } } });

        res.json({ ok: true });
    })
);
