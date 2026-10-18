import { PrismaClient } from "@prisma/client";

// Prisma's SQLite connector maps `socket_timeout` (seconds) to busy_timeout on
// every pooled connection, so writers wait instead of failing with SQLITE_BUSY.
function withBusyTimeout(url: string | undefined) {
    if (!url || /[?&]socket_timeout=/.test(url)) return url;
    return `${url}${url.includes("?") ? "&" : "?"}socket_timeout=10`;
}

export const prisma = new PrismaClient({
    datasourceUrl: withBusyTimeout(process.env.DATABASE_URL),
    transactionOptions: { maxWait: 10_000, timeout: 120_000 },
});

// WAL lets reads proceed during writes. It is stored in the database file, so
// setting it once at startup is enough.
export const dbReady = prisma
    .$queryRawUnsafe("PRAGMA journal_mode=WAL")
    .then(() => prisma.$queryRawUnsafe("PRAGMA synchronous=NORMAL"))
    .catch((err) => console.error("Could not enable SQLite WAL mode:", err));
