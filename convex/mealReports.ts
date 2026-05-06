import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const campusValidator = v.union(
  v.literal("MAIN_SCHOOL"),
  v.literal("DIGITAL_SCHOOL")
);

const mealCategoryValidator = v.union(
  v.literal("LUNCH"),
  v.literal("TEA"),
  v.literal("SNACK"),
  v.literal("FRUIT"),
  v.literal("OTHER")
);

function now() {
  return new Date().toISOString();
}

function makeReportNumber() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);

  const random = Math.floor(Math.random() * 9000) + 1000;

  return `WR-${stamp}-${random}`;
}

function normalizeDate(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

function isDateInRange(value: string | null | undefined, start: string, end: string) {
  const date = normalizeDate(value);
  return date >= start && date <= end;
}

function safeMargin(profit: number, revenue: number) {
  if (revenue <= 0) return 0;
  return (profit / revenue) * 100;
}

async function createActivityLog(
  ctx: any,
  args: {
    actionType: "WEEKLY_REPORT_GENERATED" | "PROFIT_LOSS_REVIEWED";
    actor?: string | null;
    details?: string | null;
    sourceCampusCode?: "MAIN_SCHOOL" | "DIGITAL_SCHOOL" | null;
    targetCampusCode?: "MAIN_SCHOOL" | "DIGITAL_SCHOOL" | null;
    amount?: number | null;
  }
) {
  await ctx.db.insert("activityLogs", {
    actionType: args.actionType,

    studentId: null,
    studentAdmNo: null,
    studentNameSnapshot: null,
    classSnapshot: null,

    itemName: null,
    points: null,
    receiptReference: null,

    actor: args.actor ?? null,
    details: args.details ?? null,

    orderId: null,
    inventoryItemId: null,
    purchaseBatchId: null,
    kitchenIssueId: null,
    kitchenClosingId: null,

    sourceCampusCode: args.sourceCampusCode ?? null,
    targetCampusCode: args.targetCampusCode ?? null,

    quantity: null,
    amount: args.amount ?? null,

    createdAt: now(),
  });
}

/**
 * Internal calculator used by previewWeeklyReport and generateWeeklyReport.
 */
async function calculateWeeklyReport(
  ctx: any,
  args: {
    campusCode: "MAIN_SCHOOL" | "DIGITAL_SCHOOL";
    weekStartDate: string;
    weekEndDate: string;
  }
) {
  const { campusCode, weekStartDate, weekEndDate } = args;

  /**
   * 1. Approved purchases for the week.
   * This represents shopping cost that entered stock.
   */
  const purchaseBatches = await ctx.db
    .query("purchaseBatches")
    .withIndex("by_campusCode", (q: any) => q.eq("campusCode", campusCode))
    .collect();

  const approvedPurchaseBatches = purchaseBatches.filter(
    (batch: any) =>
      batch.receiptStatus === "APPROVED" &&
      batch.weekStartDate === weekStartDate &&
      batch.weekEndDate === weekEndDate
  );

  const totalPurchasesCost = approvedPurchaseBatches.reduce(
    (sum: number, batch: any) => sum + (batch.totalAmount ?? 0),
    0
  );

  /**
   * 2. Stock issued from store to kitchen.
   * This is usually the better cost basis for the weekly meal operation.
   */
  const kitchenMovements = await ctx.db
    .query("inventoryMovements")
    .withIndex("by_createdAt")
    .collect();

  const weeklyKitchenIssueMovements = kitchenMovements.filter(
    (movement: any) =>
      movement.movementType === "KITCHEN_ISSUE" &&
      movement.sourceCampusCode === campusCode &&
      isDateInRange(movement.createdAt, weekStartDate, weekEndDate)
  );

  const totalKitchenIssuedCost = weeklyKitchenIssueMovements.reduce(
    (sum: number, movement: any) => sum + Math.abs(movement.totalCost ?? 0),
    0
  );

  /**
   * 3. Daily closings: served counts, leftovers, and waste.
   */
  const closings = await ctx.db
    .query("dailyKitchenClosings")
    .withIndex("by_campusCode", (q: any) => q.eq("campusCode", campusCode))
    .collect();

  const weeklyClosings = closings.filter((closing: any) =>
    isDateInRange(closing.closingDate, weekStartDate, weekEndDate)
  );

  const closingIds = new Set(weeklyClosings.map((closing: any) => closing._id));

  const allClosingItems = await ctx.db.query("dailyKitchenClosingItems").collect();

  const weeklyClosingItems = allClosingItems.filter((item: any) =>
    closingIds.has(item.closingId)
  );

  const totalWasteCost = weeklyClosingItems.reduce(
    (sum: number, item: any) => sum + (item.wasteCost ?? 0),
    0
  );

  const totalLeftoverValue = weeklyClosingItems.reduce(
    (sum: number, item: any) => sum + (item.leftoverValue ?? 0),
    0
  );

  const closingServedCounts = weeklyClosings.reduce(
    (
      acc: {
        lunchServedCount: number;
        teaServedCount: number;
        snackServedCount: number;
        fruitServedCount: number;
      },
      closing: any
    ) => {
      acc.lunchServedCount += closing.lunchServedCount ?? 0;
      acc.teaServedCount += closing.teaServedCount ?? 0;
      acc.snackServedCount += closing.snackServedCount ?? 0;
      acc.fruitServedCount += closing.fruitServedCount ?? 0;
      return acc;
    },
    {
      lunchServedCount: 0,
      teaServedCount: 0,
      snackServedCount: 0,
      fruitServedCount: 0,
    }
  );

  /**
   * 4. Meal history: actual student consumption and points revenue.
   * We filter by student campus because mealHistory itself does not store campus.
   */
  const mealHistory = await ctx.db
    .query("mealHistory")
    .withIndex("by_servedAt")
    .collect();

  const weeklyMealRows = mealHistory.filter((row: any) =>
    isDateInRange(row.servedAt ?? row.createdAt, weekStartDate, weekEndDate)
  );

  const campusMealRows: any[] = [];

  for (const row of weeklyMealRows) {
    const student = await ctx.db.get(row.studentId);

    if (student && student.school === campusCode) {
      campusMealRows.push(row);
    }
  }

  const mealCountsFromHistory = campusMealRows.reduce(
    (
      acc: {
        lunchServedCount: number;
        teaServedCount: number;
        snackServedCount: number;
        fruitServedCount: number;
        otherServedCount: number;
        estimatedRevenue: number;
        byCategory: Record<
          string,
          {
            count: number;
            revenue: number;
          }
        >;
      },
      row: any
    ) => {
      const category = row.itemCategory ?? "OTHER";
      const points = row.pointsCost ?? 0;

      if (!acc.byCategory[category]) {
        acc.byCategory[category] = {
          count: 0,
          revenue: 0,
        };
      }

      acc.byCategory[category].count += 1;
      acc.byCategory[category].revenue += points;

      if (category === "LUNCH") acc.lunchServedCount += 1;
      else if (category === "TEA") acc.teaServedCount += 1;
      else if (category === "SNACK") acc.snackServedCount += 1;
      else if (category === "FRUIT") acc.fruitServedCount += 1;
      else acc.otherServedCount += 1;

      acc.estimatedRevenue += points;

      return acc;
    },
    {
      lunchServedCount: 0,
      teaServedCount: 0,
      snackServedCount: 0,
      fruitServedCount: 0,
      otherServedCount: 0,
      estimatedRevenue: 0,
      byCategory: {},
    }
  );

  /**
   * Prefer mealHistory counts because they are based on real served students.
   * If mealHistory has no rows, fall back to daily kitchen closing counts.
   */
  const hasMealHistoryRows = campusMealRows.length > 0;

  const lunchServedCount = hasMealHistoryRows
    ? mealCountsFromHistory.lunchServedCount
    : closingServedCounts.lunchServedCount;

  const teaServedCount = hasMealHistoryRows
    ? mealCountsFromHistory.teaServedCount
    : closingServedCounts.teaServedCount;

  const snackServedCount = hasMealHistoryRows
    ? mealCountsFromHistory.snackServedCount
    : closingServedCounts.snackServedCount;

  const fruitServedCount = hasMealHistoryRows
    ? mealCountsFromHistory.fruitServedCount
    : closingServedCounts.fruitServedCount;

  const estimatedRevenue = mealCountsFromHistory.estimatedRevenue;

  /**
   * Cost basis:
   * - If kitchen issue cost exists, use it.
   * - Otherwise fall back to total purchases cost.
   *
   * Waste cost is included as part of the operational loss picture.
   * Leftover value is shown separately and offsets cost in the "net consumed cost".
   */
  const primaryCostBasis =
    totalKitchenIssuedCost > 0 ? totalKitchenIssuedCost : totalPurchasesCost;

  const estimatedConsumedCost = Math.max(
    primaryCostBasis + totalWasteCost - totalLeftoverValue,
    0
  );

  const estimatedGrossProfit = estimatedRevenue - estimatedConsumedCost;
  const estimatedGrossMargin = safeMargin(estimatedGrossProfit, estimatedRevenue);

  /**
   * 5. Low stock alerts.
   */
  const inventoryItems = await ctx.db
    .query("inventoryItems")
    .withIndex("by_campusCode", (q: any) => q.eq("campusCode", campusCode))
    .collect();

  const lowStockItems = inventoryItems.filter(
    (item: any) => item.isActive && item.currentStock <= item.reorderLevel
  );

  /**
   * 6. Price change alerts.
   * For each item, compare the latest approved unit cost this week against
   * the previous approved unit cost before the current week.
   */
  const purchaseItems = await ctx.db.query("purchaseItems").collect();

  const approvedBatchMap = new Map(
    approvedPurchaseBatches.map((batch: any) => [batch._id, batch])
  );

  const allApprovedBatchesForCampus = purchaseBatches.filter(
    (batch: any) => batch.receiptStatus === "APPROVED"
  );

  const allApprovedBatchMap = new Map(
    allApprovedBatchesForCampus.map((batch: any) => [batch._id, batch])
  );

  const priceAlerts: string[] = [];

  for (const inventoryItem of inventoryItems) {
    const itemPurchaseRows = purchaseItems
      .filter((item: any) => item.inventoryItemId === inventoryItem._id)
      .map((item: any) => ({
        ...item,
        batch: allApprovedBatchMap.get(item.purchaseBatchId),
      }))
      .filter((item: any) => item.batch);

    const currentWeekRows = itemPurchaseRows.filter(
      (item: any) =>
        item.batch.weekStartDate === weekStartDate &&
        item.batch.weekEndDate === weekEndDate
    );

    const previousRows = itemPurchaseRows.filter(
      (item: any) => item.batch.weekStartDate < weekStartDate
    );

    if (currentWeekRows.length === 0 || previousRows.length === 0) continue;

    const latestCurrent = currentWeekRows.sort(
      (a: any, b: any) =>
        normalizeDate(b.batch.shoppingDate).localeCompare(
          normalizeDate(a.batch.shoppingDate)
        )
    )[0];

    const latestPrevious = previousRows.sort(
      (a: any, b: any) =>
        normalizeDate(b.batch.shoppingDate).localeCompare(
          normalizeDate(a.batch.shoppingDate)
        )
    )[0];

    if (!latestCurrent || !latestPrevious) continue;

    const previousCost = latestPrevious.unitCost;
    const currentCost = latestCurrent.unitCost;

    if (previousCost <= 0) continue;

    const percentChange = ((currentCost - previousCost) / previousCost) * 100;

    if (Math.abs(percentChange) >= 10) {
      const direction = percentChange > 0 ? "increased" : "decreased";

      priceAlerts.push(
        `${inventoryItem.name} unit cost ${direction} by ${Math.abs(
          percentChange
        ).toFixed(1)}% (${previousCost.toFixed(2)} → ${currentCost.toFixed(2)}).`
      );
    }
  }

  /**
   * 7. General alerts.
   */
  const alerts: string[] = [];

  if (estimatedRevenue === 0) {
    alerts.push(
      "No meal revenue was found from meal history for this week. Confirm meal serving records are being created."
    );
  }

  if (totalKitchenIssuedCost === 0 && totalPurchasesCost > 0) {
    alerts.push(
      "Purchases were recorded, but no store-to-kitchen issue cost was found. Profit/loss is using purchase cost as a fallback."
    );
  }

  if (totalKitchenIssuedCost === 0 && totalPurchasesCost === 0) {
    alerts.push(
      "No approved purchase cost or kitchen issue cost was found for this week."
    );
  }

  if (totalWasteCost > 0 && primaryCostBasis > 0) {
    const wastePercent = (totalWasteCost / primaryCostBasis) * 100;

    if (wastePercent >= 5) {
      alerts.push(
        `Waste cost is ${wastePercent.toFixed(
          1
        )}% of the weekly cost basis. Review kitchen waste records.`
      );
    }
  }

  if (estimatedGrossProfit < 0) {
    alerts.push(
      `Estimated loss detected: ${Math.abs(estimatedGrossProfit).toFixed(
        2
      )}. Costs exceeded revenue this week.`
    );
  }

  if (estimatedGrossMargin > 0 && estimatedGrossMargin < 15) {
    alerts.push(
      `Low gross margin detected: ${estimatedGrossMargin.toFixed(
        1
      )}%. Review pricing, portions, purchases, and waste.`
    );
  }

  for (const item of lowStockItems.slice(0, 10)) {
    alerts.push(
      `${item.name} is below reorder level. Current: ${item.currentStock} ${item.unit}, reorder level: ${item.reorderLevel} ${item.unit}.`
    );
  }

  alerts.push(...priceAlerts.slice(0, 10));

  /**
   * 8. Basic management summary.
   * Later, AI can rewrite this into a polished report.
   */
  const aiSummary =
    `Weekly meal operations report for ${campusCode} from ${weekStartDate} to ${weekEndDate}. ` +
    `Estimated revenue was ${estimatedRevenue.toFixed(2)}. ` +
    `Estimated consumed cost was ${estimatedConsumedCost.toFixed(2)}. ` +
    `Estimated gross profit was ${estimatedGrossProfit.toFixed(2)}, with a margin of ${estimatedGrossMargin.toFixed(1)}%. ` +
    `Total purchases approved were ${totalPurchasesCost.toFixed(2)}, kitchen issue cost was ${totalKitchenIssuedCost.toFixed(2)}, waste cost was ${totalWasteCost.toFixed(2)}, and leftover value was ${totalLeftoverValue.toFixed(2)}. ` +
    `Lunch served: ${lunchServedCount}, tea served: ${teaServedCount}, snacks served: ${snackServedCount}, fruit served: ${fruitServedCount}.`;

  return {
    campusCode,
    weekStartDate,
    weekEndDate,

    totalPurchasesCost,
    totalKitchenIssuedCost,
    totalWasteCost,
    totalLeftoverValue,

    estimatedConsumedCost,

    lunchServedCount,
    teaServedCount,
    snackServedCount,
    fruitServedCount,

    estimatedRevenue,
    estimatedGrossProfit,
    estimatedGrossMargin,

    mealHistoryRowCount: campusMealRows.length,
    dailyClosingCount: weeklyClosings.length,
    purchaseBatchCount: approvedPurchaseBatches.length,
    kitchenIssueMovementCount: weeklyKitchenIssueMovements.length,

    mealRevenueByCategory: mealCountsFromHistory.byCategory,

    lowStockItems: lowStockItems.map((item: any) => ({
      _id: item._id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      currentStock: item.currentStock,
      reorderLevel: item.reorderLevel,
      shortage: Math.max(item.reorderLevel - item.currentStock, 0),
    })),

    alerts,
    aiSummary,
  };
}

/**
 * 🔹 PREVIEW WEEKLY REPORT
 *
 * Calculates the report without saving it.
 */
export const previewWeeklyReport = query({
  args: {
    campusCode: campusValidator,
    weekStartDate: v.string(),
    weekEndDate: v.string(),
  },

  handler: async (ctx, args) => {
    return await calculateWeeklyReport(ctx, args);
  },
});

/**
 * 🔹 GENERATE / SAVE WEEKLY REPORT
 *
 * Saves the calculated report to weeklyMealReports.
 * If one already exists for campus + weekStartDate, it updates it instead of creating duplicates.
 */
export const generateWeeklyReport = mutation({
  args: {
    campusCode: campusValidator,
    weekStartDate: v.string(),
    weekEndDate: v.string(),
    generatedByUserId: v.id("appUsers"),
    actor: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const calculated = await calculateWeeklyReport(ctx, {
      campusCode: args.campusCode,
      weekStartDate: args.weekStartDate,
      weekEndDate: args.weekEndDate,
    });

    const existingReport = await ctx.db
      .query("weeklyMealReports")
      .withIndex("by_campusCode_and_weekStartDate", (q) =>
        q
          .eq("campusCode", args.campusCode)
          .eq("weekStartDate", args.weekStartDate)
      )
      .first();

    const savedAt = now();

    if (existingReport) {
      await ctx.db.patch(existingReport._id, {
        weekEndDate: args.weekEndDate,

        totalPurchasesCost: calculated.totalPurchasesCost,
        totalKitchenIssuedCost: calculated.totalKitchenIssuedCost,
        totalWasteCost: calculated.totalWasteCost,
        totalLeftoverValue: calculated.totalLeftoverValue,

        lunchServedCount: calculated.lunchServedCount,
        teaServedCount: calculated.teaServedCount,
        snackServedCount: calculated.snackServedCount,
        fruitServedCount: calculated.fruitServedCount,

        estimatedRevenue: calculated.estimatedRevenue,
        estimatedGrossProfit: calculated.estimatedGrossProfit,
        estimatedGrossMargin: calculated.estimatedGrossMargin,

        aiSummary: calculated.aiSummary,
        alerts: calculated.alerts,

        generatedByUserId: args.generatedByUserId,

        updatedAt: savedAt,
      });

      await createActivityLog(ctx, {
        actionType: "WEEKLY_REPORT_GENERATED",
        actor: args.actor ?? null,
        details: `Updated weekly meal report ${existingReport.reportNumber} for ${args.campusCode} from ${args.weekStartDate} to ${args.weekEndDate}.`,
        sourceCampusCode: args.campusCode,
        targetCampusCode: args.campusCode,
        amount: calculated.estimatedGrossProfit,
      });

      return {
        success: true,
        reportId: existingReport._id,
        reportNumber: existingReport.reportNumber,
        mode: "UPDATED",
        ...calculated,
      };
    }

    const reportNumber = makeReportNumber();

    const reportId = await ctx.db.insert("weeklyMealReports", {
      reportNumber,

      campusCode: args.campusCode,

      weekStartDate: args.weekStartDate,
      weekEndDate: args.weekEndDate,

      totalPurchasesCost: calculated.totalPurchasesCost,
      totalKitchenIssuedCost: calculated.totalKitchenIssuedCost,
      totalWasteCost: calculated.totalWasteCost,
      totalLeftoverValue: calculated.totalLeftoverValue,

      lunchServedCount: calculated.lunchServedCount,
      teaServedCount: calculated.teaServedCount,
      snackServedCount: calculated.snackServedCount,
      fruitServedCount: calculated.fruitServedCount,

      estimatedRevenue: calculated.estimatedRevenue,
      estimatedGrossProfit: calculated.estimatedGrossProfit,
      estimatedGrossMargin: calculated.estimatedGrossMargin,

      aiSummary: calculated.aiSummary,
      alerts: calculated.alerts,

      generatedByUserId: args.generatedByUserId,

      createdAt: savedAt,
      updatedAt: savedAt,
    });

    await createActivityLog(ctx, {
      actionType: "WEEKLY_REPORT_GENERATED",
      actor: args.actor ?? null,
      details: `Generated weekly meal report ${reportNumber} for ${args.campusCode} from ${args.weekStartDate} to ${args.weekEndDate}.`,
      sourceCampusCode: args.campusCode,
      targetCampusCode: args.campusCode,
      amount: calculated.estimatedGrossProfit,
    });

    return {
      success: true,
      reportId,
      reportNumber,
      mode: "CREATED",
      ...calculated,
    };
  },
});

/**
 * 🔹 LIST SAVED WEEKLY REPORTS
 */
export const listWeeklyReports = query({
  args: {
    campusCode: v.optional(campusValidator),
    weekStartDate: v.optional(v.string()),
    limit: v.optional(v.number()),
  },

  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 100, 300);

    let reports;

    if (args.campusCode) {
      reports = await ctx.db
        .query("weeklyMealReports")
        .withIndex("by_campusCode", (q) => q.eq("campusCode", args.campusCode!))
        .order("desc")
        .take(limit);
    } else if (args.weekStartDate) {
      reports = await ctx.db
        .query("weeklyMealReports")
        .withIndex("by_weekStartDate", (q) =>
          q.eq("weekStartDate", args.weekStartDate!)
        )
        .order("desc")
        .take(limit);
    } else {
      reports = await ctx.db
        .query("weeklyMealReports")
        .order("desc")
        .take(limit);
    }

    if (args.campusCode) {
      reports = reports.filter((report) => report.campusCode === args.campusCode);
    }

    if (args.weekStartDate) {
      reports = reports.filter(
        (report) => report.weekStartDate === args.weekStartDate
      );
    }

    return await Promise.all(
      reports.map(async (report) => {
        const generatedBy = await ctx.db.get(report.generatedByUserId);

        return {
          ...report,
          generatedByName: generatedBy?.name ?? "Unknown",
          profitStatus:
            report.estimatedGrossProfit > 0
              ? "PROFIT"
              : report.estimatedGrossProfit < 0
                ? "LOSS"
                : "BREAK_EVEN",
        };
      })
    );
  },
});

/**
 * 🔹 GET ONE SAVED WEEKLY REPORT
 */
export const getWeeklyReport = query({
  args: {
    reportId: v.id("weeklyMealReports"),
  },

  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);

    if (!report) return null;

    const generatedBy = await ctx.db.get(report.generatedByUserId);

    return {
      ...report,
      generatedByName: generatedBy?.name ?? "Unknown",
      profitStatus:
        report.estimatedGrossProfit > 0
          ? "PROFIT"
          : report.estimatedGrossProfit < 0
            ? "LOSS"
            : "BREAK_EVEN",
    };
  },
});

/**
 * 🔹 GET REPORT BY CAMPUS + WEEK
 */
export const getWeeklyReportByWeek = query({
  args: {
    campusCode: campusValidator,
    weekStartDate: v.string(),
  },

  handler: async (ctx, args) => {
    const report = await ctx.db
      .query("weeklyMealReports")
      .withIndex("by_campusCode_and_weekStartDate", (q) =>
        q
          .eq("campusCode", args.campusCode)
          .eq("weekStartDate", args.weekStartDate)
      )
      .first();

    if (!report) return null;

    const generatedBy = await ctx.db.get(report.generatedByUserId);

    return {
      ...report,
      generatedByName: generatedBy?.name ?? "Unknown",
      profitStatus:
        report.estimatedGrossProfit > 0
          ? "PROFIT"
          : report.estimatedGrossProfit < 0
            ? "LOSS"
            : "BREAK_EVEN",
    };
  },
});

/**
 * 🔹 MARK REPORT AS REVIEWED
 */
export const markReportReviewed = mutation({
  args: {
    reportId: v.id("weeklyMealReports"),
    actor: v.optional(v.string()),
    notes: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);

    if (!report) {
      throw new Error("Weekly report not found.");
    }

    await createActivityLog(ctx, {
      actionType: "PROFIT_LOSS_REVIEWED",
      actor: args.actor ?? null,
      details:
        args.notes?.trim() ||
        `Reviewed profit/loss report ${report.reportNumber}`,
      sourceCampusCode: report.campusCode,
      targetCampusCode: report.campusCode,
      amount: report.estimatedGrossProfit,
    });

    return {
      success: true,
      reportId: args.reportId,
    };
  },
});

/**
 * 🔹 ITEM PROFIT / COST BREAKDOWN FOR A WEEK
 *
 * This gives a category-level report:
 * Lunch, Tea, Snack, Fruit, Other.
 */
export const getWeeklyCategoryBreakdown = query({
  args: {
    campusCode: campusValidator,
    weekStartDate: v.string(),
    weekEndDate: v.string(),
  },

  handler: async (ctx, args) => {
    const calculated = await calculateWeeklyReport(ctx, args);

    const kitchenMovements = await ctx.db
      .query("inventoryMovements")
      .withIndex("by_createdAt")
      .collect();

    const weeklyKitchenIssueMovements = kitchenMovements.filter(
      (movement: any) =>
        movement.movementType === "KITCHEN_ISSUE" &&
        movement.sourceCampusCode === args.campusCode &&
        isDateInRange(movement.createdAt, args.weekStartDate, args.weekEndDate)
    );

    const categoryCostMap: Record<string, number> = {};

    for (const movement of weeklyKitchenIssueMovements) {
      const inventoryItem = await ctx.db.get(movement.inventoryItemId);

      if (!inventoryItem) continue;

      const category = inventoryItem.category ?? "OTHER";

      categoryCostMap[category] =
        (categoryCostMap[category] ?? 0) + Math.abs(movement.totalCost ?? 0);
    }

    const categories = ["LUNCH", "TEA", "SNACK", "FRUIT", "OTHER"];

    return categories.map((category) => {
      const revenue = calculated.mealRevenueByCategory[category]?.revenue ?? 0;
      const servedCount = calculated.mealRevenueByCategory[category]?.count ?? 0;
      const cost = categoryCostMap[category] ?? 0;
      const profit = revenue - cost;
      const margin = safeMargin(profit, revenue);

      return {
        category,
        servedCount,
        revenue,
        cost,
        profit,
        margin,
        status: profit > 0 ? "PROFIT" : profit < 0 ? "LOSS" : "BREAK_EVEN",
      };
    });
  },
});