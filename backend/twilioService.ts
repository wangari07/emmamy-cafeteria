// ─── Twilio Service — Smart Message Templates ─────────────────────────────
// All SMS/WhatsApp message building and sending logic lives here.

export interface StudentData {
    id: string;
    name: string;
    class: string;
    parent_name: string;
    parent_phone: string;
    card_id?: string;
  }
  
  export interface MealRecord {
    meal_type: string;
    served_at?: string;
    created_at?: string;
  }
  
  // ─── Message Templates ────────────────────────────────────────────────────
  
  export function buildLowBalanceMessage(
    student: StudentData,
    balance: number,
    schoolName: string,
    schoolPhone: string
  ): string {
    return (
      `Dear ${student.parent_name}, this is to inform you that your child ` +
      `${student.name} of ${student.class} has a LOW meal card balance of ` +
      `KES ${balance.toFixed(2)}. Please top up their card to ensure uninterrupted ` +
      `meal access. For assistance call ${schoolPhone}. - ${schoolName}`
    );
  }
  
  export function buildEmptyBalanceMessage(
    student: StudentData,
    schoolName: string,
    schoolPhone: string
  ): string {
    return (
      `URGENT: Dear ${student.parent_name}, your child ${student.name} ` +
      `(${student.class}) has an EMPTY meal card balance (KES 0.00). ` +
      `They cannot access meals until the card is topped up. ` +
      `Please top up immediately. Call ${schoolPhone} for help. - ${schoolName}`
    );
  }
  
  export function buildMealConfirmationMessage(
    student: StudentData,
    meals: MealRecord[],
    schoolName: string
  ): string {
    if (meals.length === 0) {
      return (
        `Dear ${student.parent_name}, your child ${student.name} ` +
        `(${student.class}) has no recorded meals recently. ` +
        `Please contact the school if you have concerns. - ${schoolName}`
      );
    }
  
    const recent = meals.slice(0, 5);
    const mealLines = recent.map((m) => {
      const raw = m.served_at || m.created_at;
      const date = raw ? new Date(raw) : new Date();
      const dateStr = date.toLocaleDateString('en-KE', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
      const timeStr = date.toLocaleTimeString('en-KE', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `✅ ${m.meal_type} — ${dateStr}, ${timeStr}`;
    });
  
    return (
      `Dear ${student.parent_name}, meal history for ${student.name} ` +
      `(${student.class}):\n` +
      mealLines.join('\n') +
      `\nShowing last ${recent.length} meal(s). - ${schoolName}`
    );
  }
  
  export function buildMealServedConfirmationMessage(
    student: StudentData,
    mealType: string,
    schoolName: string
  ): string {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return (
      `Dear ${student.parent_name}, your child ${student.name} ` +
      `(${student.class}) has been served ${mealType} today at ${timeStr}. ` +
      `- ${schoolName}`
    );
  }
  
  export function buildOTPMessage(otp: string, schoolName: string): string {
    return (
      `Your ${schoolName} card top-up verification code is: ${otp}. ` +
      `Valid for 10 minutes. Do not share this code with anyone.`
    );
  }
  
  export function buildTopupConfirmationMessage(
    student: StudentData,
    amount: number,
    newBalance: number,
    schoolName: string
  ): string {
    return (
      `Dear ${student.parent_name}, a top-up of KES ${amount.toFixed(2)} ` +
      `has been added to ${student.name}'s (${student.class}) meal card. ` +
      `New balance: KES ${newBalance.toFixed(2)}. - ${schoolName}`
    );
  }
  
  // ─── OTP Generator ────────────────────────────────────────────────────────
  
  export function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }