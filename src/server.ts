import "dotenv/config";
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import messagesRouter from "./routes/messages";
import paymentsRouter from "./routes/payments";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
);

app.all("/api/auth/*", toNodeHandler(auth));
app.use(express.json());

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

app.use("/api/messages", messagesRouter);
app.use("/api/payments", paymentsRouter);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});