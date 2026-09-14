import { createRequire } from "module";

const require = createRequire(import.meta.url);
const nodemailer = require("nodemailer");

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
    if (transporter) return transporter;

    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_APP_PASSWORD;
    if (!user || !pass) {
        throw new Error("SMTP_USER/SMTP_APP_PASSWORD are not configured");
    }

    transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
    });
    return transporter;
}

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
    const from = process.env.SMTP_USER;
    await getTransporter().sendMail({ from, to, subject, text });
}
