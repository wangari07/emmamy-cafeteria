import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const campusValidator = v.union(
  v.literal("MAIN_SCHOOL"),
  v.literal("DIGITAL_SCHOOL")
);

const orderStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("APPROVED"),
  v.literal("PARTIALLY_APPROVED"),
  v.literal("REJECTED"),
  v.literal("PACKED"),
  v.literal("DISPATCHED"),
  v.literal("RECEIVED"),
  v.literal("CANCELLED")
);

function now() {
  return new Date().toISOString();
}

function makeOrderNumber() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);

  const random = Math.floor(Math.random() * 9000) + 1000;

  return `CO-${stamp}-${random}`;
}

async function createActivityLog(
  ctx: any,
  args: {
    actionType:
      | "ORDER_CREATED"
      | "ORDER_APPROVED"
      | "ORDER_PARTIALLY_APPROVED"
      | "ORDER_REJECTED"
      | "ORDER_PACKED"
      | "ORDER_DISPATCHED"
      | "ORDER_RECEIVED"
      | "ORDER_CANCELLED"
      | "INVENTORY_DISPATCH_OUT";
    orderId?: any;
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

    orderId: args.orderId ?? null,
    inventoryItemId: args.inventoryItemId ?? null,
    purchaseBatchId: null,
    kitchenIssueId: null,
    kitchenClosingId: null,

    sourceCampusCode: args.sourceCampusCode ?? null,
    targetCampusCode: args.targetCampusCode ?? null,

    quantity: args.quantity ?? null,
    amount: args.amount ?? null,

    createdAt: now(),
  });
}

/**
 * 🔹 CREATE CAMPUS ORDER
 *
 * Digital school can request food/items from Main School.
 * Main School can also create internal requests if needed.
 */
export const createOrder = mutation({
  args: {
    requestedByUserId: v.id("appUsers"),

    requestingCampusCode: campusValidator,
    supplyingCampusCode: campusValidator,

    neededBy: v.optional(v.union(v.string(), v.null())),
    notes: v.optional(v.string()),

    items: v.array(
      v.object({
        inventoryItemId: v.id("inventoryItems"),
        requestedQty: v.number(),
      })
    ),

    actor: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    if (args.requestingCampusCode === args.supplyingCampusCode) {
      throw new Error("Requesting campus and supplying campus cannot be the same.");
    }

    if (args.items.length === 0) {
      throw new Error("Order must have at least one item.");
    }

    for (const item of args.items) {
      if (item.requestedQty <= 0) {
        throw new Error("Requested quantity must be greater than zero.");
      }
    }

    const createdAt = now();
    const orderNumber = makeOrderNumber();

    const orderId = await ctx.db.insert("campusOrders", {
      orderNumber,

      requestedByUserId: args.requestedByUserId,
      requestingCampusCode: args.requestingCampusCode,
      supplyingCampusCode: args.supplyingCampusCode,

      status: "PENDING",

      notes: args.notes?.trim() || null,
      neededBy: args.neededBy ?? null,

      approvedByUserId: null,
      dispatchedByUserId: null,
      receivedByUserId: null,

      approvedAt: null,
      packedAt: null,
      dispatchedAt: null,
      receivedAt: null,

      createdAt,
      updatedAt: createdAt,
    });

    for (const orderItem of args.items) {
      const inventoryItem = await ctx.db.get(orderItem.inventoryItemId);

      if (!inventoryItem) {
        throw new Error("Inventory item not found.");
      }

      if (inventoryItem.campusCode !== args.supplyingCampusCode) {
        throw new Error(
          `${inventoryItem.name} belongs to ${inventoryItem.campusCode}, not ${args.supplyingCampusCode}.`
        );
      }

      await ctx.db.insert("campusOrderItems", {
        orderId,
        inventoryItemId: orderItem.inventoryItemId,

        itemNameSnapshot: inventoryItem.name,
        unitSnapshot: inventoryItem.unit,

        requestedQty: orderItem.requestedQty,
        approvedQty: null,
        dispatchedQty: null,
        receivedQty: null,

        createdAt,
        updatedAt: createdAt,
      });
    }

    await createActivityLog(ctx, {
      actionType: "ORDER_CREATED",
      orderId,
      actor: args.actor ?? null,
      details:
        args.notes?.trim() ||
        `Created campus order ${orderNumber} from ${args.requestingCampusCode} to ${args.supplyingCampusCode}`,
      sourceCampusCode: args.requestingCampusCode,
      targetCampusCode: args.supplyingCampusCode,
      quantity: args.items.reduce((sum, item) => sum + item.requestedQty, 0),
    });

    return {
      success: true,
      orderId,
      orderNumber,
      status: "PENDING",
    };
  },
});

/**
 * 🔹 LIST CAMPUS ORDERS
 */
export const listOrders = query({
  args: {
    status: v.optional(orderStatusValidator),
    requestingCampusCode: v.optional(campusValidator),
    supplyingCampusCode: v.optional(campusValidator),
    limit: v.optional(v.number()),
  },

  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 100, 300);

    let orders;

    if (args.status) {
      orders = await ctx.db
        .query("campusOrders")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(limit);
    } else if (args.requestingCampusCode) {
      orders = await ctx.db
        .query("campusOrders")
        .withIndex("by_requestingCampusCode", (q) =>
          q.eq("requestingCampusCode", args.requestingCampusCode!)
        )
        .order("desc")
        .take(limit);
    } else if (args.supplyingCampusCode) {
      orders = await ctx.db
        .query("campusOrders")
        .withIndex("by_supplyingCampusCode", (q) =>
          q.eq("supplyingCampusCode", args.supplyingCampusCode!)
        )
        .order("desc")
        .take(limit);
    } else {
      orders = await ctx.db.query("campusOrders").order("desc").take(limit);
    }

    if (args.status) {
      orders = orders.filter((order) => order.status === args.status);
    }

    if (args.requestingCampusCode) {
      orders = orders.filter(
        (order) => order.requestingCampusCode === args.requestingCampusCode
      );
    }

    if (args.supplyingCampusCode) {
      orders = orders.filter(
        (order) => order.supplyingCampusCode === args.supplyingCampusCode
      );
    }

    return await Promise.all(
      orders.map(async (order) => {
        const requestedBy = await ctx.db.get(order.requestedByUserId);
        const approvedBy = order.approvedByUserId
          ? await ctx.db.get(order.approvedByUserId)
          : null;
        const dispatchedBy = order.dispatchedByUserId
          ? await ctx.db.get(order.dispatchedByUserId)
          : null;
        const receivedBy = order.receivedByUserId
          ? await ctx.db.get(order.receivedByUserId)
          : null;

        const items = await ctx.db
          .query("campusOrderItems")
          .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
          .collect();

        return {
          ...order,
          requestedByName: requestedBy?.name ?? "Unknown",
          approvedByName: approvedBy?.name ?? null,
          dispatchedByName: dispatchedBy?.name ?? null,
          receivedByName: receivedBy?.name ?? null,
          itemCount: items.length,
          totalRequestedQty: items.reduce((sum, item) => sum + item.requestedQty, 0),
          totalApprovedQty: items.reduce(
            (sum, item) => sum + (item.approvedQty ?? 0),
            0
          ),
          totalDispatchedQty: items.reduce(
            (sum, item) => sum + (item.dispatchedQty ?? 0),
            0
          ),
          totalReceivedQty: items.reduce(
            (sum, item) => sum + (item.receivedQty ?? 0),
            0
          ),
        };
      })
    );
  },
});

/**
 * 🔹 GET ORDER WITH ITEMS
 */
export const getOrder = query({
  args: {
    orderId: v.id("campusOrders"),
  },

  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);

    if (!order) return null;

    const items = await ctx.db
      .query("campusOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .collect();

    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const inventoryItem = await ctx.db.get(item.inventoryItemId);

        return {
          ...item,
          currentStock: inventoryItem?.currentStock ?? null,
          category: inventoryItem?.category ?? null,
          campusCode: inventoryItem?.campusCode ?? null,
          lastUnitCost: inventoryItem?.lastUnitCost ?? null,
          averageUnitCost: inventoryItem?.averageUnitCost ?? null,
        };
      })
    );

    const requestedBy = await ctx.db.get(order.requestedByUserId);
    const approvedBy = order.approvedByUserId
      ? await ctx.db.get(order.approvedByUserId)
      : null;
    const dispatchedBy = order.dispatchedByUserId
      ? await ctx.db.get(order.dispatchedByUserId)
      : null;
    const receivedBy = order.receivedByUserId
      ? await ctx.db.get(order.receivedByUserId)
      : null;

    return {
      ...order,
      requestedByName: requestedBy?.name ?? "Unknown",
      approvedByName: approvedBy?.name ?? null,
      dispatchedByName: dispatchedBy?.name ?? null,
      receivedByName: receivedBy?.name ?? null,
      items: enrichedItems,
    };
  },
});

/**
 * 🔹 APPROVE ORDER
 *
 * Main School approves requested quantities.
 * Can approve all, partially approve, or set some approvedQty to 0.
 */
export const approveOrder = mutation({
  args: {
    orderId: v.id("campusOrders"),
    approvedByUserId: v.id("appUsers"),

    items: v.array(
      v.object({
        orderItemId: v.id("campusOrderItems"),
        approvedQty: v.number(),
      })
    ),

    notes: v.optional(v.string()),
    actor: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);

    if (!order) {
      throw new Error("Campus order not found.");
    }

    if (order.status !== "PENDING") {
      throw new Error("Only pending orders can be approved.");
    }

    const existingItems = await ctx.db
      .query("campusOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .collect();

    if (existingItems.length === 0) {
      throw new Error("Order has no items.");
    }

    const approvals = new Map(
      args.items.map((item) => [item.orderItemId, item.approvedQty])
    );

    let totalRequestedQty = 0;
    let totalApprovedQty = 0;

    const approvedAt = now();

    for (const item of existingItems) {
      const approvedQty = approvals.has(item._id)
        ? approvals.get(item._id)!
        : item.requestedQty;

      if (approvedQty < 0) {
        throw new Error("Approved quantity cannot be negative.");
      }

      if (approvedQty > item.requestedQty) {
        throw new Error(
          `Approved quantity for ${item.itemNameSnapshot} cannot exceed requested quantity.`
        );
      }

      const inventoryItem = await ctx.db.get(item.inventoryItemId);

      if (!inventoryItem) {
        throw new Error(`Inventory item ${item.itemNameSnapshot} not found.`);
      }

      if (approvedQty > inventoryItem.currentStock) {
        throw new Error(
          `Not enough stock for ${inventoryItem.name}. Approved ${approvedQty} ${inventoryItem.unit}, available ${inventoryItem.currentStock} ${inventoryItem.unit}.`
        );
      }

      totalRequestedQty += item.requestedQty;
      totalApprovedQty += approvedQty;

      await ctx.db.patch(item._id, {
        approvedQty,
        updatedAt: approvedAt,
      });
    }

    const status =
      totalApprovedQty === 0
        ? "REJECTED"
        : totalApprovedQty < totalRequestedQty
          ? "PARTIALLY_APPROVED"
          : "APPROVED";

    await ctx.db.patch(args.orderId, {
      status,
      approvedByUserId: args.approvedByUserId,
      approvedAt,
      notes: args.notes?.trim() || order.notes,
      updatedAt: approvedAt,
    });

    await createActivityLog(ctx, {
      actionType:
        status === "PARTIALLY_APPROVED"
          ? "ORDER_PARTIALLY_APPROVED"
          : status === "REJECTED"
            ? "ORDER_REJECTED"
            : "ORDER_APPROVED",
      orderId: args.orderId,
      actor: args.actor ?? null,
      details:
        args.notes?.trim() ||
        `${status} order ${order.orderNumber}. Approved ${totalApprovedQty} of ${totalRequestedQty}.`,
      sourceCampusCode: order.supplyingCampusCode,
      targetCampusCode: order.requestingCampusCode,
      quantity: totalApprovedQty,
    });

    return {
      success: true,
      orderId: args.orderId,
      status,
      totalRequestedQty,
      totalApprovedQty,
    };
  },
});

/**
 * 🔹 REJECT ORDER
 */
export const rejectOrder = mutation({
  args: {
    orderId: v.id("campusOrders"),
    approvedByUserId: v.id("appUsers"),
    notes: v.optional(v.string()),
    actor: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);

    if (!order) {
      throw new Error("Campus order not found.");
    }

    if (order.status !== "PENDING") {
      throw new Error("Only pending orders can be rejected.");
    }

    const rejectedAt = now();

    await ctx.db.patch(args.orderId, {
      status: "REJECTED",
      approvedByUserId: args.approvedByUserId,
      approvedAt: rejectedAt,
      notes: args.notes?.trim() || order.notes,
      updatedAt: rejectedAt,
    });

    const items = await ctx.db
      .query("campusOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .collect();

    for (const item of items) {
      await ctx.db.patch(item._id, {
        approvedQty: 0,
        updatedAt: rejectedAt,
      });
    }

    await createActivityLog(ctx, {
      actionType: "ORDER_REJECTED",
      orderId: args.orderId,
      actor: args.actor ?? null,
      details: args.notes?.trim() || `Rejected order ${order.orderNumber}`,
      sourceCampusCode: order.supplyingCampusCode,
      targetCampusCode: order.requestingCampusCode,
    });

    return {
      success: true,
      orderId: args.orderId,
      status: "REJECTED",
    };
  },
});

/**
 * 🔹 MARK ORDER AS PACKED
 */
export const markPacked = mutation({
  args: {
    orderId: v.id("campusOrders"),
    actor: v.optional(v.string()),
    notes: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);

    if (!order) {
      throw new Error("Campus order not found.");
    }

    if (!["APPROVED", "PARTIALLY_APPROVED"].includes(order.status)) {
      throw new Error("Only approved orders can be marked as packed.");
    }

    const packedAt = now();

    await ctx.db.patch(args.orderId, {
      status: "PACKED",
      packedAt,
      notes: args.notes?.trim() || order.notes,
      updatedAt: packedAt,
    });

    await createActivityLog(ctx, {
      actionType: "ORDER_PACKED",
      orderId: args.orderId,
      actor: args.actor ?? null,
      details: args.notes?.trim() || `Packed order ${order.orderNumber}`,
      sourceCampusCode: order.supplyingCampusCode,
      targetCampusCode: order.requestingCampusCode,
    });

    return {
      success: true,
      orderId: args.orderId,
      status: "PACKED",
    };
  },
});

/**
 * 🔹 DISPATCH ORDER
 *
 * This deducts stock from supplying campus inventory.
 */
export const dispatchOrder = mutation({
  args: {
    orderId: v.id("campusOrders"),
    dispatchedByUserId: v.id("appUsers"),

    items: v.optional(
      v.array(
        v.object({
          orderItemId: v.id("campusOrderItems"),
          dispatchedQty: v.number(),
        })
      )
    ),

    notes: v.optional(v.string()),
    actor: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);

    if (!order) {
      throw new Error("Campus order not found.");
    }

    if (!["APPROVED", "PARTIALLY_APPROVED", "PACKED"].includes(order.status)) {
      throw new Error("Only approved or packed orders can be dispatched.");
    }

    const orderItems = await ctx.db
      .query("campusOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .collect();

    if (orderItems.length === 0) {
      throw new Error("Order has no items.");
    }

    const dispatchMap = new Map(
      (args.items ?? []).map((item) => [item.orderItemId, item.dispatchedQty])
    );

    for (const item of orderItems) {
      const approvedQty = item.approvedQty ?? 0;
      const dispatchedQty = dispatchMap.has(item._id)
        ? dispatchMap.get(item._id)!
        : approvedQty;

      if (dispatchedQty < 0) {
        throw new Error("Dispatched quantity cannot be negative.");
      }

      if (dispatchedQty > approvedQty) {
        throw new Error(
          `Dispatched quantity for ${item.itemNameSnapshot} cannot exceed approved quantity.`
        );
      }

      const inventoryItem = await ctx.db.get(item.inventoryItemId);

      if (!inventoryItem) {
        throw new Error(`Inventory item ${item.itemNameSnapshot} not found.`);
      }

      if (inventoryItem.campusCode !== order.supplyingCampusCode) {
        throw new Error(
          `${inventoryItem.name} does not belong to supplying campus ${order.supplyingCampusCode}.`
        );
      }

      if (dispatchedQty > inventoryItem.currentStock) {
        throw new Error(
          `Not enough stock for ${inventoryItem.name}. Dispatching ${dispatchedQty} ${inventoryItem.unit}, available ${inventoryItem.currentStock} ${inventoryItem.unit}.`
        );
      }
    }

    const dispatchedAt = now();
    let totalDispatchedQty = 0;
    let totalDispatchedCost = 0;

    for (const item of orderItems) {
      const approvedQty = item.approvedQty ?? 0;
      const dispatchedQty = dispatchMap.has(item._id)
        ? dispatchMap.get(item._id)!
        : approvedQty;

      const inventoryItem = await ctx.db.get(item.inventoryItemId);

      if (!inventoryItem) continue;

      const unitCost =
        inventoryItem.averageUnitCost ??
        inventoryItem.lastUnitCost ??
        0;

      const totalCost = dispatchedQty * unitCost;
      const newStock = inventoryItem.currentStock - dispatchedQty;

      await ctx.db.patch(item.inventoryItemId, {
        currentStock: newStock,
        updatedAt: dispatchedAt,
      });

      await ctx.db.patch(item._id, {
        dispatchedQty,
        updatedAt: dispatchedAt,
      });

      if (dispatchedQty > 0) {
        await ctx.db.insert("inventoryMovements", {
          inventoryItemId: item.inventoryItemId,
          movementType: "DISPATCH_OUT",
          quantity: -Math.abs(dispatchedQty),

          orderId: args.orderId,
          purchaseBatchId: null,
          kitchenIssueId: null,
          kitchenClosingId: null,

          sourceCampusCode: order.supplyingCampusCode,
          targetCampusCode: order.requestingCampusCode,

          unitCost,
          totalCost,

          createdByUserId: args.dispatchedByUserId,

          createdAt: dispatchedAt,
          notes:
            args.notes?.trim() ||
            `Dispatched ${dispatchedQty} ${inventoryItem.unit} of ${inventoryItem.name} for order ${order.orderNumber}`,
        });

        await createActivityLog(ctx, {
          actionType: "INVENTORY_DISPATCH_OUT",
          orderId: args.orderId,
          inventoryItemId: item.inventoryItemId,
          itemName: inventoryItem.name,
          actor: args.actor ?? null,
          details:
            args.notes?.trim() ||
            `Dispatched ${dispatchedQty} ${inventoryItem.unit} of ${inventoryItem.name}`,
          sourceCampusCode: order.supplyingCampusCode,
          targetCampusCode: order.requestingCampusCode,
          quantity: dispatchedQty,
          amount: totalCost,
        });
      }

      totalDispatchedQty += dispatchedQty;
      totalDispatchedCost += totalCost;
    }

    await ctx.db.patch(args.orderId, {
      status: "DISPATCHED",
      dispatchedByUserId: args.dispatchedByUserId,
      dispatchedAt,
      notes: args.notes?.trim() || order.notes,
      updatedAt: dispatchedAt,
    });

    await createActivityLog(ctx, {
      actionType: "ORDER_DISPATCHED",
      orderId: args.orderId,
      actor: args.actor ?? null,
      details:
        args.notes?.trim() ||
        `Dispatched order ${order.orderNumber}. Total quantity: ${totalDispatchedQty}`,
      sourceCampusCode: order.supplyingCampusCode,
      targetCampusCode: order.requestingCampusCode,
      quantity: totalDispatchedQty,
      amount: totalDispatchedCost,
    });

    return {
      success: true,
      orderId: args.orderId,
      status: "DISPATCHED",
      totalDispatchedQty,
      totalDispatchedCost,
    };
  },
});

/**
 * 🔹 CONFIRM RECEIPT
 *
 * Digital campus confirms what was actually received.
 */
export const confirmReceived = mutation({
  args: {
    orderId: v.id("campusOrders"),
    receivedByUserId: v.id("appUsers"),

    items: v.optional(
      v.array(
        v.object({
          orderItemId: v.id("campusOrderItems"),
          receivedQty: v.number(),
        })
      )
    ),

    notes: v.optional(v.string()),
    actor: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);

    if (!order) {
      throw new Error("Campus order not found.");
    }

    if (order.status !== "DISPATCHED") {
      throw new Error("Only dispatched orders can be marked as received.");
    }

    const orderItems = await ctx.db
      .query("campusOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .collect();

    if (orderItems.length === 0) {
      throw new Error("Order has no items.");
    }

    const receivedMap = new Map(
      (args.items ?? []).map((item) => [item.orderItemId, item.receivedQty])
    );

    let totalDispatchedQty = 0;
    let totalReceivedQty = 0;

    const receivedAt = now();

    for (const item of orderItems) {
      const dispatchedQty = item.dispatchedQty ?? 0;
      const receivedQty = receivedMap.has(item._id)
        ? receivedMap.get(item._id)!
        : dispatchedQty;

      if (receivedQty < 0) {
        throw new Error("Received quantity cannot be negative.");
      }

      if (receivedQty > dispatchedQty) {
        throw new Error(
          `Received quantity for ${item.itemNameSnapshot} cannot exceed dispatched quantity.`
        );
      }

      totalDispatchedQty += dispatchedQty;
      totalReceivedQty += receivedQty;

      await ctx.db.patch(item._id, {
        receivedQty,
        updatedAt: receivedAt,
      });
    }

    await ctx.db.patch(args.orderId, {
      status: "RECEIVED",
      receivedByUserId: args.receivedByUserId,
      receivedAt,
      notes: args.notes?.trim() || order.notes,
      updatedAt: receivedAt,
    });

    const shortage = totalDispatchedQty - totalReceivedQty;

    await createActivityLog(ctx, {
      actionType: "ORDER_RECEIVED",
      orderId: args.orderId,
      actor: args.actor ?? null,
      details:
        args.notes?.trim() ||
        `Received order ${order.orderNumber}. Received ${totalReceivedQty} of ${totalDispatchedQty}. Shortage: ${shortage}.`,
      sourceCampusCode: order.supplyingCampusCode,
      targetCampusCode: order.requestingCampusCode,
      quantity: totalReceivedQty,
    });

    return {
      success: true,
      orderId: args.orderId,
      status: "RECEIVED",
      totalDispatchedQty,
      totalReceivedQty,
      shortage,
    };
  },
});

/**
 * 🔹 CANCEL ORDER
 *
 * Only pending orders can be cancelled safely.
 */
export const cancelOrder = mutation({
  args: {
    orderId: v.id("campusOrders"),
    actor: v.optional(v.string()),
    notes: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);

    if (!order) {
      throw new Error("Campus order not found.");
    }

    if (order.status !== "PENDING") {
      throw new Error("Only pending orders can be cancelled.");
    }

    const cancelledAt = now();

    await ctx.db.patch(args.orderId, {
      status: "CANCELLED",
      notes: args.notes?.trim() || order.notes,
      updatedAt: cancelledAt,
    });

    await createActivityLog(ctx, {
      actionType: "ORDER_CANCELLED",
      orderId: args.orderId,
      actor: args.actor ?? null,
      details: args.notes?.trim() || `Cancelled order ${order.orderNumber}`,
      sourceCampusCode: order.requestingCampusCode,
      targetCampusCode: order.supplyingCampusCode,
    });

    return {
      success: true,
      orderId: args.orderId,
      status: "CANCELLED",
    };
  },
});

/**
 * 🔹 ORDER SUMMARY
 */
export const getSummary = query({
  args: {
    requestingCampusCode: v.optional(campusValidator),
    supplyingCampusCode: v.optional(campusValidator),
  },

  handler: async (ctx, args) => {
    let orders = await ctx.db.query("campusOrders").collect();

    if (args.requestingCampusCode) {
      orders = orders.filter(
        (order) => order.requestingCampusCode === args.requestingCampusCode
      );
    }

    if (args.supplyingCampusCode) {
      orders = orders.filter(
        (order) => order.supplyingCampusCode === args.supplyingCampusCode
      );
    }

    const byStatus = orders.reduce((acc: Record<string, number>, order) => {
      acc[order.status] = (acc[order.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      totalOrders: orders.length,
      pending: byStatus.PENDING ?? 0,
      approved: byStatus.APPROVED ?? 0,
      partiallyApproved: byStatus.PARTIALLY_APPROVED ?? 0,
      rejected: byStatus.REJECTED ?? 0,
      packed: byStatus.PACKED ?? 0,
      dispatched: byStatus.DISPATCHED ?? 0,
      received: byStatus.RECEIVED ?? 0,
      cancelled: byStatus.CANCELLED ?? 0,
      byStatus,
    };
  },
});