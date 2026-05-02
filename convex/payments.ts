// convex/payments.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function normalizePhone(input: string | null | undefined) {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");

  if (digits.startsWith("254")) return `+${digits}`;
  if (digits.startsWith("0")) return `+254${digits.slice(1)}`;
  if (digits.length === 9) return `+254${digits}`;
  return input.trim();
}

function parseMpesaMealMessage(text: string) {
  const raw = text.trim();

  const transactionCodeMatch = raw.match(/^([A-Z0-9]{8,12})\s*~/i);
  const amountMatch = raw.match(/Payment Of Kshs\s*([\d,]+(?:\.\d{2})?)/i);
  const accountReferenceMatch = raw.match(/For Account\s+([^\.,]+?)(?:,\s*From|\s*From)/i);
  const payerNameMatch = raw.match(/,\s*From\s+(.+?)\s+On\s+\d{2}\/\d{2}\/\d{2}\s+At\s+/i);
  const paidAtMatch = raw.match(/On\s+(\d{2}\/\d{2}\/\d{2}\s+At\s+\d{2}:\d{2}\s+[AP]m)/i);

  const transactionCode = transactionCodeMatch ? transactionCodeMatch[1].trim().toUpperCase() : null;
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : null;
  const payerName = payerNameMatch ? payerNameMatch[1].trim() : null;
  const paidAtRaw = paidAtMatch ? paidAtMatch[1].trim() : null;

  const accountReferenceRaw = accountReferenceMatch ? accountReferenceMatch[1].trim() : null;

  let parsedAdmNos: string[] = [];
  let parsedItemLabel: string | null = null;

  if (accountReferenceRaw) {
    const afterHash = accountReferenceRaw.includes("#")
      ? accountReferenceRaw.split("#").slice(1).join("#").trim()
      : accountReferenceRaw.trim();

    const multiAdmMatches = afterHash.match(/\d+/g);
    if (multiAdmMatches?.length) {
      parsedAdmNos = [...new Set(multiAdmMatches.map((n) => n.trim()))];
    }

    const itemLabel = afterHash.replace(/[\d/\s]+/g, " ").replace(/\s+/g, " ").trim();
    parsedItemLabel = itemLabel.length > 0 ? itemLabel : null;
  }

  const parsingStatus =
    transactionCode && amount !== null
      ? parsedAdmNos.length > 0
        ? "parsed"
        : "partial"
      : "failed";

  return {
    transactionCode,
    amount,
    accountReferenceRaw,
    payerName,
    paidAtRaw,
    parsedAdmNos,
    parsedItemLabel,
    parsingStatus: parsingStatus as "parsed" | "partial" | "failed",
  };
}

export const ingestMpesaSms = mutation({
  args: {
    sender: v.string(),
    text: v.string(),
    sentStamp: v.optional(v.string()),
    receivedStamp: v.optional(v.string()),
    sim: v.optional(v.string()),
    payerPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const parsed = parseMpesaMealMessage(args.text);
    const normalizedPhone = normalizePhone(args.payerPhone ?? null);

    const existingMessage = parsed.transactionCode
      ? await ctx.db
          .query("mpesaMessages")
          .withIndex("by_transactionCode", (q) => q.eq("transactionCode", parsed.transactionCode))
          .first()
      : null;

    if (existingMessage) {
      return {
        ok: true,
        duplicate: true,
        mpesaMessageId: existingMessage._id,
        paymentId: null,
      };
    }

    let matchedStudentIds: any[] = [];
    let matchedStudentId: any = null;
    let matchedStudentAdmNo: string | null = null;
    let matchMethod: "admission_number" | "parent_phone" | "manual" | "unmatched" = "unmatched";
    let matchConfidence: "high" | "medium" | "low" = "low";
    let paymentStatus: "matched" | "unmatched" | "needs_review" | "posted" = "unmatched";
    let processingStatus: "received" | "matched" | "needs_review" | "processed" = "received";
    let notes: string | null = null;

    // Match 1: admission number
    if (parsed.parsedAdmNos.length === 1) {
      const student = await ctx.db
        .query("students")
        .withIndex("by_admNo", (q) => q.eq("admNo", parsed.parsedAdmNos[0]))
        .first();

      if (student) {
        matchedStudentIds = [student._id];
        matchedStudentId = student._id;
        matchedStudentAdmNo = student.admNo;
        matchMethod = "admission_number";
        matchConfidence = "high";
        paymentStatus = "matched";
        processingStatus = "matched";
      } else {
        paymentStatus = "needs_review";
        processingStatus = "needs_review";
        notes = `Admission number ${parsed.parsedAdmNos[0]} was parsed but no student was found.`;
      }
    } else if (parsed.parsedAdmNos.length > 1) {
      const foundStudents = [];
      for (const admNo of parsed.parsedAdmNos) {
        const student = await ctx.db
          .query("students")
          .withIndex("by_admNo", (q) => q.eq("admNo", admNo))
          .first();
        if (student) foundStudents.push(student);
      }

      matchedStudentIds = foundStudents.map((s) => s._id);
      paymentStatus = "needs_review";
      processingStatus = "needs_review";
      notes = "Multiple admission numbers were found in the payment reference.";
    } else if (normalizedPhone) {
      // Match 2: parent phone fallback
      const student = await ctx.db
        .query("students")
        .withIndex("by_contact", (q) => q.eq("contact", normalizedPhone))
        .first();

      if (student) {
        matchedStudentIds = [student._id];
        matchedStudentId = student._id;
        matchedStudentAdmNo = student.admNo;
        matchMethod = "parent_phone";
        matchConfidence = "medium";
        paymentStatus = "matched";
        processingStatus = "matched";
        notes = "Matched by parent phone because no admission number was parsed.";
      } else {
        paymentStatus = "needs_review";
        processingStatus = "needs_review";
        notes = "No admission number found and parent phone did not match any student.";
      }
    } else {
      paymentStatus = "needs_review";
      processingStatus = "needs_review";
      notes = "No admission number found and no payer phone available for matching.";
    }

    const mpesaMessageId = await ctx.db.insert("mpesaMessages", {
      sender: args.sender,
      text: args.text,
      sentStamp: args.sentStamp ?? null,
      receivedStamp: args.receivedStamp ?? null,
      sim: args.sim ?? null,

      transactionCode: parsed.transactionCode,
      amount: parsed.amount,
      accountReferenceRaw: parsed.accountReferenceRaw,
      payerName: parsed.payerName,
      paidAtRaw: parsed.paidAtRaw,

      parsedAdmNos: parsed.parsedAdmNos,
      parsedItemLabel: parsed.parsedItemLabel,
      parsingStatus: parsed.parsingStatus,

      processingStatus,
      matchedStudentIds,
      notes,

      createdAt: now,
      updatedAt: now,
    });

    const paymentId =
      parsed.transactionCode && parsed.amount !== null
        ? await ctx.db.insert("payments", {
            mpesaMessageId,
            transactionCode: parsed.transactionCode,
            amount: parsed.amount,

            payerName: parsed.payerName,
            payerPhone: normalizedPhone,

            accountReferenceRaw: parsed.accountReferenceRaw,
            parsedAdmNos: parsed.parsedAdmNos,
            itemLabel: parsed.parsedItemLabel,

            studentId: matchedStudentId,
            studentAdmNo: matchedStudentAdmNo,

            matchMethod,
            matchConfidence,
            status: paymentStatus,

            paidAtRaw: parsed.paidAtRaw,
            postedAt: null,
            notes,

            createdAt: now,
            updatedAt: now,
          })
        : null;

    return {
      ok: true,
      duplicate: false,
      mpesaMessageId,
      paymentId,
      matchedStudentId,
      matchedStudentAdmNo,
      matchMethod,
      paymentStatus,
      parsed,
    };
  },
});

export const listPayments = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("matched"),
        v.literal("unmatched"),
        v.literal("needs_review"),
        v.literal("posted")
      )
    ),
  },
  handler: async (ctx, args) => {
    let payments = await ctx.db.query("payments").collect();

    if (args.status) {
      payments = payments.filter((p) => p.status === args.status);
    }

    return payments.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
});

export const listMpesaMessages = query({
  args: {
    processingStatus: v.optional(
      v.union(
        v.literal("received"),
        v.literal("matched"),
        v.literal("needs_review"),
        v.literal("processed")
      )
    ),
  },
  handler: async (ctx, args) => {
    let messages = await ctx.db.query("mpesaMessages").collect();

    if (args.processingStatus) {
      messages = messages.filter((m) => m.processingStatus === args.processingStatus);
    }

    return messages.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
});

export const markPaymentPosted = mutation({
  args: {
    paymentId: v.id("payments"),
  },
  handler: async (ctx, { paymentId }) => {
    const payment = await ctx.db.get(paymentId);
    if (!payment) throw new Error("Payment not found.");

    const now = new Date().toISOString();

    await ctx.db.patch(paymentId, {
      status: "posted",
      postedAt: now,
      updatedAt: now,
    });

    if (payment.mpesaMessageId) {
      await ctx.db.patch(payment.mpesaMessageId, {
        processingStatus: "processed",
        updatedAt: now,
      });
    }

    return await ctx.db.get(paymentId);
  },
});

export const manuallyAttachPaymentToStudent = mutation({
  args: {
    paymentId: v.id("payments"),
    studentId: v.id("students"),
  },
  handler: async (ctx, { paymentId, studentId }) => {
    const payment = await ctx.db.get(paymentId);
    if (!payment) throw new Error("Payment not found.");

    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found.");

    const now = new Date().toISOString();

    await ctx.db.patch(paymentId, {
      studentId,
      studentAdmNo: student.admNo,
      matchMethod: "manual",
      matchConfidence: "medium",
      status: "matched",
      notes: "Attached manually by admin.",
      updatedAt: now,
    });

    if (payment.mpesaMessageId) {
      await ctx.db.patch(payment.mpesaMessageId, {
        matchedStudentIds: [studentId],
        processingStatus: "matched",
        notes: "Matched manually by admin.",
        updatedAt: now,
      });
    }

    return await ctx.db.get(paymentId);
  },
});