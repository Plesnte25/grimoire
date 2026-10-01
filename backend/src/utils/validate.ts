import type { z, ZodTypeAny } from "zod";

export function parseOrThrow<T extends ZodTypeAny>(schema: T, data: unknown): z.output<T> {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => i.message).join(", ");
        const err: any = new Error(msg);
        err.status = 400;
        err.code = "VALIDATION_ERROR";
        throw err;
    }
    return parsed.data;
}
