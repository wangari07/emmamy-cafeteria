import "dotenv/config";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  if (!process.env.VITE_CONVEX_URL) {
    throw new Error("Missing VITE_CONVEX_URL in environment variables.");
  }

  const convex = new ConvexHttpClient(process.env.VITE_CONVEX_URL);

  const result = await convex.query(api.students.getProfileByAdmNo, {
    admNo: "2816",
  });

  console.log("STUDENT PROFILE:");
  console.dir(result, { depth: null });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});