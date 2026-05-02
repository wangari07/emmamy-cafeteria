import "dotenv/config";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

async function main() {
  if (!process.env.VITE_CONVEX_URL) {
    throw new Error("Missing VITE_CONVEX_URL in environment variables.");
  }

  const convex = new ConvexHttpClient(process.env.VITE_CONVEX_URL);

  try {
    const result = await convex.mutation(api.students.topUpStudentPoints, {
      studentId: "js7002fhxj57mjpvccmfb32605857tbg" as any,
      points: 300,
      reason: "demo topup",
    });

    console.log("TOPUP RESULT:");
    console.dir(result, { depth: null });
  } catch (error: any) {
    console.log("TOPUP ERROR MESSAGE:");
    console.log(error?.message);

    console.log("TOPUP ERROR OBJECT:");
    console.dir(error, { depth: null });

    console.log("TOPUP ERROR KEYS:");
    console.dir(Object.getOwnPropertyNames(error || {}), { depth: null });

    if (error?.data) {
      console.log("TOPUP ERROR DATA:");
      console.dir(error.data, { depth: null });
    }

    process.exit(1);
  }
}

main();