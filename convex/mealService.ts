// convex/mealService.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

type MenuCategory = "LUNCH" | "TEA" | "SNACK" | "FRUIT" | "OTHER";

function makeReceiptReference(studentAdmNo: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();

  return `MP-${studentAdmNo}-${y}${m}${d}-${h}${min}-${rand}`;
}

function getWallet(student: {
  currentPoints?: number;
  debtBalance?: number;
  debtLimit?: number;
  lowBalanceThreshold?: number;
}) {
  return {
    currentPoints: student.currentPoints ?? 0,
    debtBalance: student.debtBalance ?? 0,
    debtLimit: student.debtLimit ?? 200,
    lowBalanceThreshold: student.lowBalanceThreshold ?? 100,
  };
}

export const listMenuItems = query({
  args: {
    activeOnly: v.optional(v.boolean()),
    category: v.optional(
      v.union(
        v.literal("LUNCH"),
        v.literal("TEA"),
        v.literal("SNACK"),
        v.literal("FRUIT"),
        v.literal("OTHER")
      )
    ),
  },
  handler: async (ctx, args) => {
    let items = await ctx.db.query("menuItems").collect();

    if (args.activeOnly) {
      items = items.filter((item) => item.isActive);
    }

    if (args.category) {
      items = items.filter((item) => item.category === args.category);
    }

    return items.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const createMenuItem = mutation({
  args: {
    name: v.string(),
    category: v.union(
      v.literal("LUNCH"),
      v.literal("TEA"),
      v.literal("SNACK"),
      v.literal("FRUIT"),
      v.literal("OTHER")
    ),
    points: v.number(),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new Error("Menu item name is required.");
    if (args.points <= 0) throw new Error("Points must be greater than 0.");

    const existing = await ctx.db
      .query("menuItems")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();

    if (existing) {
      throw new Error("A menu item with that name already exists.");
    }

    const now = new Date().toISOString();

    return await ctx.db.insert("menuItems", {
      name,
      category: args.category,
      points: args.points,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateMenuItem = mutation({
  args: {
    menuItemId: v.id("menuItems"),
    name: v.optional(v.string()),
    category: v.optional(
      v.union(
        v.literal("LUNCH"),
        v.literal("TEA"),
        v.literal("SNACK"),
        v.literal("FRUIT"),
        v.literal("OTHER")
      )
    ),
    points: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.menuItemId);
    if (!item) throw new Error("Menu item not found.");

    const patch: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (typeof args.name === "string") {
      const trimmed = args.name.trim();
      if (!trimmed) throw new Error("Menu item name cannot be empty.");
      patch.name = trimmed;
    }

    if (args.category) {
      patch.category = args.category;
    }

    if (typeof args.points === "number") {
      if (args.points <= 0) throw new Error("Points must be greater than 0.");
      patch.points = args.points;
    }

    if (typeof args.isActive === "boolean") {
      patch.isActive = args.isActive;
    }

    await ctx.db.patch(args.menuItemId, patch);
    return await ctx.db.get(args.menuItemId);
  },
});

export const seedDefaultMenuItems = mutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date().toISOString();

    const defaults: Array<{ name: string; category: MenuCategory; points: number }> = [
      { name: "Lunch", category: "LUNCH", points: 100 },
      { name: "Tea", category: "TEA", points: 20 },
      { name: "Mandazi", category: "SNACK", points: 10 },
    ];

    let created = 0;
    let existing = 0;

    for (const item of defaults) {
      const found = await ctx.db
        .query("menuItems")
        .withIndex("by_name", (q) => q.eq("name", item.name))
        .first();

      if (found) {
        existing += 1;
        continue;
      }

      await ctx.db.insert("menuItems", {
        name: item.name,
        category: item.category,
        points: item.points,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      created += 1;
    }

    return {
      ok: true,
      created,
      existing,
      totalDefaults: defaults.length,
    };
  },
});

export const printMealPass = mutation({
  args: {
    studentId: v.id("students"),
    menuItemId: v.id("menuItems"),
    printedBy: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new Error("Student not found.");

    const menuItem = await ctx.db.get(args.menuItemId);
    if (!menuItem) throw new Error("Menu item not found.");
    if (!menuItem.isActive) {
      throw new Error("This menu item is inactive and cannot be served.");
    }

    const wallet = getWallet(student);
    const pointsCost = menuItem.points;
    const balanceBefore = wallet.currentPoints;
    const debtBefore = wallet.debtBalance;

    let balanceAfter = balanceBefore;
    let debtAfter = debtBefore;
    let usedDebt = false;
    let debtUsedPoints = 0;

    if (balanceBefore >= pointsCost) {
      balanceAfter = balanceBefore - pointsCost;
    } else {
      const shortfall = pointsCost - balanceBefore;
      const projectedDebt = debtBefore + shortfall;

      if (projectedDebt > wallet.debtLimit) {
        throw new Error(
          `Debt limit exceeded. Student requires ${shortfall} more points and cannot exceed ${wallet.debtLimit} debt points.`
        );
      }

      usedDebt = true;
      debtUsedPoints = shortfall;
      balanceAfter = 0;
      debtAfter = projectedDebt;
    }

    const now = new Date().toISOString();
    const receiptReference = makeReceiptReference(student.admNo);
    const notes = args.notes?.trim() || null;

    await ctx.db.patch(args.studentId, {
      currentPoints: balanceAfter,
      debtBalance: debtAfter,
      updatedAt: now,
    });

    await ctx.db.insert("walletTransactions", {
      studentId: student._id,
      studentAdmNo: student.admNo,
      transactionType: "MEAL_PURCHASE",
      itemName: menuItem.name,
      itemCategory: menuItem.category,
      points: -pointsCost,
      balanceBefore,
      balanceAfter,
      debtBefore,
      debtAfter,
      paymentId: null,
      createdBy: args.printedBy,
      notes,
      createdAt: now,
      updatedAt: now,
    });

    if (usedDebt && debtUsedPoints > 0) {
      await ctx.db.insert("walletTransactions", {
        studentId: student._id,
        studentAdmNo: student.admNo,
        transactionType: "DEBT_USAGE",
        itemName: menuItem.name,
        itemCategory: menuItem.category,
        points: debtUsedPoints,
        balanceBefore,
        balanceAfter,
        debtBefore,
        debtAfter,
        paymentId: null,
        createdBy: args.printedBy,
        notes: `Debt used during meal pass print for ${menuItem.name}.`,
        createdAt: now,
        updatedAt: now,
      });
    }

    const mealHistoryId = await ctx.db.insert("mealHistory", {
      studentId: student._id,
      studentAdmNo: student.admNo,
      studentNameSnapshot: student.studentName,
      classSnapshot: student.class,

      itemName: menuItem.name,
      itemCategory: menuItem.category,
      pointsCost,

      usedDebt,
      debtUsedPoints,

      receiptPrinted: true,
      receiptReference,
      printedBy: args.printedBy,
      printedAt: now,

      servedAt: now,
      notes,

      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("activityLogs", {
      actionType: "PRINT_MEAL_PASS",
      studentId: student._id,
      studentAdmNo: student.admNo,
      studentNameSnapshot: student.studentName,
      classSnapshot: student.class,
      itemName: menuItem.name,
      points: pointsCost,
      receiptReference,
      actor: args.printedBy,
      details: usedDebt
        ? `Meal pass printed using ${debtUsedPoints} debt points for ${menuItem.name}.`
        : `Meal pass printed for ${menuItem.name}.`,
      createdAt: now,
    });

    return {
      ok: true,
      mealHistoryId,
      receipt: {
        receiptReference,
        studentName: student.studentName,
        admissionNumber: student.admNo,
        className: student.class,
        school: student.school,
        menuItem: menuItem.name,
        category: menuItem.category,
        pointsCost,
        balanceBefore,
        balanceAfter,
        debtBefore,
        debtAfter,
        usedDebt,
        debtUsedPoints,
        printedBy: args.printedBy,
        printedAt: now,
      },
    };
  },
});

export const listMealHistoryByStudent = query({
  args: {
    studentId: v.id("students"),
  },
  handler: async (ctx, args) => {
    const history = await ctx.db
      .query("mealHistory")
      .withIndex("by_studentId", (q) => q.eq("studentId", args.studentId))
      .collect();

    return history.sort((a, b) => b.servedAt.localeCompare(a.servedAt));
  },
});

export const listWalletTransactionsByStudent = query({
  args: {
    studentId: v.id("students"),
  },
  handler: async (ctx, args) => {
    const txs = await ctx.db
      .query("walletTransactions")
      .withIndex("by_studentId", (q) => q.eq("studentId", args.studentId))
      .collect();

    return txs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
});

export const listRecentActivityLogs = query({
  args: {},
  handler: async (ctx) => {
    const logs = await ctx.db.query("activityLogs").collect();
    return logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
  },
});