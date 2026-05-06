// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const permissionsValidator = v.object({
  viewMainStudents: v.boolean(),
  viewDigitalStudents: v.boolean(),
  viewParentContacts: v.boolean(),
  markMealsServed: v.boolean(),
  editMealRegistration: v.boolean(),
  viewHistoricalData: v.boolean(),
  generateReports: v.boolean(),
  viewAllClasses: v.boolean(),
  viewFullHistory: v.boolean(),
});

const campusValidator = v.union(
  v.literal("MAIN_SCHOOL"),
  v.literal("DIGITAL_SCHOOL")
);

const userSchoolValidator = v.union(
  v.literal("main"),
  v.literal("digital"),
  v.literal("both")
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

const mealCategoryValidator = v.union(
  v.literal("LUNCH"),
  v.literal("TEA"),
  v.literal("SNACK"),
  v.literal("FRUIT"),
  v.literal("OTHER")
);

export default defineSchema({
  students: defineTable({
    admNo: v.string(),
    studentName: v.string(),
    class: v.string(),
    school: campusValidator,
    parentName: v.string(),
    contact: v.string(),

    meals: v.object({
      lunch: v.boolean(),
      fruit: v.boolean(),
      tea: v.boolean(),
      snacks: v.boolean(),
    }),

    mealPackage: v.union(v.string(), v.null()),
    hasMealRegistration: v.boolean(),

    currentPoints: v.optional(v.number()),
    debtBalance: v.optional(v.number()),
    debtLimit: v.optional(v.number()),
    lowBalanceThreshold: v.optional(v.number()),

    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_admNo", ["admNo"])
    .index("by_school", ["school"])
    .index("by_class", ["class"])
    .index("by_school_and_class", ["school", "class"])
    .index("by_hasMealRegistration", ["hasMealRegistration"])
    .index("by_contact", ["contact"]),

  appUsers: defineTable({
    authUserId: v.union(v.string(), v.null()),
    email: v.string(),
    name: v.string(),
    staff_id: v.string(),

    requestedSchool: v.optional(userSchoolValidator),

    school: userSchoolValidator,

    role: v.union(
      v.literal("super_admin"),
      v.literal("admin"),
      v.literal("manager"),
      v.literal("staff"),
      v.literal("teacher"),
      v.literal("headteacher")
    ),

    status: v.union(
      v.literal("active"),
      v.literal("pending"),
      v.literal("deactivated")
    ),

    permissions: permissionsValidator,
    class_assigned: v.optional(v.string()),

    createdBy: v.union(v.string(), v.null()),
    approvedBy: v.union(v.string(), v.null()),
    approvedAt: v.union(v.string(), v.null()),

    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_role", ["role"])
    .index("by_school", ["school"])
    .index("by_status_and_role", ["status", "role"]),

  inventoryItems: defineTable({
    name: v.string(),
    category: inventoryCategoryValidator,
    unit: v.string(),
    campusCode: campusValidator,
    currentStock: v.number(),
    reorderLevel: v.number(),
    isActive: v.boolean(),

    // Optional costing helpers. Existing records remain valid.
    averageUnitCost: v.optional(v.number()),
    lastUnitCost: v.optional(v.number()),
    lastPurchaseDate: v.optional(v.union(v.string(), v.null())),

    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_campusCode", ["campusCode"])
    .index("by_campusCode_and_category", ["campusCode", "category"])
    .index("by_isActive", ["isActive"]),

  campusOrders: defineTable({
    orderNumber: v.string(),

    requestedByUserId: v.id("appUsers"),
    requestingCampusCode: campusValidator,
    supplyingCampusCode: campusValidator,

    status: v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("PARTIALLY_APPROVED"),
      v.literal("REJECTED"),
      v.literal("PACKED"),
      v.literal("DISPATCHED"),
      v.literal("RECEIVED"),
      v.literal("CANCELLED")
    ),

    notes: v.union(v.string(), v.null()),
    neededBy: v.union(v.string(), v.null()),

    approvedByUserId: v.union(v.id("appUsers"), v.null()),
    dispatchedByUserId: v.union(v.id("appUsers"), v.null()),
    receivedByUserId: v.union(v.id("appUsers"), v.null()),

    approvedAt: v.optional(v.union(v.string(), v.null())),
    packedAt: v.optional(v.union(v.string(), v.null())),
    dispatchedAt: v.optional(v.union(v.string(), v.null())),
    receivedAt: v.optional(v.union(v.string(), v.null())),

    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_status", ["status"])
    .index("by_requestingCampusCode", ["requestingCampusCode"])
    .index("by_supplyingCampusCode", ["supplyingCampusCode"])
    .index("by_orderNumber", ["orderNumber"]),

  campusOrderItems: defineTable({
    orderId: v.id("campusOrders"),
    inventoryItemId: v.id("inventoryItems"),

    itemNameSnapshot: v.string(),
    unitSnapshot: v.string(),

    requestedQty: v.number(),
    approvedQty: v.union(v.number(), v.null()),
    dispatchedQty: v.union(v.number(), v.null()),
    receivedQty: v.union(v.number(), v.null()),

    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_orderId", ["orderId"]),

  inventoryMovements: defineTable({
    inventoryItemId: v.id("inventoryItems"),

    movementType: v.union(
      v.literal("STOCK_IN"),
      v.literal("DISPATCH_OUT"),
      v.literal("RECEIPT_IN"),
      v.literal("ADJUSTMENT"),
      v.literal("KITCHEN_ISSUE"),
      v.literal("WASTE"),
      v.literal("LEFTOVER_RETURN")
    ),

    quantity: v.number(),

    orderId: v.union(v.id("campusOrders"), v.null()),

    // Optional links for purchases/kitchen operations.
    purchaseBatchId: v.optional(v.union(v.id("purchaseBatches"), v.null())),
    kitchenIssueId: v.optional(v.union(v.id("kitchenIssues"), v.null())),
    kitchenClosingId: v.optional(v.union(v.id("dailyKitchenClosings"), v.null())),

    sourceCampusCode: v.union(campusValidator, v.null()),
    targetCampusCode: v.union(campusValidator, v.null()),

    unitCost: v.optional(v.union(v.number(), v.null())),
    totalCost: v.optional(v.union(v.number(), v.null())),

    createdByUserId: v.optional(v.union(v.id("appUsers"), v.null())),

    createdAt: v.string(),
    notes: v.union(v.string(), v.null()),
  })
    .index("by_inventoryItemId", ["inventoryItemId"])
    .index("by_orderId", ["orderId"])
    .index("by_purchaseBatchId", ["purchaseBatchId"])
    .index("by_kitchenIssueId", ["kitchenIssueId"])
    .index("by_kitchenClosingId", ["kitchenClosingId"])
    .index("by_createdAt", ["createdAt"]),

  /**
   * Purchase receipt / weekly shopping batch.
   * One shopping trip or one receipt upload/manual entry.
   */
  purchaseBatches: defineTable({
    batchNumber: v.string(),

    supplierName: v.union(v.string(), v.null()),
    receiptImageUrl: v.union(v.string(), v.null()),

    receiptEntryMode: v.union(
      v.literal("MANUAL"),
      v.literal("IMAGE_UPLOAD"),
      v.literal("AI_EXTRACTED")
    ),

    receiptStatus: v.union(
      v.literal("DRAFT"),
      v.literal("UPLOADED"),
      v.literal("AI_EXTRACTED"),
      v.literal("NEEDS_REVIEW"),
      v.literal("REVIEWED"),
      v.literal("APPROVED"),
      v.literal("REJECTED")
    ),

    totalAmount: v.number(),

    shoppingDate: v.string(),
    weekStartDate: v.string(),
    weekEndDate: v.string(),

    campusCode: campusValidator,

    enteredByUserId: v.id("appUsers"),
    approvedByUserId: v.union(v.id("appUsers"), v.null()),
    approvedAt: v.union(v.string(), v.null()),

    notes: v.union(v.string(), v.null()),

    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_batchNumber", ["batchNumber"])
    .index("by_receiptStatus", ["receiptStatus"])
    .index("by_campusCode", ["campusCode"])
    .index("by_weekStartDate", ["weekStartDate"])
    .index("by_shoppingDate", ["shoppingDate"]),

  purchaseItems: defineTable({
    purchaseBatchId: v.id("purchaseBatches"),

    inventoryItemId: v.union(v.id("inventoryItems"), v.null()),

    itemNameRaw: v.string(),
    normalizedItemName: v.string(),

    category: inventoryCategoryValidator,

    quantity: v.number(),
    unit: v.string(),

    totalCost: v.number(),
    unitCost: v.number(),

    notes: v.union(v.string(), v.null()),

    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_purchaseBatchId", ["purchaseBatchId"])
    .index("by_inventoryItemId", ["inventoryItemId"])
    .index("by_category", ["category"]),

  /**
   * Store room → kitchen issue.
   * This captures what leaves the store and goes into the kitchen.
   */
  kitchenIssues: defineTable({
    issueNumber: v.string(),

    issuedByUserId: v.id("appUsers"),
    receivedByUserId: v.union(v.id("appUsers"), v.null()),

    campusCode: campusValidator,
    issueDate: v.string(),

    purpose: v.union(
      v.literal("LUNCH_PREP"),
      v.literal("TEA_PREP"),
      v.literal("SNACK_PREP"),
      v.literal("FRUIT_SERVICE"),
      v.literal("DIGITAL_CAMPUS_PACKING"),
      v.literal("OTHER")
    ),

    status: v.union(
      v.literal("DRAFT"),
      v.literal("ISSUED"),
      v.literal("RECEIVED"),
      v.literal("CANCELLED")
    ),

    notes: v.union(v.string(), v.null()),

    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_issueNumber", ["issueNumber"])
    .index("by_campusCode", ["campusCode"])
    .index("by_issueDate", ["issueDate"])
    .index("by_status", ["status"]),

  kitchenIssueItems: defineTable({
    kitchenIssueId: v.id("kitchenIssues"),
    inventoryItemId: v.id("inventoryItems"),

    itemNameSnapshot: v.string(),
    unitSnapshot: v.string(),

    quantityIssued: v.number(),

    estimatedUnitCost: v.number(),
    estimatedTotalCost: v.number(),

    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_kitchenIssueId", ["kitchenIssueId"])
    .index("by_inventoryItemId", ["inventoryItemId"]),

  /**
   * End-of-day kitchen closing.
   * Used for leftovers, waste, and daily meal operation accountability.
   */
  dailyKitchenClosings: defineTable({
    closingDate: v.string(),
    campusCode: campusValidator,

    closedByUserId: v.id("appUsers"),

    lunchServedCount: v.number(),
    teaServedCount: v.number(),
    snackServedCount: v.number(),
    fruitServedCount: v.number(),

    notes: v.union(v.string(), v.null()),

    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_closingDate", ["closingDate"])
    .index("by_campusCode", ["campusCode"])
    .index("by_campusCode_and_closingDate", ["campusCode", "closingDate"]),

  dailyKitchenClosingItems: defineTable({
    closingId: v.id("dailyKitchenClosings"),
    inventoryItemId: v.id("inventoryItems"),

    itemNameSnapshot: v.string(),
    unitSnapshot: v.string(),

    quantityLeftover: v.number(),
    quantityWasted: v.number(),

    estimatedUnitCost: v.number(),
    leftoverValue: v.number(),
    wasteCost: v.number(),

    notes: v.union(v.string(), v.null()),

    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_closingId", ["closingId"])
    .index("by_inventoryItemId", ["inventoryItemId"]),

  /**
   * Optional cost recipe/rule per serving.
   * Example: one lunch uses 0.15kg rice, 0.08kg beans, etc.
   */
  mealCostRules: defineTable({
    mealCategory: mealCategoryValidator,

    inventoryItemId: v.id("inventoryItems"),
    itemNameSnapshot: v.string(),

    quantityPerServing: v.number(),
    unitSnapshot: v.string(),

    isActive: v.boolean(),

    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_mealCategory", ["mealCategory"])
    .index("by_inventoryItemId", ["inventoryItemId"])
    .index("by_isActive", ["isActive"]),

  /**
   * Saved weekly profit/loss report.
   * We can generate this from purchases, kitchen issues, closings, and mealHistory.
   */
  weeklyMealReports: defineTable({
    reportNumber: v.string(),

    campusCode: campusValidator,

    weekStartDate: v.string(),
    weekEndDate: v.string(),

    totalPurchasesCost: v.number(),
    totalKitchenIssuedCost: v.number(),
    totalWasteCost: v.number(),
    totalLeftoverValue: v.number(),

    lunchServedCount: v.number(),
    teaServedCount: v.number(),
    snackServedCount: v.number(),
    fruitServedCount: v.number(),

    estimatedRevenue: v.number(),
    estimatedGrossProfit: v.number(),
    estimatedGrossMargin: v.number(),

    aiSummary: v.union(v.string(), v.null()),
    alerts: v.array(v.string()),

    generatedByUserId: v.id("appUsers"),

    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_reportNumber", ["reportNumber"])
    .index("by_campusCode", ["campusCode"])
    .index("by_weekStartDate", ["weekStartDate"])
    .index("by_campusCode_and_weekStartDate", ["campusCode", "weekStartDate"]),

  mpesaMessages: defineTable({
    sender: v.string(),
    text: v.string(),
    sentStamp: v.union(v.string(), v.null()),
    receivedStamp: v.union(v.string(), v.null()),
    sim: v.union(v.string(), v.null()),

    transactionCode: v.union(v.string(), v.null()),
    amount: v.union(v.number(), v.null()),
    accountReferenceRaw: v.union(v.string(), v.null()),
    payerName: v.union(v.string(), v.null()),
    paidAtRaw: v.union(v.string(), v.null()),

    parsedAdmNos: v.array(v.string()),
    parsedItemLabel: v.union(v.string(), v.null()),

    parsingStatus: v.union(
      v.literal("parsed"),
      v.literal("partial"),
      v.literal("failed")
    ),

    processingStatus: v.union(
      v.literal("received"),
      v.literal("matched"),
      v.literal("needs_review"),
      v.literal("processed")
    ),

    matchedStudentIds: v.array(v.id("students")),
    notes: v.union(v.string(), v.null()),

    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_transactionCode", ["transactionCode"])
    .index("by_processingStatus", ["processingStatus"])
    .index("by_sender", ["sender"])
    .index("by_createdAt", ["createdAt"]),

  payments: defineTable({
    mpesaMessageId: v.union(v.id("mpesaMessages"), v.null()),
    transactionCode: v.string(),
    amount: v.number(),

    payerName: v.union(v.string(), v.null()),
    payerPhone: v.union(v.string(), v.null()),

    accountReferenceRaw: v.union(v.string(), v.null()),
    parsedAdmNos: v.array(v.string()),
    itemLabel: v.union(v.string(), v.null()),

    studentId: v.union(v.id("students"), v.null()),
    studentAdmNo: v.union(v.string(), v.null()),

    matchMethod: v.union(
      v.literal("admission_number"),
      v.literal("parent_phone"),
      v.literal("manual"),
      v.literal("unmatched")
    ),

    matchConfidence: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low")
    ),

    status: v.union(
      v.literal("matched"),
      v.literal("unmatched"),
      v.literal("needs_review"),
      v.literal("posted")
    ),

    paidAtRaw: v.union(v.string(), v.null()),
    postedAt: v.union(v.string(), v.null()),
    notes: v.union(v.string(), v.null()),

    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_transactionCode", ["transactionCode"])
    .index("by_status", ["status"])
    .index("by_studentId", ["studentId"])
    .index("by_studentAdmNo", ["studentAdmNo"])
    .index("by_matchMethod", ["matchMethod"]),

  walletTransactions: defineTable({
    studentId: v.id("students"),
    studentAdmNo: v.string(),

    transactionType: v.union(
      v.literal("TOPUP"),
      v.literal("MEAL_PURCHASE"),
      v.literal("DEBT_USAGE"),
      v.literal("DEBT_REPAYMENT"),
      v.literal("ADJUSTMENT")
    ),

    itemName: v.union(v.string(), v.null()),

    itemCategory: v.union(
      v.literal("LUNCH"),
      v.literal("TEA"),
      v.literal("SNACK"),
      v.literal("FRUIT"),
      v.literal("OTHER"),
      v.null()
    ),

    points: v.number(),
    balanceBefore: v.number(),
    balanceAfter: v.number(),
    debtBefore: v.number(),
    debtAfter: v.number(),

    paymentId: v.union(v.id("payments"), v.null()),
    createdBy: v.union(v.string(), v.null()),
    notes: v.union(v.string(), v.null()),

    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_studentId", ["studentId"])
    .index("by_studentAdmNo", ["studentAdmNo"])
    .index("by_transactionType", ["transactionType"])
    .index("by_createdAt", ["createdAt"]),

  mealHistory: defineTable({
    studentId: v.id("students"),
    studentAdmNo: v.string(),
    studentNameSnapshot: v.string(),
    classSnapshot: v.string(),

    itemName: v.string(),

    itemCategory: mealCategoryValidator,

    pointsCost: v.number(),

    usedDebt: v.boolean(),
    debtUsedPoints: v.number(),

    receiptPrinted: v.boolean(),
    receiptReference: v.string(),
    printedBy: v.union(v.string(), v.null()),
    printedAt: v.string(),

    servedAt: v.string(),
    notes: v.union(v.string(), v.null()),

    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_studentId", ["studentId"])
    .index("by_studentAdmNo", ["studentAdmNo"])
    .index("by_receiptReference", ["receiptReference"])
    .index("by_servedAt", ["servedAt"]),

  activityLogs: defineTable({
    actionType: v.union(
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
    ),

    studentId: v.union(v.id("students"), v.null()),
    studentAdmNo: v.union(v.string(), v.null()),
    studentNameSnapshot: v.union(v.string(), v.null()),
    classSnapshot: v.union(v.string(), v.null()),

    itemName: v.union(v.string(), v.null()),
    points: v.union(v.number(), v.null()),
    receiptReference: v.union(v.string(), v.null()),

    actor: v.union(v.string(), v.null()),
    details: v.union(v.string(), v.null()),

    // New accountability links.
    orderId: v.optional(v.union(v.id("campusOrders"), v.null())),
    inventoryItemId: v.optional(v.union(v.id("inventoryItems"), v.null())),
    purchaseBatchId: v.optional(v.union(v.id("purchaseBatches"), v.null())),
    kitchenIssueId: v.optional(v.union(v.id("kitchenIssues"), v.null())),
    kitchenClosingId: v.optional(v.union(v.id("dailyKitchenClosings"), v.null())),

    sourceCampusCode: v.optional(v.union(campusValidator, v.null())),
    targetCampusCode: v.optional(v.union(campusValidator, v.null())),

    quantity: v.optional(v.union(v.number(), v.null())),
    amount: v.optional(v.union(v.number(), v.null())),

    createdAt: v.string(),
  })
    .index("by_actionType", ["actionType"])
    .index("by_studentId", ["studentId"])
    .index("by_studentAdmNo", ["studentAdmNo"])
    .index("by_createdAt", ["createdAt"])
    .index("by_orderId", ["orderId"])
    .index("by_inventoryItemId", ["inventoryItemId"])
    .index("by_purchaseBatchId", ["purchaseBatchId"])
    .index("by_kitchenIssueId", ["kitchenIssueId"])
    .index("by_kitchenClosingId", ["kitchenClosingId"]),

  menuItems: defineTable({
    name: v.string(),

    category: mealCategoryValidator,

    points: v.number(),
    isActive: v.boolean(),

    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_name", ["name"])
    .index("by_category", ["category"])
    .index("by_isActive", ["isActive"]),
});