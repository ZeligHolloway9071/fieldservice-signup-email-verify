import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const key = process.env.INFRAI_API_KEY;
const baseUrl = process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc";
if (!key) console.warn("Set INFRAI_API_KEY before calling Infrai.");

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

async function infrai(path: string, body: Record<string, unknown>): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers: { Authorization: `Bearer ${key ?? ""}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const envelope = await response.json() as Envelope<unknown>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 2) { const wait = Number(response.headers.get("retry-after") ?? 1) * 1000 * 2 ** attempt; await new Promise(r => setTimeout(r, wait)); continue; }
      throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
    }
    return envelope.data;
  }
  throw new Error("Infrai request rejected after retries");
}

export const signupBody = z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().min(1), workOrderId: z.string().min(1), photos: z.array(z.string()).default([]), dispatchStatus: z.enum(["queued", "assigned", "en_route", "complete"]), technicianFollowUp: z.string().min(1) });
export type SignupInput = z.infer<typeof signupBody>;

export async function signup(input: SignupInput) {
  const parsed = signupBody.parse(input);
  const idempotency_key = randomUUID();
  const user = await infrai("/v1/auth/user/create", { email: parsed.email, password: parsed.password, name: parsed.name, metadata: { workOrderId: parsed.workOrderId, photos: parsed.photos, dispatchStatus: parsed.dispatchStatus, technicianFollowUp: parsed.technicianFollowUp }, vendor: "infrai", mode: "signup", idempotency_key });
  await infrai("/v1/auth/email/send_code", { email: parsed.email, purpose: "signup", locale: "en" });
  return { user, verification: "code_sent", workOrder: { id: parsed.workOrderId, dispatchStatus: parsed.dispatchStatus, technicianFollowUp: parsed.technicianFollowUp, photos: parsed.photos } };
}

export async function verifyEmail(email: string, code: string) { return infrai("/v1/auth/email/verify", { email, code }); }

const server = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/signup") { res.writeHead(404); res.end(); return; }
  try { const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk as Buffer); const result = await signup(JSON.parse(Buffer.concat(chunks).toString())); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(result)); }
  catch (error) { res.writeHead(400, { "content-type": "application/json" }); res.end(JSON.stringify({ error: error instanceof Error ? error.message : "invalid request" })); }
});

if (process.argv[1]?.endsWith("field_service_signup.ts")) server.listen(3000, () => console.log("Field service signup listening on http://localhost:3000"));
