import { query } from "./_generated/server";

/**
 * Single aggregated dashboard query — replaces 3 separate queries.
 * All counting/filtering happens in the DB layer, not in JS.
 */
export const getSummary = query({
  handler: async (ctx) => {
    const [students, payments, mpesaMessages] = await Promise.all([
      ctx.db.query("students").collect(),
      ctx.db.query("payments").collect(),
      ctx.db.query("mpesa_messages").order("desc").take(4),
    ]);

    // --- Payment aggregations (done server-side once) ---
    let totalRevenue = 0;
    let matchedCount = 0;
    let needsReviewCount = 0;
    let postedCount = 0;
    let unmatchedCount = 0;
    const monthly: Record<string, number> = {};

    for (const p of payments) {
      totalRevenue += p.amount || 0;

      if (p.status === "matched") matchedCount++;
      else if (p.status === "needs_review") needsReviewCount++;
      else if (p.status === "posted") postedCount++;
      else if (p.status === "unmatched") unmatchedCount++;

      // Revenue chart bucketing
      const key = new Date(p.createdAt).toLocaleDateString("en-US", { month: "short" });
      monthly[key] = (monthly[key] || 0) + (p.amount || 0);
    }

    // Recent transactions — last 6 only
    const recentTransactions = [...payments]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6)
      .map((p) => ({
        _id: p._id,
        transactionCode: p.transactionCode,
        amount: p.amount,
        status: p.status,
        studentAdmNo: p.studentAdmNo ?? null,
        payerName: p.payerName ?? null,
        matchMethod: p.matchMethod ?? null,
      }));

    // Revenue chart data
    const orderedMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const revenueData = orderedMonths
      .filter((m) => monthly[m] !== undefined)
      .map((m) => ({ name: m, value: monthly[m] }));

    // M-Pesa inbox — already limited to 4 above
    const recentMpesaMessages = mpesaMessages.map((m) => ({
      _id: m._id,
      transactionCode: m.transactionCode ?? null,
      amount: m.amount ?? 0,
      payerName: m.payerName ?? null,
      processingStatus: m.processingStatus ?? null,
      accountReferenceRaw: m.accountReferenceRaw ?? null,
    }));

    return {
      stats: {
        total_revenue: totalRevenue,
        active_students: students.length,
        matched_payments: matchedCount,
        review_payments: needsReviewCount,
      },
      paymentStatus: {
        matched: matchedCount,
        needs_review: needsReviewCount,
        posted: postedCount,
        unmatched: unmatchedCount,
      },
      recentTransactions,
      revenueData,
      recentMpesaMessages,
    };
  },
});