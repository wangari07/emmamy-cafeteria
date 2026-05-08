import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

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

function normalizeCategory(value?: string | null):
  | "LUNCH"
  | "SNACK"
  | "DRINK"
  | "FRUIT"
  | "TEA"
  | "SUPPLY"
  | "OTHER" {
  const raw = (value || "").toUpperCase().trim();

  if (raw.includes("LUNCH") || raw.includes("RICE") || raw.includes("UGALI") || raw.includes("BEANS") || raw.includes("MAIZE") || raw.includes("FLOUR")) return "LUNCH";
  if (raw.includes("TEA") || raw.includes("MILK") || raw.includes("SUGAR")) return "TEA";
  if (raw.includes("SNACK") || raw.includes("BREAD") || raw.includes("BISCUIT") || raw.includes("CAKE")) return "SNACK";
  if (raw.includes("FRUIT") || raw.includes("BANANA") || raw.includes("APPLE") || raw.includes("ORANGE") || raw.includes("MANGO")) return "FRUIT";
  if (raw.includes("DRINK") || raw.includes("JUICE") || raw.includes("WATER")) return "DRINK";
  if (raw.includes("SUPPLY") || raw.includes("SOAP") || raw.includes("TISSUE") || raw.includes("CLEAN")) return "SUPPLY";

  return "OTHER";
}

function normalizeMatchText(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function guessUnit(value?: string | null) {
  const unit = (value || "").trim().toLowerCase();
  if (!unit) return "pcs";
  if (["kg", "kgs", "kilogram", "kilograms"].includes(unit)) return "kg";
  if (["g", "gram", "grams"].includes(unit)) return "g";
  if (["l", "lt", "ltr", "litre", "litres", "liter", "liters"].includes(unit)) return "litres";
  if (["ml", "millilitre", "millilitres"].includes(unit)) return "ml";
  if (["pc", "pcs", "piece", "pieces", "item", "items"].includes(unit)) return "pcs";
  if (["tray", "trays"].includes(unit)) return "trays";
  if (["crate", "crates"].includes(unit)) return "crates";
  if (["packet", "packets", "pkt", "pkts"].includes(unit)) return "packets";
  if (["bag", "bags", "sack", "sacks"].includes(unit)) return "bags";
  return unit;
}

function parseJsonFromAiText(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");

    if (first === -1 || last === -1 || last <= first) {
      throw new Error("AI did not return valid JSON.");
    }

    return JSON.parse(cleaned.slice(first, last + 1));
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const maybeBuffer = (globalThis as any).Buffer;

  if (maybeBuffer) {
    return maybeBuffer.from(buffer).toString("base64");
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
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

      entrySource: "MANUAL",
      aiConfidence: null,
      aiNeedsReview: false,
      aiLineIndex: null,

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
 * 🔹 SAVE AI EXTRACTED ITEMS
 *
 * This mutation stores AI output as reviewable purchase item rows.
 * It does not approve the batch and it does not update inventory stock.
 */
export const saveAiExtractedItems = mutation({
  args: {
    purchaseBatchId: v.id("purchaseBatches"),
    supplierName: v.optional(v.union(v.string(), v.null())),
    shoppingDate: v.optional(v.union(v.string(), v.null())),
    aiConfidence: v.optional(v.union(v.number(), v.null())),
    aiExtractedJson: v.optional(v.any()),
    actor: v.optional(v.string()),
    replaceExistingAiItems: v.optional(v.boolean()),
    items: v.array(
      v.object({
        itemNameRaw: v.string(),
        normalizedItemName: v.optional(v.string()),
        category: inventoryCategoryValidator,
        quantity: v.number(),
        unit: v.string(),
        totalCost: v.number(),
        aiConfidence: v.optional(v.union(v.number(), v.null())),
        notes: v.optional(v.string()),
      })
    ),
  },

  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.purchaseBatchId);

    if (!batch) {
      throw new Error("Purchase batch not found.");
    }

    assertBatchNotDeleted(batch);

    if (batch.receiptStatus === "APPROVED") {
      throw new Error("Cannot extract AI items for an approved purchase batch.");
    }

    if (batch.receiptStatus === "REJECTED") {
      throw new Error("Cannot extract AI items for a rejected purchase batch.");
    }

    if (args.items.length === 0) {
      throw new Error("AI did not find any receipt items to save.");
    }

    const createdAt = now();

    const existingItems = await ctx.db
      .query("purchaseItems")
      .withIndex("by_purchaseBatchId", (q) =>
        q.eq("purchaseBatchId", args.purchaseBatchId)
      )
      .collect();

    if (args.replaceExistingAiItems ?? true) {
      for (const item of existingItems) {
        if ((item as any).entrySource === "AI_EXTRACTED") {
          await ctx.db.delete(item._id);
        }
      }
    }

    const remainingItems = (args.replaceExistingAiItems ?? true)
      ? existingItems.filter((item) => (item as any).entrySource !== "AI_EXTRACTED")
      : existingItems;

    const inventoryItems = await ctx.db
      .query("inventoryItems")
      .withIndex("by_campusCode", (q) => q.eq("campusCode", batch.campusCode))
      .collect();

    let aiTotal = 0;
    const savedItems = [];

    for (let index = 0; index < args.items.length; index += 1) {
      const raw = args.items[index];
      const itemNameRaw = cleanText(raw.itemNameRaw);
      const normalizedItemName = cleanText(raw.normalizedItemName || raw.itemNameRaw);
      const unit = guessUnit(raw.unit);
      const quantity = Number(raw.quantity);
      const totalCost = Number(raw.totalCost);
      const confidence = raw.aiConfidence ?? args.aiConfidence ?? null;

      if (!itemNameRaw || !normalizedItemName) continue;
      if (!Number.isFinite(quantity) || quantity <= 0) continue;
      if (!Number.isFinite(totalCost) || totalCost < 0) continue;

      const unitCost = totalCost / quantity;
      aiTotal += totalCost;

      const normalizedForMatch = normalizeMatchText(normalizedItemName);
      const matchedInventoryItem = inventoryItems.find((item) => {
        if (!item.isActive) return false;
        const inventoryName = normalizeMatchText(item.name);
        return (
          inventoryName === normalizedForMatch ||
          inventoryName.includes(normalizedForMatch) ||
          normalizedForMatch.includes(inventoryName)
        );
      });

      const needsReview = !matchedInventoryItem || confidence === null || confidence < 0.72;

      const purchaseItemId = await ctx.db.insert("purchaseItems", {
        purchaseBatchId: args.purchaseBatchId,
        inventoryItemId: matchedInventoryItem?._id ?? null,
        itemNameRaw,
        normalizedItemName,
        category: raw.category,
        quantity,
        unit,
        totalCost,
        unitCost,
        notes:
          raw.notes?.trim() ||
          (needsReview ? "AI extracted item needs staff review/linking." : "AI extracted item."),
        entrySource: "AI_EXTRACTED",
        aiConfidence: confidence,
        aiNeedsReview: needsReview,
        aiLineIndex: index,
        createdAt,
        updatedAt: createdAt,
      });

      savedItems.push({
        purchaseItemId,
        itemNameRaw,
        normalizedItemName,
        inventoryItemId: matchedInventoryItem?._id ?? null,
        inventoryItemName: matchedInventoryItem?.name ?? null,
        needsReview,
        aiConfidence: confidence,
      });
    }

    if (savedItems.length === 0) {
      throw new Error("AI output could not be saved because no valid receipt rows were found.");
    }

    const manualTotal = remainingItems.reduce((sum, item) => sum + item.totalCost, 0);
    const nextTotalAmount = manualTotal + aiTotal;

    const patch: any = {
      receiptEntryMode: "AI_EXTRACTED",
      receiptStatus: "AI_EXTRACTED",
      aiExtractedJson: args.aiExtractedJson ?? null,
      aiConfidence: args.aiConfidence ?? null,
      reviewNotes: "AI extracted receipt items. Staff must review and link items before approval.",
      totalAmount: nextTotalAmount,
      updatedAt: createdAt,
    };

    if (args.supplierName !== undefined) {
      const supplierName = args.supplierName?.trim();
      if (supplierName) patch.supplierName = supplierName;
    }

    if (args.shoppingDate !== undefined) {
      const shoppingDate = args.shoppingDate?.trim();
      if (shoppingDate) patch.shoppingDate = shoppingDate;
    }

    await ctx.db.patch(args.purchaseBatchId, patch);

    await createActivityLog(ctx, {
      actionType: "PURCHASE_RECEIPT_AI_EXTRACTED",
      purchaseBatchId: args.purchaseBatchId,
      actor: args.actor ?? null,
      details: `AI extracted ${savedItems.length} receipt item(s) for ${batch.batchNumber}`,
      targetCampusCode: batch.campusCode,
      quantity: savedItems.length,
      amount: nextTotalAmount,
    });

    return {
      success: true,
      purchaseBatchId: args.purchaseBatchId,
      savedCount: savedItems.length,
      totalAmount: nextTotalAmount,
      items: savedItems,
    };
  },
});

/**
 * 🔹 EXTRACT RECEIPT WITH AI
 *
 * Uses the uploaded receipt file and Gemini API to extract draft purchase rows.
 * The saved rows still need staff review before approval.
 */
export const extractReceiptWithAi = action({
  args: {
    purchaseBatchId: v.id("purchaseBatches"),
    actor: v.optional(v.string()),
  },

  handler: async (ctx, args): Promise<any> => {
    const env = ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>;
    const apiKey = env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY;

    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY or GOOGLE_AI_API_KEY in Convex environment variables.");
    }

    const batch: any = await ctx.runQuery(api.purchases.getBatch, {
      purchaseBatchId: args.purchaseBatchId,
    });

    if (!batch) {
      throw new Error("Purchase batch not found.");
    }

    if (batch.isDeleted === true) {
      throw new Error("This purchase batch has been archived/deleted and cannot be changed.");
    }

    if (!batch.receiptStorageId) {
      throw new Error("Upload a receipt image or PDF before running AI extraction.");
    }

    if (batch.receiptStatus === "APPROVED" || batch.receiptStatus === "REJECTED") {
      throw new Error("Cannot extract AI items for an approved or rejected purchase batch.");
    }

    const receiptUrl = await ctx.storage.getUrl(batch.receiptStorageId);

    if (!receiptUrl) {
      throw new Error("Could not open the uploaded receipt file.");
    }

    const fileResponse = await fetch(receiptUrl);

    if (!fileResponse.ok) {
      throw new Error("Could not download the receipt file for AI extraction.");
    }

    const mimeType = batch.receiptMimeType || fileResponse.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await fileResponse.arrayBuffer();
    const base64File = arrayBufferToBase64(arrayBuffer);

    const prompt = `
You are extracting shopping receipt data for a Kenyan school cafeteria inventory system.
Return ONLY valid JSON. Do not include markdown.

Required JSON shape:
{
  "supplierName": string | null,
  "shoppingDate": "YYYY-MM-DD" | null,
  "receiptTotal": number | null,
  "aiConfidence": number,
  "items": [
    {
      "itemNameRaw": string,
      "normalizedItemName": string,
      "category": "LUNCH" | "TEA" | "SNACK" | "FRUIT" | "DRINK" | "SUPPLY" | "OTHER",
      "quantity": number,
      "unit": string,
      "totalCost": number,
      "aiConfidence": number,
      "notes": string | null
    }
  ]
}

Rules:
- Use Kenyan shillings for all money values but return numbers only.
- If quantity is not explicit, use 1 and explain in notes.
- If a line is unclear, still include it with lower aiConfidence and notes.
- Do not include VAT/subtotal/payment lines as inventory items unless they are actual products.
- Normalize common units to kg, g, litres, ml, pcs, trays, crates, packets, bags.
- Choose category based on school kitchen use.
`;

    const model = env.GEMINI_MODEL || "gemini-2.0-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: base64File,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI receipt extraction failed: ${errorText.slice(0, 500)}`);
    }

    const aiResponse = await response.json();
    const textParts = aiResponse?.candidates?.[0]?.content?.parts ?? [];
    const aiText = textParts.map((part: any) => part.text || "").join("\n").trim();

    if (!aiText) {
      throw new Error("AI did not return extraction text.");
    }

    const parsed = parseJsonFromAiText(aiText);
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];

    const cleanedItems = rawItems
      .map((item: any) => ({
        itemNameRaw: String(item.itemNameRaw || item.name || item.description || "").trim(),
        normalizedItemName: String(item.normalizedItemName || item.itemNameRaw || item.name || "").trim(),
        category: normalizeCategory(item.category),
        quantity: Number(item.quantity || 1),
        unit: guessUnit(item.unit || "pcs"),
        totalCost: Number(item.totalCost || item.total || item.amount || 0),
        aiConfidence:
          item.aiConfidence === undefined || item.aiConfidence === null
            ? parsed.aiConfidence ?? null
            : Number(item.aiConfidence),
        notes: item.notes ? String(item.notes) : undefined,
      }))
      .filter((item: any) => item.itemNameRaw && item.quantity > 0 && item.totalCost >= 0);

    if (cleanedItems.length === 0) {
      throw new Error("AI could not detect receipt line items. Try uploading a clearer receipt image.");
    }

    return await ctx.runMutation(api.purchases.saveAiExtractedItems, {
      purchaseBatchId: args.purchaseBatchId,
      supplierName: parsed.supplierName ? String(parsed.supplierName) : null,
      shoppingDate: parsed.shoppingDate ? String(parsed.shoppingDate) : null,
      aiConfidence:
        parsed.aiConfidence === undefined || parsed.aiConfidence === null
          ? null
          : Number(parsed.aiConfidence),
      aiExtractedJson: parsed,
      actor: args.actor,
      replaceExistingAiItems: true,
      items: cleanedItems,
    });
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