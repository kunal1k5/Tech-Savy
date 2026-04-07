const axios = require("axios");
const logger = require("../utils/logger");

const provider = String(process.env.AUTH_SMS_PROVIDER || "mock").trim().toLowerCase();
const brandName = process.env.OTP_BRAND_NAME || "GigPredict AI";
const defaultCountryCode = String(process.env.AUTH_DEFAULT_COUNTRY_CODE || "91").replace(/\D/g, "");

function sanitizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  return digits.length > 10 ? digits.slice(-10) : digits;
}

function toE164(phone) {
  const sanitizedPhone = sanitizePhone(phone);
  if (!sanitizedPhone) {
    return "";
  }

  if (sanitizedPhone.startsWith("+")) {
    return sanitizedPhone;
  }

  return `+${defaultCountryCode}${sanitizedPhone}`;
}

function buildOtpMessage(otp, purpose) {
  const purposeText =
    purpose === "login"
      ? "login"
      : purpose === "register"
        ? "registration"
        : "verification";

  return `${brandName}: Your OTP for ${purposeText} is ${otp}. It expires in 5 minutes.`;
}

async function sendWithTwilio({ phone, otp, purpose }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!accountSid || !authToken) {
    const error = new Error("Twilio credentials are missing.");
    error.statusCode = 500;
    throw error;
  }

  if (!fromNumber && !messagingServiceSid) {
    const error = new Error("Set TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID.");
    error.statusCode = 500;
    throw error;
  }

  const payload = new URLSearchParams();
  payload.append("To", toE164(phone));
  payload.append("Body", buildOtpMessage(otp, purpose));

  if (messagingServiceSid) {
    payload.append("MessagingServiceSid", messagingServiceSid);
  } else {
    payload.append("From", fromNumber);
  }

  const response = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    payload.toString(),
    {
      auth: {
        username: accountSid,
        password: authToken,
      },
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: Number(process.env.AUTH_SMS_TIMEOUT_MS || 10000),
    }
  );

  return {
    provider: "twilio",
    providerMessageId: response.data?.sid || null,
    status: response.data?.status || "queued",
    recipient: response.data?.to || toE164(phone),
  };
}

async function sendWithMock({ phone, otp, purpose }) {
  const recipient = toE164(phone);
  logger.info(
    `[MOCK OTP] Sending OTP ${otp} to ${recipient} for ${purpose || "verification"}.`
  );

  return {
    provider: "mock",
    providerMessageId: `mock-${Date.now()}`,
    status: "simulated",
    recipient,
    devOtp: otp,
  };
}

async function sendOtp({ phone, otp, purpose }) {
  if (provider === "twilio") {
    return sendWithTwilio({ phone, otp, purpose });
  }

  return sendWithMock({ phone, otp, purpose });
}

module.exports = {
  sendOtp,
  sanitizePhone,
  toE164,
};
