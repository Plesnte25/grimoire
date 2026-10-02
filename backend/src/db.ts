import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
    transactionOptions: { maxWait: 10_000, timeout: 120_000 },
});
