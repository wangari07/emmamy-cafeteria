import "dotenv/config";
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import messagesRouter from "./routes/messages";
import convexRouter from "./routes/convex"; // ← ADD THIS

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
);

app.use(express.json()); // ← Move up before routes

app.all("/api/auth/*", toNodeHandler(auth));

app.get("/", (_req, res) => {
  res.send("Backend is running. Use /api/health");
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "backend",
    sms: "africas_talking",
    auth: "better-auth",
  });
});

app.use("/api/convex", convexRouter); // ← ADD THIS
app.use("/api/messages", messagesRouter);

// ← REMOVE the inline convex routes, they're now in the router

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});