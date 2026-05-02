import "dotenv/config";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function main() {
  if (!process.env.VITE_CONVEX_URL) {
    throw new Error("Missing VITE_CONVEX_URL in environment variables.");
  }

  const convex = new ConvexHttpClient(process.env.VITE_CONVEX_URL);

  const result = await convex.mutation(api.mealService.printMealPass, {
    studentId: "js7002fhxj57mjpvccmfb32605857tbg" as any,
    menuItemId: "kd77641c1y3xxashknesq7d49h85vdsv" as any,
    printedBy: "bobonation09@gmail.com",
  });

  console.log("MEAL PASS RESULT:");
  console.dir(result, { depth: null });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});