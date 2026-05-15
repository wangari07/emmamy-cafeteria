import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

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

const receiptEntryModeValidator = v.union(
  v.literal("MANUAL"),
  v.literal("IMAGE_UPLOAD"),
  v.literal("AI_EXTRACTED")
);

const receiptStatusValidator = v.union(
  v.literal("DRAFT"),
  v.literal("UPLOADED"),
  v.literal("AI_EXTRACTED"),
  v.literal("NEEDS_REVIEW"),
  v.literal("REVIEWED"),
  v.literal("APPROVED"),
  v.literal("REJECTED")
);

function now() {
  return new Date().toISOString();
}

function cleanText(value: string) {
  return value.trim();
}

function assertBatchNotDeleted(batch: any) {
  if (batch.isDeleted === true) {
    throw new Error("This purchase batch has been archived/deleted and cannot be changed.");
  }
}

function makeBatchNumber() {
  const date = new Date();
  const stamp = date
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);

  const random = Math.floor(Math.random() * 9000) + 1000;

  return `PB-${stamp}-${random}`;
}

async function createActivityLog(
  ctx: any,
  args: {
    actionType:
      | "PURCHASE_BATCH_CREATED"
      | "PURCHASE_RECEIPT_UPLOADED"
      | "PURCHASE_RECEIPT_AI_EXTRACTED"
      | "PURCHASE_ITEM_MANUAL_ENTRY"
      | "PURCHASE_BATCH_APPROVED"
      | "PURCHASE_BATCH_REJECTED"
      | "PURCHASE_BATCH_DELETED"
      | "PURCHASE_BATCH_RESTORED"
      | "INVENTORY_STOCK_IN";
    purchaseBatchId?: any;
    inventoryItemId?: any;
    itemName?: string | null;
    actor?: string | null;
    details?: string | null;
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
    purchaseBatchId: args.purchaseBatchId ?? null,
    kitchenIssueId: null,
    kitchenClosingId: null,

    sourceCampusCode: null,
    targetCampusCode: args.targetCampusCode ?? null,

    quantity: args.quantity ?? null,
    amount: args.amount ?? null,

    createdAt: now(),
  });
}

/**
 * 🔹 GENERATE RECEIPT UPLOAD URL
 *
 * Frontend calls this first, uploads the file to the returned URL,
 * then sends the returned storageId to attachReceiptToBatch.
 */
export const generateReceiptUploadUrl = mutation({
  args: {},

  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * 🔹 ATTACH RECEIPT FILE TO PURCHASE BATCH
 *
 * Saves uploaded receipt metadata on a purchase batch.
 */
export const attachReceiptToBatch = mutation({
  args: {
    purchaseBatchId: v.id("purchaseBatches"),
    receiptStorageId: v.id("_storage"),
    receiptFileName: v.string(),
    receiptMimeType: v.string(),
    actor: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.purchaseBatchId);

    if (!batch) {
      throw new Error("Purchase batch not found.");
    }

    assertBatchNotDeleted(batch);

    if (batch.receiptStatus === "APPROVED") {
      throw new Error("Cannot attach a receipt to an approved purchase batch.");
    }

    if (batch.receiptStatus === "REJECTED") {
      throw new Error("Cannot attach a receipt to a rejected purchase batch.");
    }

    const receiptImageUrl = await ctx.storage.getUrl(args.receiptStorageId);

    if (!receiptImageUrl) {
      throw new Error("Could not generate receipt file URL.");
    }

    const nextStatus =
      batch.receiptStatus === "DRAFT"
        ? "UPLOADED"
        : batch.receiptStatus === "REVIEWED"
          ? "REVIEWED"
          : "NEEDS_REVIEW";

    const receiptFileName = cleanText(args.receiptFileName);
    const receiptMimeType = cleanText(args.receiptMimeType);

    await ctx.db.patch(args.purchaseBatchId, {
      receiptStorageId: args.receiptStorageId,
      receiptImageUrl,
      receiptFileName,
      receiptMimeType,
      receiptEntryMode: "IMAGE_UPLOAD",
      receiptStatus: nextStatus,
      updatedAt: now(),
    });

    await createActivityLog(ctx, {
      actionType: "PURCHASE_RECEIPT_UPLOADED",
      purchaseBatchId: args.purchaseBatchId,
      actor: args.actor ?? null,
      details: `Uploaded receipt file ${receiptFileName} for purchase batch ${batch.batchNumber}`,
      targetCampusCode: batch.campusCode,
      amount: batch.totalAmount,
    });

    return {
      success: true,
      purchaseBatchId: args.purchaseBatchId,
      receiptImageUrl,
      receiptFileName,
      receiptMimeType,
      receiptStatus: nextStatus,
    };
  },
});

/**
 * 🔹 CREATE PURCHASE BATCH
 *
 * A purchase batch is one weekly shopping entry or one receipt.
 * Items are added separately.
 */
export const createBatch = mutation({
  args: {
    enteredByUserId: v.id("appUsers"),
    campusCode: campusValidator,

    supplierName: v.optional(v.string()),
    receiptImageUrl: v.optional(v.string()),
    receiptEntryMode: v.optional(receiptEntryModeValidator),

    shoppingDate: v.string(),
    weekStartDate: v.string(),
    weekEndDate: v.string(),

    notes: v.optional(v.string()),
    actor: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const createdAt = now();

    const supplierName =
      args.supplierName && args.supplierName.trim()
        ? args.supplierName.trim()
        : null;

    const receiptImageUrl =
      args.receiptImageUrl && args.receiptImageUrl.trim()
        ? args.receiptImageUrl.trim()
        : null;

    const receiptEntryMode = args.receiptEntryMode ?? "MANUAL";

    const receiptStatus =
      receiptEntryMode === "IMAGE_UPLOAD"
        ? "UPLOADED"
        : receiptEntryMode === "AI_EXTRACTED"
          ? "AI_EXTRACTED"
          : "DRAFT";

    const batchNumber = makeBatchNumber();

    const purchaseBatchId = await ctx.db.insert("purchaseBatches", {
      batchNumber,

      supplierName,

      receiptStorageId: null,
      receiptImageUrl,
      receiptFileName: null,
      receiptMimeType: null,

      receiptEntryMode,
      receiptStatus,

      totalAmount: 0,

      shoppingDate: args.shoppingDate,
      weekStartDate: args.weekStartDate,
      weekEndDate: args.weekEndDate,

      campusCode: args.campusCode,

      enteredByUserId: args.enteredByUserId,
      approvedByUserId: null,
      approvedAt: null,

      notes: args.notes?.trim() || null,

      isDeleted: false,
      deletedAt: null,
      deletedByUserId: null,
      deleteReason: null,

      createdAt,
      updatedAt: createdAt,
    });

    await createActivityLog(ctx, {
      actionType:
        receiptEntryMode === "IMAGE_UPLOAD"
          ? "PURCHASE_RECEIPT_UPLOADED"
          : receiptEntryMode === "AI_EXTRACTED"
            ? "PURCHASE_RECEIPT_AI_EXTRACTED"
            : "PURCHASE_BATCH_CREATED",
      purchaseBatchId,
      actor: args.actor ?? null,
      details:
        args.notes?.trim() ||
        `Created purchase batch ${batchNumber} for ${args.campusCode}`,
      targetCampusCode: args.campusCode,
    });

    return {
      success: true,
      purchaseBatchId,
      batchNumber,
    };
  },
});

/**
 * 🔹 ADD PURCHASE ITEM
 */
export const addItem = mutation({
  args: {
    purchaseBatchId: v.id("purchaseBatches"),

    inventoryItemId: v.optional(v.union(v.id("inventoryItems"), v.null())),

    itemNameRaw: v.string(),
    normalizedItemName: v.optional(v.string()),

    category: inventoryCategoryValidator,

    quantity: v.number(),
    unit: v.string(),
    totalCost: v.number(),

    notes: v.optional(v.string()),
    actor: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.purchaseBatchId);

    if (!batch) {
      throw new Error("Purchase batch not found.");
    }

    assertBatchNotDeleted(batch);

    if (batch.receiptStatus === "APPROVED") {
      throw new Error("Cannot add items to an approved purchase batch.");
    }

    if (batch.receiptStatus === "REJECTED") {
      throw new Error("Cannot add items to a rejected purchase batch.");
    }

    const itemNameRaw = cleanText(args.itemNameRaw);
    const normalizedItemName = cleanText(
      args.normalizedItemName || args.itemNameRaw
    );
    const unit = cleanText(args.unit);

    if (!itemNameRaw) {
      throw new Error("Item name is required.");
    }

    if (!normalizedItemName) {
      throw new Error("Normalized item name is required.");
    }

    if (!unit) {
      throw new Error("Unit is required.");
    }

    if (args.quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }

    if (args.totalCost < 0) {
      throw new Error("Total cost cannot be negative.");
    }

    const unitCost = args.totalCost / args.quantity;
    const createdAt = now();

    const purchaseItemId = await ctx.db.insert("purchaseItems", {
      purchaseBatchId: args.purchaseBatchId,

      inventoryItemId: args.inventoryItemId ?? null,

      itemNameRaw,
      normalizedItemName,

      category: args.category,

      quantity: args.quantity,
      unit,

      totalCost: args.totalCost,
      unitCost,

      notes: args.notes?.trim() || null,

      createdAt,
      updatedAt: createdAt,
    });

    await ctx.db.patch(args.purchaseBatchId, {
      totalAmount: batch.totalAmount + args.totalCost,
      receiptStatus:
        batch.receiptStatus === "DRAFT" ? "NEEDS_REVIEW" : batch.receiptStatus,
      updatedAt: createdAt,
    });

    await createActivityLog(ctx, {
      actionType: "PURCHASE_ITEM_MANUAL_ENTRY",
      purchaseBatchId: args.purchaseBatchId,
      inventoryItemId: args.inventoryItemId ?? null,
      itemName: normalizedItemName,
      actor: args.actor ?? null,
      details:
        args.notes?.trim() ||
        `Added purchase item ${normalizedItemName}: ${args.quantity} ${unit} at total cost ${args.totalCost}`,
      targetCampusCode: batch.campusCode,
      quantity: args.quantity,
      amount: args.totalCost,
    });

    return {
      success: true,
      purchaseItemId,
      unitCost,
    };
  },
});

/**
 * 🔹 UPDATE PURCHASE ITEM
 */
export const updateItem = mutation({
  args: {
    purchaseItemId: v.id("purchaseItems"),

    inventoryItemId: v.optional(v.union(v.id("inventoryItems"), v.null())),
    itemNameRaw: v.optional(v.string()),
    normalizedItemName: v.optional(v.string()),
    category: v.optional(inventoryCategoryValidator),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    totalCost: v.optional(v.number()),
    notes: v.optional(v.string()),
    actor: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.purchaseItemId);

    if (!item) {
      throw new Error("Purchase item not found.");
    }

    const batch = await ctx.db.get(item.purchaseBatchId);

    if (!batch) {
      throw new Error("Purchase batch not found.");
    }

    assertBatchNotDeleted(batch);

    if (batch.receiptStatus === "APPROVED") {
      throw new Error("Cannot edit items in an approved purchase batch.");
    }

    if (batch.receiptStatus === "REJECTED") {
      throw new Error("Cannot edit items in a rejected purchase batch.");
    }

    const patch: any = {
      updatedAt: now(),
    };

    if (args.inventoryItemId !== undefined) {
      patch.inventoryItemId = args.inventoryItemId;
    }

    if (args.itemNameRaw !== undefined) {
      const itemNameRaw = cleanText(args.itemNameRaw);

      if (!itemNameRaw) {
        throw new Error("Item name cannot be empty.");
      }

      patch.itemNameRaw = itemNameRaw;
    }

    if (args.normalizedItemName !== undefined) {
      const normalizedItemName = cleanText(args.normalizedItemName);

      if (!normalizedItemName) {
        throw new Error("Normalized item name cannot be empty.");
      }

      patch.normalizedItemName = normalizedItemName;
    }

    if (args.category !== undefined) {
      patch.category = args.category;
    }

    const nextQuantity = args.quantity ?? item.quantity;
    const nextTotalCost = args.totalCost ?? item.totalCost;

    if (args.quantity !== undefined) {
      if (args.quantity <= 0) {
        throw new Error("Quantity must be greater than zero.");
      }

      patch.quantity = args.quantity;
    }

    if (args.unit !== undefined) {
      const unit = cleanText(args.unit);

      if (!unit) {
        throw new Error("Unit cannot be empty.");
      }

      patch.unit = unit;
    }

    if (args.totalCost !== undefined) {
      if (args.totalCost < 0) {
        throw new Error("Total cost cannot be negative.");
      }

      patch.totalCost = args.totalCost;
    }

    patch.unitCost = nextTotalCost / nextQuantity;

    if (args.notes !== undefined) {
      patch.notes = args.notes.trim() || null;
    }

    await ctx.db.patch(args.purchaseItemId, patch);

    const amountDifference = nextTotalCost - item.totalCost;

    await ctx.db.patch(item.purchaseBatchId, {
      totalAmount: batch.totalAmount + amountDifference,
      updatedAt: now(),
    });

    await createActivityLog(ctx, {
      actionType: "PURCHASE_ITEM_MANUAL_ENTRY",
      purchaseBatchId: item.purchaseBatchId,
      inventoryItemId: patch.inventoryItemId ?? item.inventoryItemId,
      itemName: patch.normalizedItemName ?? item.normalizedItemName,
      actor: args.actor ?? null,
      details: `Updated purchase item ${patch.normalizedItemName ?? item.normalizedItemName}`,
      targetCampusCode: batch.campusCode,
      quantity: patch.quantity ?? item.quantity,
      amount: patch.totalCost ?? item.totalCost,
    });

    return {
      success: true,
      purchaseItemId: args.purchaseItemId,
    };
  },
});

/**
 * 🔹 DELETE PURCHASE ITEM
 */
export const deleteItem = mutation({
  args: {
    purchaseItemId: v.id("purchaseItems"),
    actor: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.purchaseItemId);

    if (!item) {
      throw new Error("Purchase item not found.");
    }

    const batch = await ctx.db.get(item.purchaseBatchId);

    if (!batch) {
      throw new Error("Purchase batch not found.");
    }

    assertBatchNotDeleted(batch);

    if (batch.receiptStatus === "APPROVED") {
      throw new Error("Cannot delete items from an approved purchase batch.");
    }

    if (batch.receiptStatus === "REJECTED") {
      throw new Error("Cannot delete items from a rejected purchase batch.");
    }

    await ctx.db.delete(args.purchaseItemId);

    await ctx.db.patch(item.purchaseBatchId, {
      totalAmount: Math.max(batch.totalAmount - item.totalCost, 0),
      updatedAt: now(),
    });

    await createActivityLog(ctx, {
      actionType: "PURCHASE_ITEM_MANUAL_ENTRY",
      purchaseBatchId: item.purchaseBatchId,
      inventoryItemId: item.inventoryItemId,
      itemName: item.normalizedItemName,
      actor: args.actor ?? null,
      details: `Deleted purchase item ${item.normalizedItemName}`,
      targetCampusCode: batch.campusCode,
      quantity: item.quantity,
      amount: item.totalCost,
    });

    return {
      success: true,
      purchaseItemId: args.purchaseItemId,
    };
  },
});

/**
 * 🔹 LIST PURCHASE BATCHES
 */
export const listBatches = query({
  args: {
    campusCode: v.optional(campusValidator),
    receiptStatus: v.optional(receiptStatusValidator),
    weekStartDate: v.optional(v.string()),
    includeDeleted: v.optional(v.boolean()),
    deletedOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },

  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 100, 300);

    let batches;

    if (args.receiptStatus) {
      batches = await ctx.db
        .query("purchaseBatches")
        .withIndex("by_receiptStatus", (q) =>
          q.eq("receiptStatus", args.receiptStatus!)
        )
        .order("desc")
        .take(limit);
    } else if (args.campusCode) {
      batches = await ctx.db
        .query("purchaseBatches")
        .withIndex("by_campusCode", (q) =>
          q.eq("campusCode", args.campusCode!)
        )
        .order("desc")
        .take(limit);
    } else if (args.weekStartDate) {
      batches = await ctx.db
        .query("purchaseBatches")
        .withIndex("by_weekStartDate", (q) =>
          q.eq("weekStartDate", args.weekStartDate!)
        )
        .order("desc")
        .take(limit);
    } else {
      batches = await ctx.db.query("purchaseBatches").order("desc").take(limit);
    }

    if (args.campusCode) {
      batches = batches.filter((batch) => batch.campusCode === args.campusCode);
    }

    if (args.receiptStatus) {
      batches = batches.filter(
        (batch) => batch.receiptStatus === args.receiptStatus
      );
    }

    if (args.weekStartDate) {
      batches = batches.filter(
        (batch) => batch.weekStartDate === args.weekStartDate
      );
    }

    if (args.deletedOnly) {
      batches = batches.filter((batch) => batch.isDeleted === true);
    } else if (!args.includeDeleted) {
      batches = batches.filter((batch) => batch.isDeleted !== true);
    }

    return await Promise.all(
      batches.map(async (batch) => {
        const enteredBy = await ctx.db.get(batch.enteredByUserId);
        const approvedBy = batch.approvedByUserId
          ? await ctx.db.get(batch.approvedByUserId)
          : null;
        const deletedBy = batch.deletedByUserId
          ? await ctx.db.get(batch.deletedByUserId)
          : null;

        const items = await ctx.db
          .query("purchaseItems")
          .withIndex("by_purchaseBatchId", (q) =>
            q.eq("purchaseBatchId", batch._id)
          )
          .collect();

        return {
          ...batch,
          enteredByName: enteredBy?.name ?? "Unknown",
          approvedByName: approvedBy?.name ?? null,
          deletedByName: deletedBy?.name ?? null,
          itemCount: items.length,
        };
      })
    );
  },
});

/**
 * 🔹 GET PURCHASE BATCH WITH ITEMS
 */
export const getBatch = query({
  args: {
    purchaseBatchId: v.id("purchaseBatches"),
  },

  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.purchaseBatchId);

    if (!batch) return null;

    const items = await ctx.db
      .query("purchaseItems")
      .withIndex("by_purchaseBatchId", (q) =>
        q.eq("purchaseBatchId", args.purchaseBatchId)
      )
      .collect();

    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const inventoryItem = item.inventoryItemId
          ? await ctx.db.get(item.inventoryItemId)
          : null;

        return {
          ...item,
          inventoryItemName: inventoryItem?.name ?? null,
          inventoryItemUnit: inventoryItem?.unit ?? null,
          inventoryItemCurrentStock: inventoryItem?.currentStock ?? null,
        };
      })
    );

    const enteredBy = await ctx.db.get(batch.enteredByUserId);
    const approvedBy = batch.approvedByUserId
      ? await ctx.db.get(batch.approvedByUserId)
      : null;
    const deletedBy = batch.deletedByUserId
      ? await ctx.db.get(batch.deletedByUserId)
      : null;

    return {
      ...batch,
      enteredByName: enteredBy?.name ?? "Unknown",
      approvedByName: approvedBy?.name ?? null,
      deletedByName: deletedBy?.name ?? null,
      items: enrichedItems.sort((a, b) =>
        a.normalizedItemName.localeCompare(b.normalizedItemName)
      ),
    };
  },
});

/**
 * 🔹 MARK PURCHASE BATCH AS REVIEWED
 */
export const markReviewed = mutation({
  args: {
    purchaseBatchId: v.id("purchaseBatches"),
    actor: v.optional(v.string()),
    notes: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.purchaseBatchId);

    if (!batch) {
      throw new Error("Purchase batch not found.");
    }

    assertBatchNotDeleted(batch);

    if (batch.receiptStatus === "APPROVED") {
      throw new Error("Purchase batch is already approved.");
    }

    if (batch.receiptStatus === "REJECTED") {
      throw new Error("Cannot review a rejected purchase batch.");
    }

    await ctx.db.patch(args.purchaseBatchId, {
      receiptStatus: "REVIEWED",
      notes: args.notes?.trim() || batch.notes,
      updatedAt: now(),
    });

    return {
      success: true,
      purchaseBatchId: args.purchaseBatchId,
      receiptStatus: "REVIEWED",
    };
  },
});

/**
 * 🔹 APPROVE PURCHASE BATCH
 */
export const approveBatch = mutation({
  args: {
    purchaseBatchId: v.id("purchaseBatches"),
    approvedByUserId: v.id("appUsers"),
    actor: v.optional(v.string()),
    notes: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.purchaseBatchId);

    if (!batch) {
      throw new Error("Purchase batch not found.");
    }

    assertBatchNotDeleted(batch);

    if (batch.receiptStatus === "APPROVED") {
      throw new Error("Purchase batch is already approved.");
    }

    if (batch.receiptStatus === "REJECTED") {
      throw new Error("Cannot approve a rejected purchase batch.");
    }

    const items = await ctx.db
      .query("purchaseItems")
      .withIndex("by_purchaseBatchId", (q) =>
        q.eq("purchaseBatchId", args.purchaseBatchId)
      )
      .collect();

    if (items.length === 0) {
      throw new Error("Cannot approve a purchase batch with no items.");
    }

    const unlinkedItems = items.filter((item) => !item.inventoryItemId);

    if (unlinkedItems.length > 0) {
      throw new Error(
        "Every purchase item must be linked to an inventory item before approval."
      );
    }

    const approvedAt = now();

    for (const purchaseItem of items) {
      if (!purchaseItem.inventoryItemId) continue;

      const inventoryItem = await ctx.db.get(purchaseItem.inventoryItemId);

      if (!inventoryItem) {
        throw new Error(
          `Inventory item not found for ${purchaseItem.normalizedItemName}.`
        );
      }

      const oldStock = inventoryItem.currentStock;
      const newStock = oldStock + purchaseItem.quantity;

      const oldAverage =
        inventoryItem.averageUnitCost ??
        inventoryItem.lastUnitCost ??
        purchaseItem.unitCost;

      const oldValue = oldStock * oldAverage;
      const addedValue = purchaseItem.quantity * purchaseItem.unitCost;

      const newAverage =
        newStock > 0 ? (oldValue + addedValue) / newStock : purchaseItem.unitCost;

      await ctx.db.patch(purchaseItem.inventoryItemId, {
        currentStock: newStock,
        averageUnitCost: newAverage,
        lastUnitCost: purchaseItem.unitCost,
        lastPurchaseDate: batch.shoppingDate,
        updatedAt: approvedAt,
      });

      await ctx.db.insert("inventoryMovements", {
        inventoryItemId: purchaseItem.inventoryItemId,
        movementType: "STOCK_IN",
        quantity: purchaseItem.quantity,

        orderId: null,
        purchaseBatchId: args.purchaseBatchId,
        kitchenIssueId: null,
        kitchenClosingId: null,

        sourceCampusCode: null,
        targetCampusCode: inventoryItem.campusCode,

        unitCost: purchaseItem.unitCost,
        totalCost: purchaseItem.totalCost,

        createdByUserId: args.approvedByUserId,

        createdAt: approvedAt,
        notes:
          args.notes?.trim() ||
          `Stock in from purchase batch ${batch.batchNumber}`,
      });

      await createActivityLog(ctx, {
        actionType: "INVENTORY_STOCK_IN",
        purchaseBatchId: args.purchaseBatchId,
        inventoryItemId: purchaseItem.inventoryItemId,
        itemName: inventoryItem.name,
        actor: args.actor ?? null,
        details: `Approved purchase stock-in: ${purchaseItem.quantity} ${inventoryItem.unit} of ${inventoryItem.name}`,
        targetCampusCode: inventoryItem.campusCode,
        quantity: purchaseItem.quantity,
        amount: purchaseItem.totalCost,
      });
    }

    await ctx.db.patch(args.purchaseBatchId, {
      receiptStatus: "APPROVED",
      approvedByUserId: args.approvedByUserId,
      approvedAt,
      notes: args.notes?.trim() || batch.notes,
      updatedAt: approvedAt,
    });

    await createActivityLog(ctx, {
      actionType: "PURCHASE_BATCH_APPROVED",
      purchaseBatchId: args.purchaseBatchId,
      actor: args.actor ?? null,
      details:
        args.notes?.trim() ||
        `Approved purchase batch ${batch.batchNumber} worth ${batch.totalAmount}`,
      targetCampusCode: batch.campusCode,
      amount: batch.totalAmount,
    });

    return {
      success: true,
      purchaseBatchId: args.purchaseBatchId,
      receiptStatus: "APPROVED",
      itemCount: items.length,
      totalAmount: batch.totalAmount,
    };
  },
});



/**
 * 🔹 EXTRACT RECEIPT WITH AI
 *
 * This public action fixes the frontend call to purchases:extractReceiptWithAi.
 *
 * Important: this is a safe bridge action. It validates that the batch exists
 * and that a receipt has been uploaded, then returns a clear result instead
 * of crashing with "public function not found".
 *
 * When you are ready, replace the inside of this handler with the real
 * Mistral OCR flow: read batch receipt URL, send the file to Mistral, parse
 * rows, then call addItem/update a helper mutation to save extracted rows.
 */
export const extractReceiptWithAi = action({
  args: {
    purchaseBatchId: v.id("purchaseBatches"),
    actor: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const batch = await ctx.runQuery(api.purchases.getBatch, {
      purchaseBatchId: args.purchaseBatchId,
    });

    if (!batch) {
      throw new Error("Purchase batch not found.");
    }

    if (batch.isDeleted === true) {
      throw new Error("This purchase batch has been archived/deleted and cannot be changed.");
    }

    if (batch.receiptStatus === "APPROVED") {
      throw new Error("This receipt has already been received into inventory.");
    }

    if (batch.receiptStatus === "REJECTED") {
      throw new Error("Cannot extract AI rows from a rejected receipt.");
    }

    if (!batch.receiptImageUrl) {
      throw new Error("Upload a receipt before running AI extraction.");
    }

    return {
      success: true,
      purchaseBatchId: args.purchaseBatchId,
      savedCount: 0,
      message:
        "AI extraction function is now available, but the real Mistral OCR parser is not wired yet. Add rows manually or connect Mistral inside this action.",
      actor: args.actor ?? null,
    };
  },
});

/**
 * 🔹 RECEIVE PURCHASE BATCH DIRECTLY INTO INVENTORY
 *
 * This is the lightweight offloading dock flow:
 * receipt rows are extracted/reviewed on screen, then one confirmation updates inventory.
 *
 * It keeps the permanent audit trail in inventoryMovements and activityLogs.
 * After successful stock-in, it clears heavy AI/OCR draft data from the purchase batch.
 */

export const receiveBatchToInventory = mutation({
 args: {
   purchaseBatchId: v.id("purchaseBatches"),
   receivedByUserId: v.id("appUsers"),
   actor: v.optional(v.string()),
   notes: v.optional(v.string()),
 },

 handler: async (ctx, args) => {
   const batch = await ctx.db.get(args.purchaseBatchId);

   if (!batch) {
     throw new Error("Purchase batch not found.");
   }

   assertBatchNotDeleted(batch);

   if (batch.receiptStatus === "APPROVED") {
     throw new Error("This receipt has already been received into inventory.");
   }

   if (batch.receiptStatus === "REJECTED") {
     throw new Error("Cannot receive a rejected receipt into inventory.");
   }

   const receiver = await ctx.db.get(args.receivedByUserId);

   if (!receiver) {
     throw new Error("Receiving user not found.");
   }

   const items = await ctx.db
     .query("purchaseItems")
     .withIndex("by_purchaseBatchId", (q) =>
       q.eq("purchaseBatchId", args.purchaseBatchId)
     )
     .collect();

   if (items.length === 0) {
     throw new Error("Cannot receive inventory from a receipt with no items.");
   }

   const unlinkedItems = items.filter((item) => !item.inventoryItemId);

   if (unlinkedItems.length > 0) {
     const names = unlinkedItems
       .map((item) => item.normalizedItemName || item.itemNameRaw)
       .slice(0, 5)
       .join(", ");

     throw new Error(
       `Link all receipt items to inventory before receiving stock. Unlinked: ${names}`
     );
   }

   const receivedAt = now();

   for (const purchaseItem of items) {
     if (!purchaseItem.inventoryItemId) continue;

     const inventoryItem = await ctx.db.get(purchaseItem.inventoryItemId);

     if (!inventoryItem) {
       throw new Error(
         `Inventory item not found for ${purchaseItem.normalizedItemName}.`
       );
     }

     if (inventoryItem.isActive === false) {
       throw new Error(
         `Inventory item ${inventoryItem.name} is inactive. Reactivate it before receiving stock.`
       );
     }

     const oldStock = inventoryItem.currentStock;
     const receivedQuantity = purchaseItem.quantity;
     const newStock = oldStock + receivedQuantity;

     const oldAverage =
       inventoryItem.averageUnitCost ??
       inventoryItem.lastUnitCost ??
       purchaseItem.unitCost;

     const oldValue = oldStock * oldAverage;
     const addedValue = receivedQuantity * purchaseItem.unitCost;

     const newAverage =
       newStock > 0
         ? (oldValue + addedValue) / newStock
         : purchaseItem.unitCost;

     await ctx.db.patch(purchaseItem.inventoryItemId, {
       currentStock: newStock,
       averageUnitCost: newAverage,
       lastUnitCost: purchaseItem.unitCost,
       lastPurchaseDate: batch.shoppingDate,
       updatedAt: receivedAt,
     });

     await ctx.db.insert("inventoryMovements", {
       inventoryItemId: purchaseItem.inventoryItemId,
       movementType: "STOCK_IN",
       quantity: receivedQuantity,

       orderId: null,
       purchaseBatchId: args.purchaseBatchId,
       kitchenIssueId: null,
       kitchenClosingId: null,

       sourceCampusCode: null,
       targetCampusCode: inventoryItem.campusCode,

       unitCost: purchaseItem.unitCost,
       totalCost: purchaseItem.totalCost,

       createdByUserId: args.receivedByUserId,

       createdAt: receivedAt,
       notes:
         args.notes?.trim() ||
         `Received stock from receipt batch ${batch.batchNumber}`,
     });

     await createActivityLog(ctx, {
       actionType: "INVENTORY_STOCK_IN",
       purchaseBatchId: args.purchaseBatchId,
       inventoryItemId: purchaseItem.inventoryItemId,
       itemName: inventoryItem.name,
       actor: args.actor ?? receiver.name,
       details: `Received from receipt: ${receivedQuantity} ${inventoryItem.unit} of ${inventoryItem.name}`,
       targetCampusCode: inventoryItem.campusCode,
       quantity: receivedQuantity,
       amount: purchaseItem.totalCost,
     });
   }

   await ctx.db.patch(args.purchaseBatchId, {
     receiptStatus: "APPROVED",
     approvedByUserId: args.receivedByUserId,
     approvedAt: receivedAt,

     /**
      * Keep Purchases lightweight after receiving stock.
      * Inventory movements remain as the permanent audit trail.
      * Receipt file reference remains for proof.
      * Heavy OCR / AI extraction payload is cleared.
      */
     aiExtractedJson: null,
     aiConfidence: null,

     reviewNotes:
       "Receipt received into inventory. Heavy AI/OCR draft data cleared after stock-in.",
     notes: args.notes?.trim() || batch.notes,
     updatedAt: receivedAt,
   });

   await createActivityLog(ctx, {
     actionType: "PURCHASE_BATCH_APPROVED",
     purchaseBatchId: args.purchaseBatchId,
     actor: args.actor ?? receiver.name,
     details:
       args.notes?.trim() ||
       `Received receipt batch ${batch.batchNumber} into inventory`,
     targetCampusCode: batch.campusCode,
     amount: batch.totalAmount,
   });

   return {
     success: true,
     purchaseBatchId: args.purchaseBatchId,
     receiptStatus: "APPROVED",
     receivedItemCount: items.length,
     totalAmount: batch.totalAmount,
   };
 },
});

/**
 * 🔹 REJECT PURCHASE BATCH
 */
export const rejectBatch = mutation({
  args: {
    purchaseBatchId: v.id("purchaseBatches"),
    actor: v.optional(v.string()),
    notes: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.purchaseBatchId);

    if (!batch) {
      throw new Error("Purchase batch not found.");
    }

    assertBatchNotDeleted(batch);

    if (batch.receiptStatus === "APPROVED") {
      throw new Error("Cannot reject an approved purchase batch.");
    }

    await ctx.db.patch(args.purchaseBatchId, {
      receiptStatus: "REJECTED",
      notes: args.notes?.trim() || batch.notes,
      updatedAt: now(),
    });

    await createActivityLog(ctx, {
      actionType: "PURCHASE_BATCH_REJECTED",
      purchaseBatchId: args.purchaseBatchId,
      actor: args.actor ?? null,
      details:
        args.notes?.trim() ||
        `Rejected purchase batch ${batch.batchNumber}`,
      targetCampusCode: batch.campusCode,
      amount: batch.totalAmount,
    });

    return {
      success: true,
      purchaseBatchId: args.purchaseBatchId,
      receiptStatus: "REJECTED",
    };
  },
});


/**
 * 🔹 SOFT DELETE / ARCHIVE PURCHASE BATCH
 *
 * Super admin UI uses this to hide old/test batches without destroying audit history.
 * Approved batches are archived only; inventory movements are NOT reversed here.
 */
export const softDeleteBatch = mutation({
  args: {
    purchaseBatchId: v.id("purchaseBatches"),
    deletedByUserId: v.id("appUsers"),
    reason: v.string(),
    actor: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.purchaseBatchId);

    if (!batch) {
      throw new Error("Purchase batch not found.");
    }

    if (batch.isDeleted === true) {
      throw new Error("Purchase batch is already archived/deleted.");
    }

    const user = await ctx.db.get(args.deletedByUserId);

    if (!user) {
      throw new Error("Deleting user not found.");
    }

    if (user.role !== "super_admin") {
      throw new Error("Only a super admin can archive/delete purchase batches.");
    }

    const reason = cleanText(args.reason);

    if (!reason) {
      throw new Error("A delete/archive reason is required.");
    }

    const deletedAt = now();

    await ctx.db.patch(args.purchaseBatchId, {
      isDeleted: true,
      deletedAt,
      deletedByUserId: args.deletedByUserId,
      deleteReason: reason,
      updatedAt: deletedAt,
    });

    await createActivityLog(ctx, {
      actionType: "PURCHASE_BATCH_DELETED",
      purchaseBatchId: args.purchaseBatchId,
      actor: args.actor ?? user.name,
      details: `Archived/deleted purchase batch ${batch.batchNumber}. Reason: ${reason}`,
      targetCampusCode: batch.campusCode,
      amount: batch.totalAmount,
    });

    return {
      success: true,
      purchaseBatchId: args.purchaseBatchId,
      isDeleted: true,
      deletedAt,
    };
  },
});

/**
 * 🔹 RESTORE ARCHIVED PURCHASE BATCH
 */
export const restoreBatch = mutation({
  args: {
    purchaseBatchId: v.id("purchaseBatches"),
    restoredByUserId: v.id("appUsers"),
    actor: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.purchaseBatchId);

    if (!batch) {
      throw new Error("Purchase batch not found.");
    }

    const user = await ctx.db.get(args.restoredByUserId);

    if (!user) {
      throw new Error("Restoring user not found.");
    }

    if (user.role !== "super_admin") {
      throw new Error("Only a super admin can restore archived purchase batches.");
    }

    await ctx.db.patch(args.purchaseBatchId, {
      isDeleted: false,
      deletedAt: null,
      deletedByUserId: null,
      deleteReason: null,
      updatedAt: now(),
    });

    await createActivityLog(ctx, {
      actionType: "PURCHASE_BATCH_RESTORED",
      purchaseBatchId: args.purchaseBatchId,
      actor: args.actor ?? user.name,
      details: `Restored archived purchase batch ${batch.batchNumber}`,
      targetCampusCode: batch.campusCode,
      amount: batch.totalAmount,
    });

    return {
      success: true,
      purchaseBatchId: args.purchaseBatchId,
      isDeleted: false,
    };
  },
});

/**
 * 🔹 PURCHASE PRICE HISTORY FOR ONE INVENTORY ITEM
 */
export const getPriceHistory = query({
  args: {
    inventoryItemId: v.id("inventoryItems"),
    limit: v.optional(v.number()),
  },

  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 200);

    const items = await ctx.db
      .query("purchaseItems")
      .withIndex("by_inventoryItemId", (q) =>
        q.eq("inventoryItemId", args.inventoryItemId)
      )
      .order("desc")
      .take(limit);

    const rows = await Promise.all(
      items.map(async (item) => {
        const batch = await ctx.db.get(item.purchaseBatchId);

        return {
          purchaseItemId: item._id,
          purchaseBatchId: item.purchaseBatchId,
          batchNumber: batch?.batchNumber ?? "Unknown batch",
          shoppingDate: batch?.shoppingDate ?? null,
          weekStartDate: batch?.weekStartDate ?? null,
          weekEndDate: batch?.weekEndDate ?? null,
          supplierName: batch?.supplierName ?? null,
          receiptStatus: batch?.receiptStatus ?? null,

          itemName: item.normalizedItemName,
          quantity: item.quantity,
          unit: item.unit,
          totalCost: item.totalCost,
          unitCost: item.unitCost,
        };
      })
    );

    return rows;
  },
});

/**
 * 🔹 WEEKLY PURCHASE SUMMARY
 */
export const getWeeklyPurchaseSummary = query({
  args: {
    campusCode: campusValidator,
    weekStartDate: v.string(),
    weekEndDate: v.string(),
  },

  handler: async (ctx, args) => {
    const batches = await ctx.db
      .query("purchaseBatches")
      .withIndex("by_campusCode", (q) => q.eq("campusCode", args.campusCode))
      .collect();

    const weekBatches = batches.filter(
      (batch) =>
        batch.isDeleted !== true &&
        batch.weekStartDate === args.weekStartDate &&
        batch.weekEndDate === args.weekEndDate
    );

    const approvedBatches = weekBatches.filter(
      (batch) => batch.receiptStatus === "APPROVED"
    );

    const batchIds = new Set(weekBatches.map((batch) => batch._id));
    const approvedBatchIds = new Set(approvedBatches.map((batch) => batch._id));

    const allItems = await ctx.db.query("purchaseItems").collect();

    const weekItems = allItems.filter((item) =>
      batchIds.has(item.purchaseBatchId)
    );

    const approvedItems = allItems.filter((item) =>
      approvedBatchIds.has(item.purchaseBatchId)
    );

    const totalSubmitted = weekBatches.reduce(
      (sum, batch) => sum + batch.totalAmount,
      0
    );

    const totalApproved = approvedBatches.reduce(
      (sum, batch) => sum + batch.totalAmount,
      0
    );

    const byCategory = approvedItems.reduce(
      (
        acc: Record<
          string,
          {
            quantity: number;
            totalCost: number;
          }
        >,
        item
      ) => {
        if (!acc[item.category]) {
          acc[item.category] = {
            quantity: 0,
            totalCost: 0,
          };
        }

        acc[item.category].quantity += item.quantity;
        acc[item.category].totalCost += item.totalCost;

        return acc;
      },
      {}
    );

    return {
      campusCode: args.campusCode,
      weekStartDate: args.weekStartDate,
      weekEndDate: args.weekEndDate,

      batchCount: weekBatches.length,
      approvedBatchCount: approvedBatches.length,

      itemCount: weekItems.length,
      approvedItemCount: approvedItems.length,

      totalSubmitted,
      totalApproved,

      byCategory,
    };
  },
});