import { Router } from "express";
import { ConvexHttpClient } from "convex/browser";

const router = Router();

const convex = new ConvexHttpClient(process.env.VITE_CONVEX_URL!);

router.get("/ping", (_req, res) => {
  res.status(200).json({ ok: true, route: "convex" });
});

router.post("/get-user-by-email", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const user = await convex.query("appUsers:getUserProfileByEmail", { email });

    return res.status(200).json(user);
  } catch (error: any) {
    console.error("Convex get user error:", error);
    return res.status(500).json({
      error: error?.message || "Failed to fetch user.",
    });
  }
});

export default router;