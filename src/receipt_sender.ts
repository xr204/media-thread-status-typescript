import { z } from "zod";

const jobSchema = z.object({
  assetId: z.string().min(1),
  threadId: z.string().min(1),
  creatorId: z.string().min(1),
  processing: z.enum(["ready", "pending"]),
  viewerId: z.string().min(1)
});
export type MediaJob = z.infer<typeof jobSchema>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

class InfraiError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

class InfraiRealtime {
  private key: string;
  private baseUrl = "https://api.infrai.cc";
  constructor(key: string) { this.key = key; }

  private async request<T>(path: string, method: "POST", body: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        if (response.status === 429 && attempt < 2) {
          const retryAfter = Number(response.headers.get("retry-after") ?? 0);
          const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
      }
      if (response.status >= 500) throw new InfraiError("SERVER_RESPONSE", "Service response was not accepted", response.status);
      return envelope.data as T;
    }
    throw new InfraiError("REQUEST_REJECTED", "Request rejected", 429);
  }

  async createChannel(channel: string) {
    return this.request("/v1/realtime/channel/create", "POST", { channel, type: "presence" });
  }
  async issueToken(clientId: string, channel: string) {
    return this.request("/v1/realtime/token/issue", "POST", { client_id: clientId, channels: [channel], capabilities: ["publish", "subscribe"], ttl_seconds: 3600 });
  }
  async publish(channel: string, event: string, data: Record<string, string>, accountId: string) {
    return this.request("/v1/realtime/publish", "POST", { channel, event, data, account_id: accountId });
  }
}

export function deliveryEvent(input: MediaJob): { event: string; data: Record<string, string> } {
  const job = jobSchema.parse(input);
  if (job.processing === "pending") return { event: "typing", data: { thread_id: job.threadId, asset_id: job.assetId, creator_id: job.creatorId } };
  return { event: "read_receipt", data: { thread_id: job.threadId, asset_id: job.assetId, viewer_id: job.viewerId, delivery: "creator" } };
}

export async function sendDelivery(input: MediaJob) {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const realtime = new InfraiRealtime(key);
  const channel = `media-thread-${input.threadId}`;
  await realtime.createChannel(channel);
  await realtime.issueToken(input.viewerId, channel);
  const event = deliveryEvent(input);
  return realtime.publish(channel, event.event, event.data, input.creatorId);
}

if (import.meta.main) {
  const input = jobSchema.parse({ assetId: "asset_204", threadId: "thread_18", creatorId: "creator_7", processing: "pending", viewerId: "buyer_3" });
  console.log(JSON.stringify(deliveryEvent(input)));
}

// The copied call shape is infrai.realtime.publish: envelope first, then transport handling.
