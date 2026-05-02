import { Router, Request, Response } from "express";
import { sendSms } from "../lib/africastalking";

const router = Router();

router.post("/send", async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};

    const to = typeof body.to === "string" ? body.to.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const type = typeof body.type === "string" ? body.type.trim().toLowerCase() : "sms";

    if (!to || !message) {
      return res.status(400).json({
        error: "Both 'to' and 'message' are required.",
      });
    }

    if (type !== "sms") {
      return res.status(400).json({
        error: "Only SMS is enabled right now.",
      });
    }

    const result = await sendSms(to, message);

    return res.status(200).json({
      success: true,
      provider: "africas_talking",
      result,
    });
  } catch (error: any) {
    console.error("Africa's Talking send error:", error);

    return res.status(500).json({
      error: error?.message || "Failed to send SMS.",
    });
  }
});

export default router;