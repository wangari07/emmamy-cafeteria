import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

const campusValidator = v.union(
  v.literal("MAIN_SCHOOL"),
  v.literal("DIGITAL_SCHOOL")
);

const inventoryCategoryValidator = v.union(
  v.literal("LUNCH"),
  v.literal("SNACK"),
  v.literal("DRINK"),
  v.literal("FRUIT"),
  v.literal("TEA"),
  v.literal("SUPPLY"),
  v.literal("OTHER")
);

const movementTypeValidator = v.union(
  v.literal("STOCK_IN"),
  v.literal("DISPATCH_OUT"),
  v.literal("RECEIPT_IN"),
  v.literal("ADJUSTMENT"),
  v.literal("KITCHEN_ISSUE"),
  v.literal("WASTE"),
  v.literal("LEFTOVER_RETURN")
);

function makeNow() {
  return new Date().toISOString();
}

function cleanText(value?: string | null) {
  return (value ?? "").trim();
}

function getUnitCost(item: any) {
  return item.averageUnitCost ?? item.lastUnitCost ?? 0;
}

function isInboundMovement(type: string) {
  return ["STOCK_IN", "RECEIPT_IN", "LEFTOVER_RETURN"].includes(type);
}

function isOutboundMovement(type: string) {
  return ["DISPATCH_OUT", "KITCHEN_ISSUE", "WASTE"].includes(type);
}

function movementDisplayLabel(type: string) {
  const labels: Record<string, string> = {
    STOCK_IN: "Stock In",
    DISPATCH_OUT: "Dispatch Out",
    RECEIPT_IN: "Receipt In",
    ADJUSTMENT: "Stock Adjustment",
    KITCHEN_ISSUE: "Kitchen Issue / Used",
    WASTE: "Waste",
    LEFTOVER_RETURN: "Leftover Return",
  };

  return labels[type] ?? type.replace(/_/g, " ");
}

async function createActivityLog(
  ctx: any,
  args: {
    actionType:
      | "INVENTORY_ITEM_CREATED"
      | "INVENTORY_STOCK_IN"
      | "INVENTORY_DISPATCH_OUT"
      | "INVENTORY_RECEIPT_IN"
      | "INVENTORY_ADJUSTMENT"
      | "INVENTORY_KITCHEN_ISSUE"
      | "INVENTORY_WASTE_RECORDED"
      | "INVENTORY_LEFTOVER_RETURNED";
    inventoryItemId?: any;
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
    kitchenIssueId: null,
    kitchenClosingId: null,

    sourceCampusCode: args.sourceCampusCode ?? null,
    targetCampusCode: args.targetCampusCode ?? null,

    quantity: args.quantity ?? null,
    amount: args.amount ?? null,

    createdAt: makeNow(),
  });
}

function shapeItem(item: Doc<"inventoryItems">) {
  const averageUnitCost = item.averageUnitCost ?? 0;
  const lastUnitCost = item.lastUnitCost ?? 0;
  const effectiveUnitCost = averageUnitCost || lastUnitCost || 0;

  return {
    _id: item._id,
    name: item.name,
    category: item.category,
    unit: item.unit,
    campusCode: item.campusCode,
    currentStock: item.currentStock,
    reorderLevel: item.reorderLevel,
    isActive: item.isActive,
    averageUnitCost,
    lastUnitCost,
    effectiveUnitCost,
    lastPurchaseDate: item.lastPurchaseDate ?? null,
    stockValue: item.currentStock * effectiveUnitCost,
    isLowStock: item.isActive && item.currentStock <= item.reorderLevel,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export const listItems = query({
  args: {
    campusCode: v.optional(campusValidator),
    category: v.optional(inventoryCategoryValidator),
    activeOnly: v.optional(v.boolean()),
    search: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    let items = await ctx.db.query("inventoryItems").collect();

    if (args.campusCode) {
      items = items.filter((item) => item.campusCode === args.campusCode);
    }

    if (args.category) {
      items = items.filter((item) => item.category === args.category);
    }

    if (args.activeOnly) {
      items = items.filter((item) => item.isActive);
    }

    if (args.search?.trim()) {
      const term = args.search.trim().toLowerCase();

      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(term) ||
          item.unit.toLowerCase().includes(term) ||
          item.category.toLowerCase().includes(term) ||
          item.campusCode.toLowerCase().includes(term)
      );
    }

    return items.sort((a, b) => a.name.localeCompare(b.name)).map(shapeItem);
  },
});

export const getItem = query({
  args: {
    inventoryItemId: v.id("inventoryItems"),
  },

  handler: async (ctx, { inventoryItemId }) => {
    const item = await ctx.db.get(inventoryItemId);
    if (!item) return null;
    return shapeItem(item as Doc<"inventoryItems">);
  },
});

export const listLowStock = query({
  args: {
    campusCode: v.optional(campusValidator),
  },

  handler: async (ctx, args) => {
    let items = await ctx.db.query("inventoryItems").collect();

    if (args.campusCode) {
      items = items.filter((item) => item.campusCode === args.campusCode);
    }

    return items
      .filter((item) => item.isActive && item.currentStock <= item.reorderLevel)
      .sort((a, b) => a.currentStock - b.currentStock)
      .map((item) => ({
        ...shapeItem(item as Doc<"inventoryItems">),
        shortage: Math.max(item.reorderLevel - item.currentStock, 0),
      }));
  },
});

export const createItem = mutation({
  args: {
    name: v.string(),
    category: inventoryCategoryValidator,
    unit: v.string(),
    campusCode: campusValidator,
    currentStock: v.optional(v.number()),
    reorderLevel: v.optional(v.number()),
    averageUnitCost: v.optional(v.number()),
    actor: v.optional(v.string()),
    notes: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const name = cleanText(args.name);
    const unit = cleanText(args.unit);

    if (!name) throw new Error("Inventory item name is required.");
    if (!unit) throw new Error("Inventory unit is required.");

    const openingStock = args.currentStock ?? 0;
    const reorderLevel = args.reorderLevel ?? 0;
    const averageUnitCost = args.averageUnitCost ?? 0;

    if (openingStock < 0) throw new Error("Opening stock cannot be negative.");
    if (reorderLevel < 0) throw new Error("Reorder level cannot be negative.");
    if (averageUnitCost < 0) throw new Error("Average unit cost cannot be negative.");

    const existing = await ctx.db
      .query("inventoryItems")
      .filter((q) =>
        q.and(
          q.eq(q.field("name"), name),
          q.eq(q.field("campusCode"), args.campusCode)
        )
      )
      .first();

    if (existing) {
      throw new Error(`Inventory item "${name}" already exists for ${args.campusCode}.`);
    }

    const now = makeNow();

    const inventoryItemId = await ctx.db.insert("inventoryItems", {
      name,
      category: args.category,
      unit,
      campusCode: args.campusCode,
      currentStock: openingStock,
      reorderLevel,
      isActive: true,
      averageUnitCost,
      lastUnitCost: averageUnitCost,
      lastPurchaseDate: openingStock > 0 ? now : null,
      createdAt: now,
      updatedAt: now,
    });

    if (openingStock > 0) {
      await ctx.db.insert("inventoryMovements", {
        inventoryItemId,
        movementType: "STOCK_IN",
        quantity: openingStock,
        orderId: null,
        purchaseBatchId: null,
        kitchenIssueId: null,
        kitchenClosingId: null,
        sourceCampusCode: null,
        targetCampusCode: args.campusCode,
        unitCost: averageUnitCost,
        totalCost: openingStock * averageUnitCost,
        createdByUserId: null,
        createdAt: now,
        notes: cleanText(args.notes) || "Opening stock",
      });
    }

    await createActivityLog(ctx, {
      actionType: "INVENTORY_ITEM_CREATED",
      inventoryItemId,
      itemName: name,
      actor: args.actor ?? null,
      details: cleanText(args.notes) || `Created inventory item ${name}`,
      targetCampusCode: args.campusCode,
      quantity: openingStock,
      amount: openingStock * averageUnitCost,
    });

    return { success: true, inventoryItemId };
  },
});

export const updateItem = mutation({
  args: {
    inventoryItemId: v.id("inventoryItems"),
    name: v.optional(v.string()),
    category: v.optional(inventoryCategoryValidator),
    unit: v.optional(v.string()),
    reorderLevel: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    actor: v.optional(v.string()),
    notes: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.inventoryItemId);
    if (!item) throw new Error("Inventory item not found.");

    const patch: any = { updatedAt: makeNow() };

    if (args.name !== undefined) {
      const name = cleanText(args.name);
      if (!name) throw new Error("Inventory item name cannot be empty.");
      patch.name = name;
    }

    if (args.category !== undefined) patch.category = args.category;

    if (args.unit !== undefined) {
      const unit = cleanText(args.unit);
      if (!unit) throw new Error("Unit cannot be empty.");
      patch.unit = unit;
    }

    if (args.reorderLevel !== undefined) {
      if (args.reorderLevel < 0) throw new Error("Reorder level cannot be negative.");
      patch.reorderLevel = args.reorderLevel;
    }

    if (args.isActive !== undefined) patch.isActive = args.isActive;

    await ctx.db.patch(args.inventoryItemId, patch);

    await createActivityLog(ctx, {
      actionType: "INVENTORY_ADJUSTMENT",
      inventoryItemId: args.inventoryItemId,
      itemName: patch.name ?? item.name,
      actor: args.actor ?? null,
      details: cleanText(args.notes) || "Updated inventory item details",
      targetCampusCode: item.campusCode,
    });

    return { success: true, inventoryItemId: args.inventoryItemId };
  },
});

export const stockIn = mutation({
  args: {
    inventoryItemId: v.id("inventoryItems"),
    quantity: v.number(),
    unitCost: v.optional(v.number()),
    actor: v.optional(v.string()),
    notes: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.inventoryItemId);
    if (!item) throw new Error("Inventory item not found.");
    if (!item.isActive) throw new Error("Cannot stock in to an inactive inventory item.");
    if (args.quantity <= 0) throw new Error("Stock-in quantity must be greater than zero.");

    const unitCost = args.unitCost ?? item.lastUnitCost ?? item.averageUnitCost ?? 0;
    if (unitCost < 0) throw new Error("Unit cost cannot be negative.");

    const now = makeNow();
    const oldStock = item.currentStock;
    const newStock = oldStock + args.quantity;
    const oldAverage = getUnitCost(item);
    const oldValue = oldStock * oldAverage;
    const addedValue = args.quantity * unitCost;
    const newAverage = newStock > 0 ? (oldValue + addedValue) / newStock : unitCost;

    await ctx.db.patch(args.inventoryItemId, {
      currentStock: newStock,
      averageUnitCost: newAverage,
      lastUnitCost: unitCost,
      lastPurchaseDate: now,
      updatedAt: now,
    });

    await ctx.db.insert("inventoryMovements", {
      inventoryItemId: args.inventoryItemId,
      movementType: "STOCK_IN",
      quantity: args.quantity,
      orderId: null,
      purchaseBatchId: null,
      kitchenIssueId: null,
      kitchenClosingId: null,
      sourceCampusCode: null,
      targetCampusCode: item.campusCode,
      unitCost,
      totalCost: args.quantity * unitCost,
      createdByUserId: null,
      createdAt: now,
      notes: cleanText(args.notes) || "Manual stock in",
    });

    await createActivityLog(ctx, {
      actionType: "INVENTORY_STOCK_IN",
      inventoryItemId: args.inventoryItemId,
      itemName: item.name,
      actor: args.actor ?? null,
      details: cleanText(args.notes) || `Stock in: ${args.quantity} ${item.unit} of ${item.name}`,
      targetCampusCode: item.campusCode,
      quantity: args.quantity,
      amount: args.quantity * unitCost,
    });

    return {
      success: true,
      inventoryItemId: args.inventoryItemId,
      previousStock: oldStock,
      newStock,
      unitCost,
      totalCost: args.quantity * unitCost,
    };
  },
});

export const adjustStock = mutation({
  args: {
    inventoryItemId: v.id("inventoryItems"),
    newStock: v.number(),
    actor: v.optional(v.string()),
    notes: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.inventoryItemId);
    if (!item) throw new Error("Inventory item not found.");
    if (args.newStock < 0) throw new Error("New stock cannot be negative.");

    const reason = cleanText(args.notes);
    if (!reason) throw new Error("A reason is required for stock adjustments.");

    const now = makeNow();
    const previousStock = item.currentStock;
    const difference = args.newStock - previousStock;
    const unitCost = getUnitCost(item);

    await ctx.db.patch(args.inventoryItemId, {
      currentStock: args.newStock,
      updatedAt: now,
    });

    await ctx.db.insert("inventoryMovements", {
      inventoryItemId: args.inventoryItemId,
      movementType: "ADJUSTMENT",
      quantity: difference,
      orderId: null,
      purchaseBatchId: null,
      kitchenIssueId: null,
      kitchenClosingId: null,
      sourceCampusCode: item.campusCode,
      targetCampusCode: item.campusCode,
      unitCost,
      totalCost: difference * unitCost,
      createdByUserId: null,
      createdAt: now,
      notes: reason,
    });

    await createActivityLog(ctx, {
      actionType: "INVENTORY_ADJUSTMENT",
      inventoryItemId: args.inventoryItemId,
      itemName: item.name,
      actor: args.actor ?? null,
      details: `${reason}. Adjusted stock from ${previousStock} to ${args.newStock}`,
      sourceCampusCode: item.campusCode,
      targetCampusCode: item.campusCode,
      quantity: difference,
      amount: difference * unitCost,
    });

    return {
      success: true,
      inventoryItemId: args.inventoryItemId,
      previousStock,
      newStock: args.newStock,
      difference,
    };
  },
});

export const recordWaste = mutation({
  args: {
    inventoryItemId: v.id("inventoryItems"),
    quantity: v.number(),
    actor: v.optional(v.string()),
    notes: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.inventoryItemId);
    if (!item) throw new Error("Inventory item not found.");
    if (!item.isActive) throw new Error("Cannot record waste against an inactive inventory item.");
    if (args.quantity <= 0) throw new Error("Waste quantity must be greater than zero.");
    if (args.quantity > item.currentStock) {
      throw new Error(`Cannot record waste of ${args.quantity}. Only ${item.currentStock} ${item.unit} available.`);
    }

    const reason = cleanText(args.notes);
    if (!reason) throw new Error("A reason is required when recording waste.");

    const now = makeNow();
    const unitCost = getUnitCost(item);
    const newStock = item.currentStock - args.quantity;

    await ctx.db.patch(args.inventoryItemId, {
      currentStock: newStock,
      updatedAt: now,
    });

    await ctx.db.insert("inventoryMovements", {
      inventoryItemId: args.inventoryItemId,
      movementType: "WASTE",
      quantity: -Math.abs(args.quantity),
      orderId: null,
      purchaseBatchId: null,
      kitchenIssueId: null,
      kitchenClosingId: null,
      sourceCampusCode: item.campusCode,
      targetCampusCode: null,
      unitCost,
      totalCost: args.quantity * unitCost,
      createdByUserId: null,
      createdAt: now,
      notes: reason,
    });

    await createActivityLog(ctx, {
      actionType: "INVENTORY_WASTE_RECORDED",
      inventoryItemId: args.inventoryItemId,
      itemName: item.name,
      actor: args.actor ?? null,
      details: `${reason}. Recorded waste: ${args.quantity} ${item.unit} of ${item.name}`,
      sourceCampusCode: item.campusCode,
      quantity: args.quantity,
      amount: args.quantity * unitCost,
    });

    return {
      success: true,
      inventoryItemId: args.inventoryItemId,
      previousStock: item.currentStock,
      newStock,
      wasteCost: args.quantity * unitCost,
    };
  },
});

export const listMovements = query({
  args: {
    inventoryItemId: v.optional(v.id("inventoryItems")),
    orderId: v.optional(v.id("campusOrders")),
    purchaseBatchId: v.optional(v.id("purchaseBatches")),
    kitchenIssueId: v.optional(v.id("kitchenIssues")),
    kitchenClosingId: v.optional(v.id("dailyKitchenClosings")),
    movementType: v.optional(movementTypeValidator),
    limit: v.optional(v.number()),
  },

  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 100, 300);
    let movements;

    if (args.inventoryItemId) {
      movements = await ctx.db
        .query("inventoryMovements")
        .withIndex("by_inventoryItemId", (q) => q.eq("inventoryItemId", args.inventoryItemId!))
        .order("desc")
        .take(limit);
    } else if (args.orderId) {
      movements = await ctx.db
        .query("inventoryMovements")
        .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId!))
        .order("desc")
        .take(limit);
    } else if (args.purchaseBatchId) {
      movements = await ctx.db
        .query("inventoryMovements")
        .withIndex("by_purchaseBatchId", (q) => q.eq("purchaseBatchId", args.purchaseBatchId!))
        .order("desc")
        .take(limit);
    } else if (args.kitchenIssueId) {
      movements = await ctx.db
        .query("inventoryMovements")
        .withIndex("by_kitchenIssueId", (q) => q.eq("kitchenIssueId", args.kitchenIssueId!))
        .order("desc")
        .take(limit);
    } else if (args.kitchenClosingId) {
      movements = await ctx.db
        .query("inventoryMovements")
        .withIndex("by_kitchenClosingId", (q) => q.eq("kitchenClosingId", args.kitchenClosingId!))
        .order("desc")
        .take(limit);
    } else {
      movements = await ctx.db
        .query("inventoryMovements")
        .withIndex("by_createdAt")
        .order("desc")
        .take(limit);
    }

    if (args.movementType) {
      movements = movements.filter((movement) => movement.movementType === args.movementType);
    }
    return await Promise.all(
      movements.map(async (movement) => {
        const itemDoc = await ctx.db.get(movement.inventoryItemId);
    
        const purchaseBatchDoc = movement.purchaseBatchId
          ? await ctx.db.get(movement.purchaseBatchId)
          : null;
    
        const orderDoc = movement.orderId
          ? await ctx.db.get(movement.orderId)
          : null;
    
        const item = itemDoc as Doc<"inventoryItems"> | null;
        const purchaseBatch = purchaseBatchDoc as Doc<"purchaseBatches"> | null;
        const order = orderDoc as Doc<"campusOrders"> | null;
    
        return {
          ...movement,
          itemName: item?.name ?? "Unknown item",
          itemCategory: item?.category ?? null,
          itemUnit: item?.unit ?? null,
          campusCode: item?.campusCode ?? null,
          purchaseBatchNumber: purchaseBatch?.batchNumber ?? null,
          orderNumber: order?.orderNumber ?? null,
        };
      })
    );
  },
});

export const getItemStockLedger = query({
  args: {
    inventoryItemId: v.id("inventoryItems"),
    movementType: v.optional(movementTypeValidator),
    limit: v.optional(v.number()),
  },

  handler: async (ctx, args) => {
    const itemDoc = await ctx.db.get(args.inventoryItemId);

    if (!itemDoc) {
      throw new Error("Inventory item not found.");
    }

    const item = itemDoc as Doc<"inventoryItems">;
    const limit = Math.min(args.limit ?? 150, 500);

    let movements = await ctx.db
      .query("inventoryMovements")
      .withIndex("by_inventoryItemId", (q) =>
        q.eq("inventoryItemId", args.inventoryItemId)
      )
      .order("desc")
      .take(limit);

    if (args.movementType) {
      movements = movements.filter(
        (movement) => movement.movementType === args.movementType
      );
    }

    const allMovementsForTotals = await ctx.db
      .query("inventoryMovements")
      .withIndex("by_inventoryItemId", (q) =>
        q.eq("inventoryItemId", args.inventoryItemId)
      )
      .collect();

    const totalReceived = allMovementsForTotals
      .filter((movement) => isInboundMovement(movement.movementType))
      .reduce((sum, movement) => sum + Math.abs(movement.quantity), 0);

    const totalUsed = allMovementsForTotals
      .filter((movement) => isOutboundMovement(movement.movementType))
      .reduce((sum, movement) => sum + Math.abs(movement.quantity), 0);

    const purchasedStockIn = allMovementsForTotals
      .filter((movement) => movement.movementType === "STOCK_IN")
      .reduce((sum, movement) => sum + Math.abs(movement.quantity), 0);

    const receiptIn = allMovementsForTotals
      .filter((movement) => movement.movementType === "RECEIPT_IN")
      .reduce((sum, movement) => sum + Math.abs(movement.quantity), 0);

    const kitchenUsed = allMovementsForTotals
      .filter((movement) => movement.movementType === "KITCHEN_ISSUE")
      .reduce((sum, movement) => sum + Math.abs(movement.quantity), 0);

    const dispatchedOut = allMovementsForTotals
      .filter((movement) => movement.movementType === "DISPATCH_OUT")
      .reduce((sum, movement) => sum + Math.abs(movement.quantity), 0);

    const wasted = allMovementsForTotals
      .filter((movement) => movement.movementType === "WASTE")
      .reduce((sum, movement) => sum + Math.abs(movement.quantity), 0);

    const leftoverReturned = allMovementsForTotals
      .filter((movement) => movement.movementType === "LEFTOVER_RETURN")
      .reduce((sum, movement) => sum + Math.abs(movement.quantity), 0);

    const netAdjustments = allMovementsForTotals
      .filter((movement) => movement.movementType === "ADJUSTMENT")
      .reduce((sum, movement) => sum + movement.quantity, 0);

    const averageUnitCost = item.averageUnitCost ?? 0;
    const lastUnitCost = item.lastUnitCost ?? 0;
    const effectiveUnitCost = averageUnitCost || lastUnitCost || 0;

    const enrichedMovements = await Promise.all(
      movements.map(async (movement) => {
        const purchaseBatch = movement.purchaseBatchId
          ? await ctx.db.get(movement.purchaseBatchId)
          : null;

        const order = movement.orderId
          ? await ctx.db.get(movement.orderId)
          : null;

        const direction = isInboundMovement(movement.movementType)
          ? "IN"
          : isOutboundMovement(movement.movementType)
            ? "OUT"
            : movement.quantity >= 0
              ? "IN"
              : "OUT";

        return {
          ...movement,
          itemName: item.name,
          itemCategory: item.category,
          itemUnit: item.unit,
          campusCode: item.campusCode,
          displayLabel: movementDisplayLabel(movement.movementType),
          direction,
          absoluteQuantity: Math.abs(movement.quantity),
          signedQuantity: movement.quantity,
          purchaseBatchNumber: purchaseBatch?.batchNumber ?? null,
          orderNumber: order?.orderNumber ?? null,
          sourceLabel:
            purchaseBatch?.batchNumber ??
            order?.orderNumber ??
            movement.notes ??
            movementDisplayLabel(movement.movementType),
        };
      })
    );

    return {
      item: shapeItem(item),
      summary: {
        itemName: item.name,
        category: item.category,
        campusCode: item.campusCode,
        unit: item.unit,
        totalReceived,
        totalUsed,
        purchasedStockIn,
        receiptIn,
        kitchenUsed,
        dispatchedOut,
        wasted,
        leftoverReturned,
        netAdjustments,
        remainingStock: item.currentStock,
        reorderLevel: item.reorderLevel,
        averageUnitCost,
        lastUnitCost,
        effectiveUnitCost,
        stockValue: item.currentStock * effectiveUnitCost,
        lastPurchaseDate: item.lastPurchaseDate ?? null,
        isLowStock: item.isActive && item.currentStock <= item.reorderLevel,
        movementCount: allMovementsForTotals.length,
      },
      movements: enrichedMovements,
    };
  },
});

export const getSummary = query({
  args: {
    campusCode: v.optional(campusValidator),
  },

  handler: async (ctx, args) => {
    let items = await ctx.db.query("inventoryItems").collect();

    if (args.campusCode) {
      items = items.filter((item) => item.campusCode === args.campusCode);
    }

    const activeItems = items.filter((item) => item.isActive);
    const inactiveItems = items.filter((item) => !item.isActive);
    const lowStockItems = activeItems.filter((item) => item.currentStock <= item.reorderLevel);
    const outOfStockItems = activeItems.filter((item) => item.currentStock <= 0);

    const totalStockValue = activeItems.reduce((sum, item) => {
      return sum + item.currentStock * getUnitCost(item);
    }, 0);

    const byCategory = activeItems.reduce(
      (acc: Record<string, { count: number; stockValue: number; lowStockCount: number }>, item) => {
        if (!acc[item.category]) {
          acc[item.category] = { count: 0, stockValue: 0, lowStockCount: 0 };
        }

        acc[item.category].count += 1;
        acc[item.category].stockValue += item.currentStock * getUnitCost(item);
        if (item.currentStock <= item.reorderLevel) acc[item.category].lowStockCount += 1;
        return acc;
      },
      {}
    );

    return {
      totalItems: items.length,
      activeItems: activeItems.length,
      inactiveItems: inactiveItems.length,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      totalStockValue,
      byCategory,
      lowStockItems: lowStockItems.map((item) => shapeItem(item as Doc<"inventoryItems">)),
    };
  },
});
