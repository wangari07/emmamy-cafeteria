import AfricasTalking from "africastalking";

const username = process.env.AT_USERNAME;
const apiKey = process.env.AT_API_KEY;
const senderId = process.env.AT_SENDER_ID || undefined;

if (!username || !apiKey) {
  throw new Error("Missing Africa's Talking credentials in environment variables.");
}

const africasTalking = AfricasTalking({
  username,
  apiKey,
});

const sms = africasTalking.SMS;

function normalizeKenyanPhone(phone: string) {
  const cleaned = phone.replace(/\s+/g, "").trim();

  if (cleaned.startsWith("+254")) return cleaned;
  if (cleaned.startsWith("254")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+254${cleaned.slice(1)}`;

  return cleaned;
}

export async function sendSms(to: string, message: string) {
  const cleanedTo = normalizeKenyanPhone(to);

  if (!cleanedTo) {
    throw new Error("Recipient phone number is required.");
  }

  if (!message.trim()) {
    throw new Error("Message body is required.");
  }

  const payload: {
    to: string[];
    message: string;
    senderId?: string;
  } = {
    to: [cleanedTo],
    message: message.trim(),
  };

  if (senderId) {
    payload.senderId = senderId;
  }

  const result = await sms.send(payload);
  return result;
}