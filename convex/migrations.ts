import { mutation } from "./_generated/server";

export const backfillStudentWalletFields = mutation({
  args: {},
  handler: async (ctx) => {
    const students = await ctx.db.query("students").collect();
    const now = new Date().toISOString();

    let updatedCount = 0;

    for (const student of students) {
      const patch: Record<string, any> = {};
      let shouldPatch = false;

      if (typeof student.currentPoints !== "number") {
        patch.currentPoints = 0;
        shouldPatch = true;
      }

      if (typeof student.debtBalance !== "number") {
        patch.debtBalance = 0;
        shouldPatch = true;
      }

      if (typeof student.debtLimit !== "number") {
        patch.debtLimit = 200;
        shouldPatch = true;
      }

      if (typeof student.lowBalanceThreshold !== "number") {
        patch.lowBalanceThreshold = 100;
        shouldPatch = true;
      }

      if (shouldPatch) {
        patch.updatedAt = now;
        await ctx.db.patch(student._id, patch);
        updatedCount += 1;
      }
    }

    return {
      ok: true,
      updatedCount,
      totalStudents: students.length,
    };
  },
});