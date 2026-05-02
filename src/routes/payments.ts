// src/routes/payments.ts
import { Router } from "express";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const router = Router();

const WEBHOOK_SECRET = "emmamy_mpesa_secret_2026";

if (!process.env.VITE_CONVEX_URL) {
  throw new Error("Missing VITE_CONVEX_URL in environment variables.");
}

const convex = new ConvexHttpClient(process.env.VITE_CONVEX_URL);

router.post("/mpesa-sms-webhook", async (req, res) => {
  try {
    const secret = req.header("X-Webhook-Secret");

    if (secret !== WEBHOOK_SECRET) {
      console.log("Webhook rejected: bad secret");
      return res.status(401).json({ error: "Unauthorized webhook request." });
    }

    const payload = req.body ?? {};

    const sender = String(payload.from || "").trim();
    const text = String(payload.text || "").trim();
    const sentStamp = payload.sentStamp ? String(payload.sentStamp) : undefined;
    const receivedStamp = payload.receivedStamp ? String(payload.receivedStamp) : undefined;
    const sim = payload.sim ? String(payload.sim) : undefined;

    if (!sender || !text) {
      return res.status(400).json({
        error: "Webhook payload must include 'from' and 'text'.",
      });
    }

    console.log("=== M-PESA SMS WEBHOOK RECEIVED ===");
    console.log(JSON.stringify(payload, null, 2));

    const result = await convex.mutation(api.payments.ingestMpesaSms, {
      sender,
      text,
      sentStamp,
      receivedStamp,
      sim,
    });

    return res.status(200).json({
      ok: true,
      message: "SMS received and processed successfully",
      result,
    });
  } catch (error: any) {
    console.error("M-Pesa SMS webhook error:", error);
    return res.status(500).json({
      error: error?.message || "Failed to process SMS webhook.",
    });
  }
});

export default router;