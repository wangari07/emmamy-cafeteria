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

export default defineSchema({
  students: defineTable({
    admNo: v.string(),
    studentName: v.string(),
    class: v.string(),
    school: v.union(v.literal("MAIN_SCHOOL"), v.literal("DIGITAL_SCHOOL")),
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

    // kept optional for compatibility with old student records
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

    requestedSchool: v.optional(
      v.union(v.literal("main"), v.literal("digital"), v.literal("both"))
    ),

    school: v.union(
      v.literal("main"),
      v.literal("digital"),
      v.literal("both")
    ),

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
    category: v.union(
      v.literal("LUNCH"),
      v.literal("SNACK"),
      v.literal("DRINK"),
      v.literal("FRUIT"),
      v.literal("TEA"),
      v.literal("SUPPLY"),
      v.literal("OTHER")
    ),
    unit: v.string(),
    campusCode: v.union(v.literal("MAIN_SCHOOL"), v.literal("DIGITAL_SCHOOL")),
    currentStock: v.number(),
    reorderLevel: v.number(),
    isActive: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_campusCode", ["campusCode"])
    .index("by_campusCode_and_category", ["campusCode", "category"]),

  campusOrders: defineTable({
    orderNumber: v.string(),
    requestedByUserId: v.id("appUsers"),
    requestingCampusCode: v.union(v.literal("MAIN_SCHOOL"), v.literal("DIGITAL_SCHOOL")),
    supplyingCampusCode: v.union(v.literal("MAIN_SCHOOL"), v.literal("DIGITAL_SCHOOL")),
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
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_status", ["status"])
    .index("by_requestingCampusCode", ["requestingCampusCode"])
    .index("by_supplyingCampusCode", ["supplyingCampusCode"]),

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
      v.literal("ADJUSTMENT")
    ),
    quantity: v.number(),
    orderId: v.union(v.id("campusOrders"), v.null()),
    sourceCampusCode: v.union(
      v.literal("MAIN_SCHOOL"),
      v.literal("DIGITAL_SCHOOL"),
      v.null()
    ),
    targetCampusCode: v.union(
      v.literal("MAIN_SCHOOL"),
      v.literal("DIGITAL_SCHOOL"),
      v.null()
    ),
    createdAt: v.string(),
    notes: v.union(v.string(), v.null()),
  })
    .index("by_inventoryItemId", ["inventoryItemId"])
    .index("by_orderId", ["orderId"]),

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
    itemCategory: v.union(
      v.literal("LUNCH"),
      v.literal("TEA"),
      v.literal("SNACK"),
      v.literal("FRUIT"),
      v.literal("OTHER")
    ),
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
      v.literal("PRINT_MEAL_PASS"),
      v.literal("POST_PAYMENT"),
      v.literal("MANUAL_PAYMENT_ATTACH"),
      v.literal("SERVE_MEAL"),
      v.literal("WALLET_ADJUSTMENT")
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

    createdAt: v.string(),
  })
    .index("by_actionType", ["actionType"])
    .index("by_studentId", ["studentId"])
    .index("by_studentAdmNo", ["studentAdmNo"])
    .index("by_createdAt", ["createdAt"]),

  menuItems: defineTable({
    name: v.string(),
    category: v.union(
      v.literal("LUNCH"),
      v.literal("TEA"),
      v.literal("SNACK"),
      v.literal("FRUIT"),
      v.literal("OTHER")
    ),
    points: v.number(),
    isActive: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_name", ["name"])
    .index("by_category", ["category"])
    .index("by_isActive", ["isActive"]),
});