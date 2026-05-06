import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const campusValidator = v.union(
  v.literal("MAIN_SCHOOL"),
  v.literal("DIGITAL_SCHOOL")
);

const kitchenPurposeValidator = v.union(
  v.literal("LUNCH_PREP"),
  v.literal("TEA_PREP"),
  v.literal("SNACK_PREP"),
  v.literal("FRUIT_SERVICE"),
  v.literal("DIGITAL_CAMPUS_PACKING"),
  v.literal("OTHER")
);

const kitchenIssueStatusValidator = v.union(
  v.literal("DRAFT"),
  v.literal("ISSUED"),
  v.literal("RECEIVED"),
  v.literal("CANCELLED")
);

function now() {
  return new Date().toISOString();
}

function cleanText(value: string) {
  return value.trim();
}

function makeIssueNumber() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);

  const random = Math.floor(Math.random() * 9000) + 1000;

  return `KI-${stamp}-${random}`;
}

async function createActivityLog(
  ctx: any,
  args: {
    actionType:
      | "KITCHEN_ISSUE_CREATED"
      | "KITCHEN_ISSUE_RECEIVED"
      | "KITCHEN_CLOSING_SUBMITTED"
      | "INVENTORY_KITCHEN_ISSUE"
      | "INVENTORY_WASTE_RECORDED"
      | "INVENTORY_LEFTOVER_RETURNED";
    inventoryItemId?: any;
    kitchenIssueId?: any;
    kitchenClosingId?: any;
    itemName?: string | null;
    actor?: string | null;
    details?: string | null;
    sourceCampusCode?: "MAIN_SCHOOL" | "DIGITAL_SCHOOL" | null;
    targetCampusCode?: "MAIN_SCHOOL" | "DIGITAL_SCHOOL" | null;
    quantity?: number | null;
    amount?: number | null;
  }
) {
  await ctx.db.insert("activityLogs", {
    actionType: args.actionType,

    studentId: null,
    studentAdmNo: null,
    studentNameSnapshot: null,
    classSnapshot: null,

    itemName: args.itemName ?? null,
    points: null,
    receiptReference: null,

    actor: args.actor ?? null,
    details: args.details ?? null,

    orderId: null,
    inventoryItemId: args.inventoryItemId ?? null,
    purchaseBatchId: null,
    kitchenIssueId: args.kitchenIssueId ?? null,
    kitchenClosingId: args.kitchenClosingId ?? null,

    sourceCampusCode: args.sourceCampusCode ?? null,
    targetCampusCode: args.targetCampusCode ?? null,

    quantity: args.quantity ?? null,
    amount: args.amount ?? null,

    createdAt: now(),
  });
}

/**
 * 🔹 CREATE KITCHEN ISSUE
 *
 * This represents store room → kitchen issue.
 * Items are added separately. Stock is deducted when issue is marked ISSUED.
 */
export const createIssue = mutation({
  args: {
    issuedByUserId: v.id("appUsers"),
    receivedByUserId: v.optional(v.union(v.id("appUsers"), v.null())),

    campusCode: campusValidator,
    issueDate: v.string(),
    purpose: kitchenPurposeValidator,

    notes: v.optional(v.string()),
    actor: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const createdAt = now();
    const issueNumber = makeIssueNumber();

    const kitchenIssueId = await ctx.db.insert("kitchenIssues", {
      issueNumber,

      issuedByUserId: args.issuedByUserId,
      receivedByUserId: args.receivedByUserId ?? null,

      campusCode: args.campusCode,
      issueDate: args.issueDate,
      purpose: args.purpose,

      status: "DRAFT",

      notes: args.notes?.trim() || null,

      createdAt,
      updatedAt: createdAt,
    });

    await createActivityLog(ctx, {
      actionType: "KITCHEN_ISSUE_CREATED",
      kitchenIssueId,
      actor: args.actor ?? null,
      details:
        args.notes?.trim() ||
        `Created kitchen issue ${issueNumber} for ${args.campusCode}`,
      sourceCampusCode: args.campusCode,
      targetCampusCode: args.campusCode,
    });

    return {
      success: true,
      kitchenIssueId,
      issueNumber,
    };
  },
});

/**
 * 🔹 ADD ITEM TO KITCHEN ISSUE
 */
export const addIssueItem = mutation({
  args: {
    kitchenIssueId: v.id("kitchenIssues"),
    inventoryItemId: v.id("inventoryItems"),
    quantityIssued: v.number(),
    estimatedUnitCost: v.optional(v.number()),
    actor: v.optional(v.string()),
    notes: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.kitchenIssueId);

    if (!issue) {
      throw new Error("Kitchen issue not found.");
    }

    if (issue.status !== "DRAFT") {
      throw new Error("You can only add items to a draft kitchen issue.");
    }

    const inventoryItem = await ctx.db.get(args.inventoryItemId);

    if (!inventoryItem) {
      throw new Error("Inventory item not found.");
    }

    if (inventoryItem.campusCode !== issue.campusCode) {
      throw new Error(
        `Inventory item belongs to ${inventoryItem.campusCode}, but this kitchen issue is for ${issue.campusCode}.`
      );
    }

    if (args.quantityIssued <= 0) {
      throw new Error("Quantity issued must be greater than zero.");
    }

    const estimatedUnitCost =
      args.estimatedUnitCost ??
      inventoryItem.averageUnitCost ??
      inventoryItem.lastUnitCost ??
      0;

    if (estimatedUnitCost < 0) {
      throw new Error("Estimated unit cost cannot be negative.");
    }

    const createdAt = now();

    const kitchenIssueItemId = await ctx.db.insert("kitchenIssueItems", {
      kitchenIssueId: args.kitchenIssueId,
      inventoryItemId: args.inventoryItemId,

      itemNameSnapshot: inventoryItem.name,
      unitSnapshot: inventoryItem.unit,

      quantityIssued: args.quantityIssued,

      estimatedUnitCost,
      estimatedTotalCost: args.quantityIssued * estimatedUnitCost,

      createdAt,
      updatedAt: createdAt,
    });

    await ctx.db.patch(args.kitchenIssueId, {
      updatedAt: createdAt,
    });

    return {
      success: true,
      kitchenIssueItemId,
    };
  },
});

/**
 * 🔹 UPDATE KITCHEN ISSUE ITEM
 */
export const updateIssueItem = mutation({
  args: {
    kitchenIssueItemId: v.id("kitchenIssueItems"),
    quantityIssued: v.optional(v.number()),
    estimatedUnitCost: v.optional(v.number()),
  },

  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.kitchenIssueItemId);

    if (!item) {
      throw new Error("Kitchen issue item not found.");
    }

    const issue = await ctx.db.get(item.kitchenIssueId);

    if (!issue) {
      throw new Error("Kitchen issue not found.");
    }

    if (issue.status !== "DRAFT") {
      throw new Error("You can only edit items while the issue is still draft.");
    }

    const nextQuantity = args.quantityIssued ?? item.quantityIssued;
    const nextUnitCost = args.estimatedUnitCost ?? item.estimatedUnitCost;

    if (nextQuantity <= 0) {
      throw new Error("Quantity issued must be greater than zero.");
    }

    if (nextUnitCost < 0) {
      throw new Error("Estimated unit cost cannot be negative.");
    }

    await ctx.db.patch(args.kitchenIssueItemId, {
      quantityIssued: nextQuantity,
      estimatedUnitCost: nextUnitCost,
      estimatedTotalCost: nextQuantity * nextUnitCost,
      updatedAt: now(),
    });

    await ctx.db.patch(item.kitchenIssueId, {
      updatedAt: now(),
    });

    return {
      success: true,
      kitchenIssueItemId: args.kitchenIssueItemId,
    };
  },
});

/**
 * 🔹 DELETE KITCHEN ISSUE ITEM
 */
export const deleteIssueItem = mutation({
  args: {
    kitchenIssueItemId: v.id("kitchenIssueItems"),
  },

  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.kitchenIssueItemId);

    if (!item) {
      throw new Error("Kitchen issue item not found.");
    }

    const issue = await ctx.db.get(item.kitchenIssueId);

    if (!issue) {
      throw new Error("Kitchen issue not found.");
    }

    if (issue.status !== "DRAFT") {
      throw new Error("You can only delete items while the issue is still draft.");
    }

    await ctx.db.delete(args.kitchenIssueItemId);

    await ctx.db.patch(item.kitchenIssueId, {
      updatedAt: now(),
    });

    return {
      success: true,
      kitchenIssueItemId: args.kitchenIssueItemId,
    };
  },
});

/**
 * 🔹 ISSUE TO KITCHEN
 *
 * This deducts stock from inventory and records inventory movements.
 */
export const issueToKitchen = mutation({
  args: {
    kitchenIssueId: v.id("kitchenIssues"),
    actor: v.optional(v.string()),
    notes: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.kitchenIssueId);

    if (!issue) {
      throw new Error("Kitchen issue not found.");
    }

    if (issue.status !== "DRAFT") {
      throw new Error("Only draft kitchen issues can be issued.");
    }

    const items = await ctx.db
      .query("kitchenIssueItems")
      .withIndex("by_kitchenIssueId", (q) =>
        q.eq("kitchenIssueId", args.kitchenIssueId)
      )
      .collect();

    if (items.length === 0) {
      throw new Error("Cannot issue to kitchen with no items.");
    }

    for (const issueItem of items) {
      const inventoryItem = await ctx.db.get(issueItem.inventoryItemId);

      if (!inventoryItem) {
        throw new Error(`Inventory item ${issueItem.itemNameSnapshot} not found.`);
      }

      if (issueItem.quantityIssued > inventoryItem.currentStock) {
        throw new Error(
          `Not enough stock for ${inventoryItem.name}. Requested ${issueItem.quantityIssued} ${inventoryItem.unit}, available ${inventoryItem.currentStock} ${inventoryItem.unit}.`
        );
      }
    }

    const issuedAt = now();

    for (const issueItem of items) {
      const inventoryItem = await ctx.db.get(issueItem.inventoryItemId);

      if (!inventoryItem) continue;

      const newStock = inventoryItem.currentStock - issueItem.quantityIssued;
      const unitCost =
        issueItem.estimatedUnitCost ??
        inventoryItem.averageUnitCost ??
        inventoryItem.lastUnitCost ??
        0;

      await ctx.db.patch(issueItem.inventoryItemId, {
        currentStock: newStock,
        updatedAt: issuedAt,
      });

      await ctx.db.insert("inventoryMovements", {
        inventoryItemId: issueItem.inventoryItemId,
        movementType: "KITCHEN_ISSUE",
        quantity: -Math.abs(issueItem.quantityIssued),

        orderId: null,
        purchaseBatchId: null,
        kitchenIssueId: args.kitchenIssueId,
        kitchenClosingId: null,

        sourceCampusCode: issue.campusCode,
        targetCampusCode: issue.campusCode,

        unitCost,
        totalCost: issueItem.quantityIssued * unitCost,

        createdByUserId: issue.issuedByUserId,

        createdAt: issuedAt,
        notes:
          args.notes?.trim() ||
          `Issued to kitchen: ${issueItem.quantityIssued} ${inventoryItem.unit} of ${inventoryItem.name}`,
      });

      await createActivityLog(ctx, {
        actionType: "INVENTORY_KITCHEN_ISSUE",
        kitchenIssueId: args.kitchenIssueId,
        inventoryItemId: issueItem.inventoryItemId,
        itemName: inventoryItem.name,
        actor: args.actor ?? null,
        details:
          args.notes?.trim() ||
          `Issued ${issueItem.quantityIssued} ${inventoryItem.unit} of ${inventoryItem.name} to kitchen`,
        sourceCampusCode: issue.campusCode,
        targetCampusCode: issue.campusCode,
        quantity: issueItem.quantityIssued,
        amount: issueItem.quantityIssued * unitCost,
      });
    }

    await ctx.db.patch(args.kitchenIssueId, {
      status: "ISSUED",
      notes: args.notes?.trim() || issue.notes,
      updatedAt: issuedAt,
    });

    await createActivityLog(ctx, {
      actionType: "KITCHEN_ISSUE_CREATED",
      kitchenIssueId: args.kitchenIssueId,
      actor: args.actor ?? null,
      details:
        args.notes?.trim() ||
        `Issued kitchen issue ${issue.issueNumber} to kitchen`,
      sourceCampusCode: issue.campusCode,
      targetCampusCode: issue.campusCode,
    });

    return {
      success: true,
      kitchenIssueId: args.kitchenIssueId,
      status: "ISSUED",
      itemCount: items.length,
    };
  },
});

/**
 * 🔹 MARK KITCHEN ISSUE AS RECEIVED
 */
export const receiveKitchenIssue = mutation({
  args: {
    kitchenIssueId: v.id("kitchenIssues"),
    receivedByUserId: v.id("appUsers"),
    actor: v.optional(v.string()),
    notes: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.kitchenIssueId);

    if (!issue) {
      throw new Error("Kitchen issue not found.");
    }

    if (issue.status !== "ISSUED") {
      throw new Error("Only issued kitchen stock can be marked as received.");
    }

    const receivedAt = now();

    await ctx.db.patch(args.kitchenIssueId, {
      receivedByUserId: args.receivedByUserId,
      status: "RECEIVED",
      notes: args.notes?.trim() || issue.notes,
      updatedAt: receivedAt,
    });

    await createActivityLog(ctx, {
      actionType: "KITCHEN_ISSUE_RECEIVED",
      kitchenIssueId: args.kitchenIssueId,
      actor: args.actor ?? null,
      details:
        args.notes?.trim() ||
        `Kitchen issue ${issue.issueNumber} received by kitchen`,
      sourceCampusCode: issue.campusCode,
      targetCampusCode: issue.campusCode,
    });

    return {
      success: true,
      kitchenIssueId: args.kitchenIssueId,
      status: "RECEIVED",
    };
  },
});

/**
 * 🔹 CANCEL KITCHEN ISSUE
 */
export const cancelKitchenIssue = mutation({
  args: {
    kitchenIssueId: v.id("kitchenIssues"),
    actor: v.optional(v.string()),
    notes: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.kitchenIssueId);

    if (!issue) {
      throw new Error("Kitchen issue not found.");
    }

    if (issue.status !== "DRAFT") {
      throw new Error("Only draft kitchen issues can be cancelled.");
    }

    await ctx.db.patch(args.kitchenIssueId, {
      status: "CANCELLED",
      notes: args.notes?.trim() || issue.notes,
      updatedAt: now(),
    });

    return {
      success: true,
      kitchenIssueId: args.kitchenIssueId,
      status: "CANCELLED",
    };
  },
});

/**
 * 🔹 LIST KITCHEN ISSUES
 */
export const listIssues = query({
  args: {
    campusCode: v.optional(campusValidator),
    status: v.optional(kitchenIssueStatusValidator),
    issueDate: v.optional(v.string()),
    limit: v.optional(v.number()),
  },

  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 100, 300);

    let issues;

    if (args.status) {
      issues = await ctx.db
        .query("kitchenIssues")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(limit);
    } else if (args.campusCode) {
      issues = await ctx.db
        .query("kitchenIssues")
        .withIndex("by_campusCode", (q) => q.eq("campusCode", args.campusCode!))
        .order("desc")
        .take(limit);
    } else if (args.issueDate) {
      issues = await ctx.db
        .query("kitchenIssues")
        .withIndex("by_issueDate", (q) => q.eq("issueDate", args.issueDate!))
        .order("desc")
        .take(limit);
    } else {
      issues = await ctx.db.query("kitchenIssues").order("desc").take(limit);
    }

    if (args.campusCode) {
      issues = issues.filter((issue) => issue.campusCode === args.campusCode);
    }

    if (args.status) {
      issues = issues.filter((issue) => issue.status === args.status);
    }

    if (args.issueDate) {
      issues = issues.filter((issue) => issue.issueDate === args.issueDate);
    }

    return await Promise.all(
      issues.map(async (issue) => {
        const issuedBy = await ctx.db.get(issue.issuedByUserId);
        const receivedBy = issue.receivedByUserId
          ? await ctx.db.get(issue.receivedByUserId)
          : null;

        const items = await ctx.db
          .query("kitchenIssueItems")
          .withIndex("by_kitchenIssueId", (q) =>
            q.eq("kitchenIssueId", issue._id)
          )
          .collect();

        const totalEstimatedCost = items.reduce(
          (sum, item) => sum + item.estimatedTotalCost,
          0
        );

        return {
          ...issue,
          issuedByName: issuedBy?.name ?? "Unknown",
          receivedByName: receivedBy?.name ?? null,
          itemCount: items.length,
          totalEstimatedCost,
        };
      })
    );
  },
});

/**
 * 🔹 GET KITCHEN ISSUE WITH ITEMS
 */
export const getIssue = query({
  args: {
    kitchenIssueId: v.id("kitchenIssues"),
  },

  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.kitchenIssueId);

    if (!issue) return null;

    const items = await ctx.db
      .query("kitchenIssueItems")
      .withIndex("by_kitchenIssueId", (q) =>
        q.eq("kitchenIssueId", args.kitchenIssueId)
      )
      .collect();

    const issuedBy = await ctx.db.get(issue.issuedByUserId);
    const receivedBy = issue.receivedByUserId
      ? await ctx.db.get(issue.receivedByUserId)
      : null;

    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const inventoryItem = await ctx.db.get(item.inventoryItemId);

        return {
          ...item,
          currentStock: inventoryItem?.currentStock ?? null,
          category: inventoryItem?.category ?? null,
          campusCode: inventoryItem?.campusCode ?? null,
        };
      })
    );

    return {
      ...issue,
      issuedByName: issuedBy?.name ?? "Unknown",
      receivedByName: receivedBy?.name ?? null,
      items: enrichedItems,
      totalEstimatedCost: enrichedItems.reduce(
        (sum, item) => sum + item.estimatedTotalCost,
        0
      ),
    };
  },
});

/**
 * 🔹 CREATE DAILY KITCHEN CLOSING
 *
 * This stores daily counts from meal operations and lets you attach leftover/waste items.
 */
export const createDailyClosing = mutation({
  args: {
    closingDate: v.string(),
    campusCode: campusValidator,
    closedByUserId: v.id("appUsers"),

    lunchServedCount: v.number(),
    teaServedCount: v.number(),
    snackServedCount: v.number(),
    fruitServedCount: v.number(),

    notes: v.optional(v.string()),
    actor: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dailyKitchenClosings")
      .withIndex("by_campusCode_and_closingDate", (q) =>
        q.eq("campusCode", args.campusCode).eq("closingDate", args.closingDate)
      )
      .first();

    if (existing) {
      throw new Error(
        `A kitchen closing already exists for ${args.campusCode} on ${args.closingDate}.`
      );
    }

    if (
      args.lunchServedCount < 0 ||
      args.teaServedCount < 0 ||
      args.snackServedCount < 0 ||
      args.fruitServedCount < 0
    ) {
      throw new Error("Served counts cannot be negative.");
    }

    const createdAt = now();

    const kitchenClosingId = await ctx.db.insert("dailyKitchenClosings", {
      closingDate: args.closingDate,
      campusCode: args.campusCode,

      closedByUserId: args.closedByUserId,

      lunchServedCount: args.lunchServedCount,
      teaServedCount: args.teaServedCount,
      snackServedCount: args.snackServedCount,
      fruitServedCount: args.fruitServedCount,

      notes: args.notes?.trim() || null,

      createdAt,
      updatedAt: createdAt,
    });

    await createActivityLog(ctx, {
      actionType: "KITCHEN_CLOSING_SUBMITTED",
      kitchenClosingId,
      actor: args.actor ?? null,
      details:
        args.notes?.trim() ||
        `Submitted kitchen closing for ${args.campusCode} on ${args.closingDate}`,
      sourceCampusCode: args.campusCode,
      targetCampusCode: args.campusCode,
    });

    return {
      success: true,
      kitchenClosingId,
    };
  },
});

/**
 * 🔹 ADD DAILY CLOSING ITEM
 *
 * Leftovers are tracked for value.
 * Waste deducts stock if the waste exists in store inventory.
 */
export const addDailyClosingItem = mutation({
  args: {
    closingId: v.id("dailyKitchenClosings"),
    inventoryItemId: v.id("inventoryItems"),

    quantityLeftover: v.number(),
    quantityWasted: v.number(),

    estimatedUnitCost: v.optional(v.number()),

    notes: v.optional(v.string()),
    actor: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const closing = await ctx.db.get(args.closingId);

    if (!closing) {
      throw new Error("Daily kitchen closing not found.");
    }

    const inventoryItem = await ctx.db.get(args.inventoryItemId);

    if (!inventoryItem) {
      throw new Error("Inventory item not found.");
    }

    if (inventoryItem.campusCode !== closing.campusCode) {
      throw new Error(
        `Inventory item belongs to ${inventoryItem.campusCode}, but closing is for ${closing.campusCode}.`
      );
    }

    if (args.quantityLeftover < 0 || args.quantityWasted < 0) {
      throw new Error("Leftover and waste quantities cannot be negative.");
    }

    const estimatedUnitCost =
      args.estimatedUnitCost ??
      inventoryItem.averageUnitCost ??
      inventoryItem.lastUnitCost ??
      0;

    if (estimatedUnitCost < 0) {
      throw new Error("Estimated unit cost cannot be negative.");
    }

    if (args.quantityWasted > inventoryItem.currentStock) {
      throw new Error(
        `Cannot record waste of ${args.quantityWasted}. Only ${inventoryItem.currentStock} ${inventoryItem.unit} available.`
      );
    }

    const createdAt = now();
    const leftoverValue = args.quantityLeftover * estimatedUnitCost;
    const wasteCost = args.quantityWasted * estimatedUnitCost;

    const closingItemId = await ctx.db.insert("dailyKitchenClosingItems", {
      closingId: args.closingId,
      inventoryItemId: args.inventoryItemId,

      itemNameSnapshot: inventoryItem.name,
      unitSnapshot: inventoryItem.unit,

      quantityLeftover: args.quantityLeftover,
      quantityWasted: args.quantityWasted,

      estimatedUnitCost,
      leftoverValue,
      wasteCost,

      notes: args.notes?.trim() || null,

      createdAt,
      updatedAt: createdAt,
    });

    if (args.quantityWasted > 0) {
      const newStock = inventoryItem.currentStock - args.quantityWasted;

      await ctx.db.patch(args.inventoryItemId, {
        currentStock: newStock,
        updatedAt: createdAt,
      });

      await ctx.db.insert("inventoryMovements", {
        inventoryItemId: args.inventoryItemId,
        movementType: "WASTE",
        quantity: -Math.abs(args.quantityWasted),

        orderId: null,
        purchaseBatchId: null,
        kitchenIssueId: null,
        kitchenClosingId: args.closingId,

        sourceCampusCode: closing.campusCode,
        targetCampusCode: null,

        unitCost: estimatedUnitCost,
        totalCost: wasteCost,

        createdByUserId: closing.closedByUserId,

        createdAt,
        notes:
          args.notes?.trim() ||
          `Waste recorded during kitchen closing: ${args.quantityWasted} ${inventoryItem.unit} of ${inventoryItem.name}`,
      });

      await createActivityLog(ctx, {
        actionType: "INVENTORY_WASTE_RECORDED",
        kitchenClosingId: args.closingId,
        inventoryItemId: args.inventoryItemId,
        itemName: inventoryItem.name,
        actor: args.actor ?? null,
        details:
          args.notes?.trim() ||
          `Waste recorded: ${args.quantityWasted} ${inventoryItem.unit} of ${inventoryItem.name}`,
        sourceCampusCode: closing.campusCode,
        quantity: args.quantityWasted,
        amount: wasteCost,
      });
    }

    if (args.quantityLeftover > 0) {
      await createActivityLog(ctx, {
        actionType: "INVENTORY_LEFTOVER_RETURNED",
        kitchenClosingId: args.closingId,
        inventoryItemId: args.inventoryItemId,
        itemName: inventoryItem.name,
        actor: args.actor ?? null,
        details:
          args.notes?.trim() ||
          `Leftover recorded: ${args.quantityLeftover} ${inventoryItem.unit} of ${inventoryItem.name}`,
        sourceCampusCode: closing.campusCode,
        targetCampusCode: closing.campusCode,
        quantity: args.quantityLeftover,
        amount: leftoverValue,
      });
    }

    await ctx.db.patch(args.closingId, {
      updatedAt: createdAt,
    });

    return {
      success: true,
      closingItemId,
      leftoverValue,
      wasteCost,
    };
  },
});

/**
 * 🔹 LIST DAILY CLOSINGS
 */
export const listDailyClosings = query({
  args: {
    campusCode: v.optional(campusValidator),
    closingDate: v.optional(v.string()),
    limit: v.optional(v.number()),
  },

  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 100, 300);

    let closings;

    if (args.campusCode) {
      closings = await ctx.db
        .query("dailyKitchenClosings")
        .withIndex("by_campusCode", (q) => q.eq("campusCode", args.campusCode!))
        .order("desc")
        .take(limit);
    } else if (args.closingDate) {
      closings = await ctx.db
        .query("dailyKitchenClosings")
        .withIndex("by_closingDate", (q) => q.eq("closingDate", args.closingDate!))
        .order("desc")
        .take(limit);
    } else {
      closings = await ctx.db
        .query("dailyKitchenClosings")
        .order("desc")
        .take(limit);
    }

    if (args.campusCode) {
      closings = closings.filter((closing) => closing.campusCode === args.campusCode);
    }

    if (args.closingDate) {
      closings = closings.filter(
        (closing) => closing.closingDate === args.closingDate
      );
    }

    return await Promise.all(
      closings.map(async (closing) => {
        const closedBy = await ctx.db.get(closing.closedByUserId);

        const items = await ctx.db
          .query("dailyKitchenClosingItems")
          .withIndex("by_closingId", (q) => q.eq("closingId", closing._id))
          .collect();

        return {
          ...closing,
          closedByName: closedBy?.name ?? "Unknown",
          itemCount: items.length,
          totalWasteCost: items.reduce((sum, item) => sum + item.wasteCost, 0),
          totalLeftoverValue: items.reduce(
            (sum, item) => sum + item.leftoverValue,
            0
          ),
        };
      })
    );
  },
});

/**
 * 🔹 GET DAILY CLOSING WITH ITEMS
 */
export const getDailyClosing = query({
  args: {
    closingId: v.id("dailyKitchenClosings"),
  },

  handler: async (ctx, args) => {
    const closing = await ctx.db.get(args.closingId);

    if (!closing) return null;

    const items = await ctx.db
      .query("dailyKitchenClosingItems")
      .withIndex("by_closingId", (q) => q.eq("closingId", args.closingId))
      .collect();

    const closedBy = await ctx.db.get(closing.closedByUserId);

    return {
      ...closing,
      closedByName: closedBy?.name ?? "Unknown",
      items,
      totalWasteCost: items.reduce((sum, item) => sum + item.wasteCost, 0),
      totalLeftoverValue: items.reduce(
        (sum, item) => sum + item.leftoverValue,
        0
      ),
    };
  },
});

/**
 * 🔹 DAILY KITCHEN SUMMARY
 */
export const getDailySummary = query({
  args: {
    campusCode: campusValidator,
    closingDate: v.string(),
  },

  handler: async (ctx, args) => {
    const closing = await ctx.db
      .query("dailyKitchenClosings")
      .withIndex("by_campusCode_and_closingDate", (q) =>
        q.eq("campusCode", args.campusCode).eq("closingDate", args.closingDate)
      )
      .first();

    if (!closing) {
      return {
        campusCode: args.campusCode,
        closingDate: args.closingDate,
        hasClosing: false,
        lunchServedCount: 0,
        teaServedCount: 0,
        snackServedCount: 0,
        fruitServedCount: 0,
        totalWasteCost: 0,
        totalLeftoverValue: 0,
        items: [],
      };
    }

    const items = await ctx.db
      .query("dailyKitchenClosingItems")
      .withIndex("by_closingId", (q) => q.eq("closingId", closing._id))
      .collect();

    return {
      campusCode: args.campusCode,
      closingDate: args.closingDate,
      hasClosing: true,
      closingId: closing._id,

      lunchServedCount: closing.lunchServedCount,
      teaServedCount: closing.teaServedCount,
      snackServedCount: closing.snackServedCount,
      fruitServedCount: closing.fruitServedCount,

      totalWasteCost: items.reduce((sum, item) => sum + item.wasteCost, 0),
      totalLeftoverValue: items.reduce(
        (sum, item) => sum + item.leftoverValue,
        0
      ),

      items,
    };
  },
});