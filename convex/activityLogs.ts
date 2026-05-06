import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const campusValidator = v.union(
  v.literal("MAIN_SCHOOL"),
  v.literal("DIGITAL_SCHOOL")
);

const actionTypeValidator = v.union(
  // Existing student/wallet/meal actions
  v.literal("PRINT_MEAL_PASS"),
  v.literal("POST_PAYMENT"),
  v.literal("MANUAL_PAYMENT_ATTACH"),
  v.literal("SERVE_MEAL"),
  v.literal("WALLET_ADJUSTMENT"),

  // Campus order actions
  v.literal("ORDER_CREATED"),
  v.literal("ORDER_APPROVED"),
  v.literal("ORDER_PARTIALLY_APPROVED"),
  v.literal("ORDER_REJECTED"),
  v.literal("ORDER_PACKED"),
  v.literal("ORDER_DISPATCHED"),
  v.literal("ORDER_RECEIVED"),
  v.literal("ORDER_CANCELLED"),

  // Inventory actions
  v.literal("INVENTORY_ITEM_CREATED"),
  v.literal("INVENTORY_STOCK_IN"),
  v.literal("INVENTORY_DISPATCH_OUT"),
  v.literal("INVENTORY_RECEIPT_IN"),
  v.literal("INVENTORY_ADJUSTMENT"),
  v.literal("INVENTORY_KITCHEN_ISSUE"),
  v.literal("INVENTORY_WASTE_RECORDED"),
  v.literal("INVENTORY_LEFTOVER_RETURNED"),

  // Purchase / receipt actions
  v.literal("PURCHASE_BATCH_CREATED"),
  v.literal("PURCHASE_RECEIPT_UPLOADED"),
  v.literal("PURCHASE_RECEIPT_AI_EXTRACTED"),
  v.literal("PURCHASE_ITEM_MANUAL_ENTRY"),
  v.literal("PURCHASE_BATCH_APPROVED"),
  v.literal("PURCHASE_BATCH_REJECTED"),

  // Kitchen actions
  v.literal("KITCHEN_ISSUE_CREATED"),
  v.literal("KITCHEN_ISSUE_RECEIVED"),
  v.literal("KITCHEN_CLOSING_SUBMITTED"),

  // Reports
  v.literal("WEEKLY_REPORT_GENERATED"),
  v.literal("PROFIT_LOSS_REVIEWED")
);

/**
 * 🔹 CREATE ACTIVITY LOG
 *
 * Use this when you want to manually log an event from frontend or another flow.
 * Other backend modules can also insert directly into activityLogs.
 */
export const create = mutation({
  args: {
    actionType: actionTypeValidator,

    studentId: v.optional(v.union(v.id("students"), v.null())),
    studentAdmNo: v.optional(v.union(v.string(), v.null())),
    studentNameSnapshot: v.optional(v.union(v.string(), v.null())),
    classSnapshot: v.optional(v.union(v.string(), v.null())),

    itemName: v.optional(v.union(v.string(), v.null())),
    points: v.optional(v.union(v.number(), v.null())),
    receiptReference: v.optional(v.union(v.string(), v.null())),

    actor: v.optional(v.union(v.string(), v.null())),
    details: v.optional(v.union(v.string(), v.null())),

    orderId: v.optional(v.union(v.id("campusOrders"), v.null())),
    inventoryItemId: v.optional(v.union(v.id("inventoryItems"), v.null())),
    purchaseBatchId: v.optional(v.union(v.id("purchaseBatches"), v.null())),
    kitchenIssueId: v.optional(v.union(v.id("kitchenIssues"), v.null())),
    kitchenClosingId: v.optional(v.union(v.id("dailyKitchenClosings"), v.null())),

    sourceCampusCode: v.optional(v.union(campusValidator, v.null())),
    targetCampusCode: v.optional(v.union(campusValidator, v.null())),

    quantity: v.optional(v.union(v.number(), v.null())),
    amount: v.optional(v.union(v.number(), v.null())),
  },

  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    const logId = await ctx.db.insert("activityLogs", {
      actionType: args.actionType,

      studentId: args.studentId ?? null,
      studentAdmNo: args.studentAdmNo ?? null,
      studentNameSnapshot: args.studentNameSnapshot ?? null,
      classSnapshot: args.classSnapshot ?? null,

      itemName: args.itemName ?? null,
      points: args.points ?? null,
      receiptReference: args.receiptReference ?? null,

      actor: args.actor ?? null,
      details: args.details ?? null,

      orderId: args.orderId ?? null,
      inventoryItemId: args.inventoryItemId ?? null,
      purchaseBatchId: args.purchaseBatchId ?? null,
      kitchenIssueId: args.kitchenIssueId ?? null,
      kitchenClosingId: args.kitchenClosingId ?? null,

      sourceCampusCode: args.sourceCampusCode ?? null,
      targetCampusCode: args.targetCampusCode ?? null,

      quantity: args.quantity ?? null,
      amount: args.amount ?? null,

      createdAt: now,
    });

    return {
      success: true,
      logId,
    };
  },
});

/**
 * 🔹 LIST ACTIVITY LOGS
 */
export const list = query({
  args: {
    actionType: v.optional(actionTypeValidator),
    studentId: v.optional(v.id("students")),
    orderId: v.optional(v.id("campusOrders")),
    inventoryItemId: v.optional(v.id("inventoryItems")),
    purchaseBatchId: v.optional(v.id("purchaseBatches")),
    kitchenIssueId: v.optional(v.id("kitchenIssues")),
    kitchenClosingId: v.optional(v.id("dailyKitchenClosings")),
    limit: v.optional(v.number()),
  },

  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 100, 300);

    let logs;

    if (args.actionType) {
      logs = await ctx.db
        .query("activityLogs")
        .withIndex("by_actionType", (q) => q.eq("actionType", args.actionType!))
        .order("desc")
        .take(limit);
    } else if (args.studentId) {
      logs = await ctx.db
        .query("activityLogs")
        .withIndex("by_studentId", (q) => q.eq("studentId", args.studentId!))
        .order("desc")
        .take(limit);
    } else if (args.orderId) {
      logs = await ctx.db
        .query("activityLogs")
        .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId!))
        .order("desc")
        .take(limit);
    } else if (args.inventoryItemId) {
      logs = await ctx.db
        .query("activityLogs")
        .withIndex("by_inventoryItemId", (q) =>
          q.eq("inventoryItemId", args.inventoryItemId!)
        )
        .order("desc")
        .take(limit);
    } else if (args.purchaseBatchId) {
      logs = await ctx.db
        .query("activityLogs")
        .withIndex("by_purchaseBatchId", (q) =>
          q.eq("purchaseBatchId", args.purchaseBatchId!)
        )
        .order("desc")
        .take(limit);
    } else if (args.kitchenIssueId) {
      logs = await ctx.db
        .query("activityLogs")
        .withIndex("by_kitchenIssueId", (q) =>
          q.eq("kitchenIssueId", args.kitchenIssueId!)
        )
        .order("desc")
        .take(limit);
    } else if (args.kitchenClosingId) {
      logs = await ctx.db
        .query("activityLogs")
        .withIndex("by_kitchenClosingId", (q) =>
          q.eq("kitchenClosingId", args.kitchenClosingId!)
        )
        .order("desc")
        .take(limit);
    } else {
      logs = await ctx.db
        .query("activityLogs")
        .withIndex("by_createdAt")
        .order("desc")
        .take(limit);
    }

    return logs;
  },
});

/**
 * 🔹 GET LOGS FOR ONE STUDENT BY ADMISSION NUMBER
 */
export const listByStudentAdmNo = query({
  args: {
    studentAdmNo: v.string(),
    limit: v.optional(v.number()),
  },

  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 100, 300);

    return await ctx.db
      .query("activityLogs")
      .withIndex("by_studentAdmNo", (q) =>
        q.eq("studentAdmNo", args.studentAdmNo)
      )
      .order("desc")
      .take(limit);
  },
});