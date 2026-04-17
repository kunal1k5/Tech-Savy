import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthShell from "../components/auth/AuthShell";
import OtpInputGroup from "../components/auth/OtpInputGroup";
import FileUploadCard from "../components/onboarding/FileUploadCard";
import SelectInput from "../components/onboarding/SelectInput";
import TextInput from "../components/onboarding/TextInput";
import SurfaceButton from "../components/ui/SurfaceButton";
import InfoTooltip from "../components/ui/InfoTooltip";
import { extractApiErrorMessage, verifyWorkProfileProof } from "../services/api";
import { isRealAuthEnabled, registerWorker, requestOtp, verifyOtp } from "../services/workerFlow";
import { saveAuthSession } from "../utils/auth";
import { assessAndSaveAuthRisk, sanitizePhoneNumber } from "../utils/authRisk";

const WORK_TYPE_OPTIONS = [
  { label: "Delivery", value: "Delivery" },
  { label: "Driver", value: "Driver" },
];

const PLATFORM_OPTIONS = [
  { label: "Select platform", value: "" },
  { label: "Swiggy", value: "Swiggy" },
  { label: "Zomato", value: "Zomato" },
  { label: "Uber", value: "Uber" },
  { label: "Ola", value: "Ola" },
  { label: "Other", value: "Other" },
];

const INITIAL_FORM = {
  fullName: "",
  phone: "",
  email: "",
  city: "",
  workType: "Delivery",
  platform: "",
  workerId: "",
  declarationAccepted: false,
};

const DEFAULT_PHONE_OTP_LENGTH = 6;
const DEFAULT_EMAIL_OTP_LENGTH = 6;
const LOCATION_TIMEOUT_MS = 5000;
const MAX_WORK_PROOF_BYTES = 5 * 1024 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const STEP_LABELS = ["Step 1: Personal Info", "Step 2: Work Details", "Step 3: Verification"];
const WORK_PROOF_ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);

const HIGH_RISK_CITIES = new Set(["DELHI", "MUMBAI", "KOLKATA"]);
const MEDIUM_RISK_CITIES = new Set([
  "BENGALURU",
  "BANGALORE",
  "CHENNAI",
  "HYDERABAD",
  "PUNE",
  "GURUGRAM",
  "NOIDA",
]);

function wait(durationMs) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value || "").trim());
}

function isValidWorkProofImage(file) {
  if (!file) {
    return false;
  }

  const normalizedName = String(file.name || "").toLowerCase();
  const hasAllowedExtension = [".jpg", ".jpeg", ".png"].some((extension) =>
    normalizedName.endsWith(extension)
  );

  return WORK_PROOF_ALLOWED_TYPES.has(String(file.type || "").toLowerCase()) || hasAllowedExtension;
}

function buildMockOtp(length = DEFAULT_EMAIL_OTP_LENGTH) {
  const digits = Array.from({ length }, () => String(Math.floor(Math.random() * 10)));
  if (digits[0] === "0") {
    digits[0] = String(Math.floor(Math.random() * 9) + 1);
  }
  return digits.join("");
}

function getCityRiskScore(city) {
  const normalizedCity = String(city || "").trim().toUpperCase();
  if (!normalizedCity) {
    return 6;
  }

  if (HIGH_RISK_CITIES.has(normalizedCity)) {
    return 14;
  }

  if (MEDIUM_RISK_CITIES.has(normalizedCity)) {
    return 9;
  }

  return 5;
}

function buildRiskPreview(profile = {}) {
  const workType = String(profile.workType || "Delivery");
  const platform = String(profile.platform || "");
  const city = String(profile.city || "");

  const platformScores = {
    Uber: 12,
    Ola: 11,
    Swiggy: 9,
    Zomato: 8,
    Other: 6,
  };

  let score = 22;
  score += workType === "Driver" ? 13 : 8;
  score += platformScores[platform] || 6;
  score += getCityRiskScore(city);

  const level = score <= 38 ? "LOW" : score <= 54 ? "MEDIUM" : "HIGH";

  const factors = [
    `Work type: ${workType || "Not selected"}`,
    `Location: ${city || "Not selected"}`,
    `Platform: ${platform || "Not selected"}`,
  ];

  return {
    level,
    score,
    factors,
    summary:
      level === "LOW"
        ? "Stable pattern detected for onboarding."
        : level === "MEDIUM"
          ? "Moderate variability detected. Additional checks recommended."
          : "Higher disruption risk detected. Strong verification recommended.",
  };
}

function buildPolicySuggestion(riskPreview, profile = {}) {
  const city = String(profile.city || "").trim().toUpperCase();
  const workType = String(profile.workType || "Delivery");
  const platform = String(profile.platform || "");

  const rainSensitiveCities = new Set([
    "BENGALURU",
    "BANGALORE",
    "MUMBAI",
    "CHENNAI",
    "PUNE",
    "KOLKATA",
    "HYDERABAD",
  ]);

  if (workType === "Driver" && riskPreview.level === "HIGH") {
    return {
      title: "Accident Downtime Shield",
      description: "Designed for high-mobility workers with elevated disruption exposure.",
    };
  }

  if (rainSensitiveCities.has(city) || platform === "Swiggy" || platform === "Zomato") {
    return {
      title: "Rain Protection Policy",
      description: "Covers heavy rain disruptions and delivery income loss windows.",
    };
  }

  if (riskPreview.level === "MEDIUM" || riskPreview.level === "HIGH") {
    return {
      title: "Air Quality + Delay Protection",
      description: "Balances AQI and traffic disruption events for weekly earnings continuity.",
    };
  }

  return {
    title: "Balanced Weekly Protection",
    description: "General parametric protection for routine gig work disruption signals.",
  };
}

function getRiskClassName(level) {
  if (level === "HIGH") {
    return "bg-red-50 text-red-700 border-red-200";
  }
  if (level === "MEDIUM") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function getStepCardClassName(isComplete, isActive) {
  if (isComplete) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (isActive) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-slate-200 bg-white text-slate-500";
}

async function fetchJsonWithTimeout(url, timeoutMs = LOCATION_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Location request failed with status ${response.status}`);
    }
    return response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function extractCityFromIpPayload(payload) {
  const candidates = [
    payload?.city,
    payload?.city_name,
    payload?.district,
    payload?.region,
    payload?.region_name,
  ];

  const city = candidates
    .map((value) => String(value || "").trim())
    .find((value) => Boolean(value));

  return city || "";
}

async function detectCityFromIpProviders() {
  const providers = [
    { name: "IP API", url: "https://ipapi.co/json/" },
    { name: "IP Who", url: "https://ipwho.is/" },
  ];

  for (const provider of providers) {
    try {
      const payload = await fetchJsonWithTimeout(provider.url);
      if (provider.name === "IP Who" && payload?.success === false) {
        throw new Error("IP Who response unsuccessful");
      }

      const city = extractCityFromIpPayload(payload);
      if (city) {
        return {
          city,
          source: provider.name,
        };
      }
    } catch (_) {
      // Try next provider.
    }
  }

  throw new Error("All IP location providers failed");
}

function getBrowserPosition(timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Browser geolocation unavailable"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: timeoutMs,
      maximumAge: 120000,
    });
  });
}

async function detectCityFromBrowserGeolocation() {
  const position = await getBrowserPosition();
  const latitude = position?.coords?.latitude;
  const longitude = position?.coords?.longitude;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Invalid browser geolocation coordinates");
  }

  const reverseLookupUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
  const payload = await fetchJsonWithTimeout(reverseLookupUrl, 8000);
  const city =
    payload?.address?.city ||
    payload?.address?.town ||
    payload?.address?.village ||
    payload?.address?.state_district ||
    payload?.address?.state ||
    "";

  const normalizedCity = String(city || "").trim();
  if (!normalizedCity) {
    throw new Error("Could not resolve city from browser geolocation");
  }

  return {
    city: normalizedCity,
    source: "Browser GPS",
  };
}

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectedPhone = sanitizePhoneNumber(location.state?.phone || "");
  const redirectedRegistrationToken = location.state?.registrationToken || "";

  const formStartedAtRef = useRef(Date.now());
  const proofVerificationRequestIdRef = useRef(0);

  const [form, setForm] = useState({
    ...INITIAL_FORM,
    phone: redirectedPhone,
  });

  const [proofFile, setProofFile] = useState(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState("");
  const [proofUploadError, setProofUploadError] = useState("");
  const [proofVerificationLoading, setProofVerificationLoading] = useState(false);

  const [authMode, setAuthMode] = useState(
    redirectedRegistrationToken ? "real" : isRealAuthEnabled() ? "real" : "demo"
  );
  const [sessionId, setSessionId] = useState("");
  const [registrationToken, setRegistrationToken] = useState(redirectedRegistrationToken);

  const [otpLength, setOtpLength] = useState(DEFAULT_PHONE_OTP_LENGTH);
  const [otp, setOtp] = useState(new Array(DEFAULT_PHONE_OTP_LENGTH).fill(""));
  const [isOtpStepActive, setIsOtpStepActive] = useState(false);
  const [activeOtpCode, setActiveOtpCode] = useState("");

  const [emailOtpLength, setEmailOtpLength] = useState(DEFAULT_EMAIL_OTP_LENGTH);
  const [emailOtp, setEmailOtp] = useState(new Array(DEFAULT_EMAIL_OTP_LENGTH).fill(""));
  const [activeEmailOtpCode, setActiveEmailOtpCode] = useState("");
  const [emailVerificationStatus, setEmailVerificationStatus] = useState("not_verified");
  const [emailVerificationMessage, setEmailVerificationMessage] = useState("");
  const [emailVerificationError, setEmailVerificationError] = useState("");
  const [emailOtpLoading, setEmailOtpLoading] = useState(false);

  const [documentVerification, setDocumentVerification] = useState({
    status: "idle",
    message: "Upload work profile proof to start verification.",
    fraudScore: null,
    riskLevel: "UNKNOWN",
    decision: "PENDING",
    reasons: [],
    signals: {
      detectedName: "Unknown",
      platformKeywords: [],
      imageQuality: "unknown",
      duplicateFound: false,
      suspiciousMetadata: false,
    },
    systemNote:
      "This is a lightweight AI-based verification system and can be extended with advanced ML models in production.",
    source: "not-started",
  });

  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [locationError, setLocationError] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(
    redirectedRegistrationToken
      ? "Phone number already verified. Complete your profile to finish signup."
      : ""
  );
  const [isVerificationNoticeVisible, setIsVerificationNoticeVisible] = useState(false);

  const isRealRegistrationFlow = authMode === "real";
  const isOtpStep = isRealRegistrationFlow && !registrationToken && isOtpStepActive;

  useEffect(() => {
    return () => {
      if (proofPreviewUrl) {
        URL.revokeObjectURL(proofPreviewUrl);
      }
    };
  }, [proofPreviewUrl]);

  const isEmailFormatValid = isValidEmail(form.email);

  const riskPreview = useMemo(() => {
    return buildRiskPreview({
      workType: form.workType,
      city: form.city,
      platform: form.platform,
    });
  }, [form.city, form.platform, form.workType]);

  const policySuggestion = useMemo(() => {
    return buildPolicySuggestion(riskPreview, {
      city: form.city,
      workType: form.workType,
      platform: form.platform,
    });
  }, [form.city, form.platform, form.workType, riskPreview]);

  const isPersonalInfoComplete =
    Boolean(form.fullName.trim()) &&
    form.phone.length === 10 &&
    isEmailFormatValid &&
    Boolean(form.city.trim());

  const isWorkDetailsComplete =
    Boolean(form.workType) &&
    Boolean(form.platform) &&
    Boolean(form.workerId.trim()) &&
    Boolean(proofFile);

  const hasWorkProofUploaded = Boolean(proofFile);
  const initialTrustLevel = hasWorkProofUploaded ? "MEDIUM" : "LOW";
  const initialTrustScore = hasWorkProofUploaded ? 60 : 35;
  const isVerificationComplete = emailVerificationStatus === "verified" && hasWorkProofUploaded;

  const areRequiredFieldsFilled =
    isPersonalInfoComplete &&
    isWorkDetailsComplete &&
    Boolean(form.declarationAccepted);

  const canRequestPhoneOtp = areRequiredFieldsFilled && isVerificationComplete;

  const isBackgroundCheckBusy =
    emailOtpLoading ||
    isDetectingLocation ||
    proofVerificationLoading ||
    documentVerification.status === "checking";

  const isContinueDisabled =
    loading ||
    isBackgroundCheckBusy ||
    (isOtpStep
      ? otp.join("").length !== otpLength
      : isRealRegistrationFlow
        ? !canRequestPhoneOtp
        : !canRequestPhoneOtp);

  const stepCompletionStates = [
    isPersonalInfoComplete,
    isWorkDetailsComplete,
    isVerificationComplete,
  ];
  const activeStepIndex = stepCompletionStates.findIndex((state) => !state);

  function updateField(field, value) {
    setForm((current) => {
      if (field === "phone") {
        return {
          ...current,
          phone: sanitizePhoneNumber(value),
        };
      }

      return {
        ...current,
        [field]: value,
      };
    });
  }

  function resetEmailVerificationState() {
    setEmailVerificationStatus("not_verified");
    setEmailVerificationMessage("");
    setEmailVerificationError("");
    setEmailOtpLength(DEFAULT_EMAIL_OTP_LENGTH);
    setEmailOtp(new Array(DEFAULT_EMAIL_OTP_LENGTH).fill(""));
    setActiveEmailOtpCode("");
  }

  function handleEmailChange(value) {
    const normalizedEmail = String(value || "").trim();

    setForm((current) => ({
      ...current,
      email: normalizedEmail,
    }));

    resetEmailVerificationState();
  }

  async function handleDetectLocation() {
    setLocationError("");
    setLocationMessage("");
    setIsDetectingLocation(true);

    try {
      let detected = null;

      try {
        detected = await detectCityFromIpProviders();
      } catch (_) {
        detected = await detectCityFromBrowserGeolocation();
      }

      const detectedCity = String(detected?.city || "").trim();
      if (!detectedCity) {
        throw new Error("City not detected");
      }

      setForm((current) => ({
        ...current,
        city: detectedCity,
      }));
      setLocationMessage(
        `City detected successfully via ${detected?.source || "location service"}: ${detectedCity}`
      );
    } catch (_) {
      setLocationError("Location detect nahi ho payi. City manually enter kar sakte ho.");
    } finally {
      setIsDetectingLocation(false);
    }
  }

  async function runAiDocumentValidation(file) {
    const requestId = proofVerificationRequestIdRef.current + 1;
    proofVerificationRequestIdRef.current = requestId;

    if (!file) {
      setProofVerificationLoading(false);
      setDocumentVerification({
        status: "idle",
        message: "Upload work profile proof to start verification.",
        fraudScore: null,
        riskLevel: "UNKNOWN",
        decision: "PENDING",
        reasons: [],
        signals: {
          detectedName: "Unknown",
          platformKeywords: [],
          imageQuality: "unknown",
          duplicateFound: false,
          suspiciousMetadata: false,
        },
        systemNote:
          "This is a lightweight AI-based verification system and can be extended with advanced ML models in production.",
        source: "not-started",
      });
      return;
    }

    setDocumentVerification({
      status: "checking",
      message: "Running lightweight screenshot verification...",
      fraudScore: null,
      riskLevel: "UNKNOWN",
      decision: "PENDING",
      reasons: [],
      signals: {
        detectedName: "Unknown",
        platformKeywords: [],
        imageQuality: "unknown",
        duplicateFound: false,
        suspiciousMetadata: false,
      },
      systemNote:
        "This is a lightweight AI-based verification system and can be extended with advanced ML models in production.",
      source: "rule-engine",
    });

    setProofVerificationLoading(true);

    try {
      const result = await verifyWorkProfileProof({
        file,
        name: form.fullName || "Unknown Worker",
        city: form.city || "Unknown City",
        workType: form.workType || "Delivery",
        metadata: {
          platform: form.platform,
          workerId: form.workerId,
          originalFileName: file.name,
        },
      });

      if (proofVerificationRequestIdRef.current !== requestId) {
        return;
      }

      setDocumentVerification({
        status: "completed",
        message: "Proof uploaded successfully",
        fraudScore: Number(result?.fraudScore ?? 0),
        riskLevel: String(result?.riskLevel || "UNKNOWN").toUpperCase(),
        decision: String(result?.decision || "PENDING").toUpperCase(),
        reasons: Array.isArray(result?.reasons) ? result.reasons : [],
        signals: {
          detectedName: result?.signals?.detectedName || "Unknown",
          platformKeywords: Array.isArray(result?.signals?.platformKeywords)
            ? result.signals.platformKeywords
            : [],
          imageQuality: result?.signals?.imageQuality || "unknown",
          duplicateFound: Boolean(result?.signals?.duplicateFound),
          suspiciousMetadata: Boolean(result?.signals?.suspiciousMetadata),
        },
        systemNote:
          result?.systemNote ||
          "This is a lightweight AI-based verification system and can be extended with advanced ML models in production.",
        source: "work-profile-rule-engine",
      });
    } catch (validationError) {
      if (proofVerificationRequestIdRef.current !== requestId) {
        return;
      }

      setDocumentVerification({
        status: "error",
        message: extractApiErrorMessage(
          validationError,
          "Work profile verification failed. Please retry with a clear screenshot."
        ),
        fraudScore: null,
        riskLevel: "UNKNOWN",
        decision: "PENDING",
        reasons: [],
        signals: {
          detectedName: "Unknown",
          platformKeywords: [],
          imageQuality: "unknown",
          duplicateFound: false,
          suspiciousMetadata: false,
        },
        systemNote:
          "This is a lightweight AI-based verification system and can be extended with advanced ML models in production.",
        source: "work-profile-rule-engine",
      });
    } finally {
      if (proofVerificationRequestIdRef.current === requestId) {
        setProofVerificationLoading(false);
      }
    }
  }

  async function handleProofSelect(file) {
    setProofUploadError("");

    if (proofPreviewUrl) {
      URL.revokeObjectURL(proofPreviewUrl);
    }

    if (!file || Number(file.size) <= 0) {
      setProofFile(null);
      setProofPreviewUrl("");
      setProofUploadError("Please upload a valid image");
      await runAiDocumentValidation(null);
      return;
    }

    if (!isValidWorkProofImage(file)) {
      setProofFile(null);
      setProofPreviewUrl("");
      setProofUploadError("Please upload a valid image");
      await runAiDocumentValidation(null);
      return;
    }

    if (Number(file.size) > MAX_WORK_PROOF_BYTES) {
      setProofFile(null);
      setProofPreviewUrl("");
      setProofUploadError("File size too large");
      await runAiDocumentValidation(null);
      return;
    }

    setProofFile(file);
    setProofPreviewUrl(file?.type?.startsWith("image/") ? URL.createObjectURL(file) : "");
    await runAiDocumentValidation(file);
  }

  async function handleSendEmailOtp() {
    if (!isEmailFormatValid) {
      setEmailVerificationError("Enter a valid email address before requesting OTP.");
      return;
    }

    setEmailOtpLoading(true);
    setEmailVerificationError("");
    setEmailVerificationMessage("");

    try {
      await wait(500);
      const nextOtpLength = DEFAULT_EMAIL_OTP_LENGTH;
      const generatedOtp = buildMockOtp(nextOtpLength);

      setEmailOtpLength(nextOtpLength);
      setEmailOtp(new Array(nextOtpLength).fill(""));
      setActiveEmailOtpCode(generatedOtp);
      setEmailVerificationStatus("not_verified");
      setEmailVerificationMessage(`Email OTP sent. Use ${generatedOtp} to verify in demo mode.`);
    } finally {
      setEmailOtpLoading(false);
    }
  }

  async function handleVerifyEmailOtp() {
    const enteredOtp = emailOtp.join("");

    if (enteredOtp.length !== emailOtpLength) {
      setEmailVerificationError(`Enter all ${emailOtpLength} email OTP digits.`);
      return;
    }

    if (!activeEmailOtpCode) {
      setEmailVerificationError("Send Email OTP first.");
      return;
    }

    setEmailOtpLoading(true);
    setEmailVerificationError("");

    try {
      await wait(450);

      if (enteredOtp !== activeEmailOtpCode) {
        throw new Error("Invalid email OTP. Please check and retry.");
      }

      setEmailVerificationStatus("verified");
      setEmailVerificationMessage("Email verified successfully.");
    } catch (verifyError) {
      setEmailVerificationStatus("not_verified");
      setEmailVerificationError(verifyError?.message || "Email verification failed.");
    } finally {
      setEmailOtpLoading(false);
    }
  }

  function buildRegisteredUser(authRiskSnapshot, responseUser = {}) {
    const workVerificationStatus = "pending";
    const workVerificationFlag = authRiskSnapshot.internalFlags?.sameDeviceMultipleAccounts
      ? "suspicious_device_reuse"
      : null;

    return {
      ...(responseUser || {}),
      full_name: form.fullName.trim(),
      phone: form.phone,
      email: form.email.trim().toLowerCase(),
      city: form.city.trim(),
      zone: form.city.trim(),
      platform: form.platform,
      work_type: form.workType,
      worker_id: form.workerId.trim(),
      work_proof_name: proofFile?.name || "",
      work_verification_status:
        responseUser?.work_verification_status || workVerificationStatus,
      work_verification_flag:
        responseUser?.work_verification_flag !== undefined
          ? responseUser.work_verification_flag
          : workVerificationFlag,
      weekly_income: form.workType === "Driver" ? 22000 : 18000,
      device_id: authRiskSnapshot.deviceId,
      auth_risk_score: authRiskSnapshot.riskScore,
      auth_risk_level: authRiskSnapshot.riskLevel,
      auth_risk_status: authRiskSnapshot.riskStatus,
      trust_score: responseUser?.trust_score ?? initialTrustScore,
      trust_level: responseUser?.trust_level ?? initialTrustLevel.toLowerCase(),
      signup_time: responseUser?.signup_time || authRiskSnapshot.signupTime,
      location: authRiskSnapshot.location,
    };
  }

  async function finalizeRegistration(currentRegistrationToken) {
    const authRiskSnapshot = await assessAndSaveAuthRisk({
      phone: form.phone,
      flow: "signup",
      formStartedAt: formStartedAtRef.current,
    });

    const response = await registerWorker(
      {
        fullName: form.fullName.trim(),
        phone: form.phone,
        city: form.city.trim(),
        zone: form.city.trim(),
        platform: form.platform,
        workType: form.workType,
        workerId: form.workerId.trim(),
        workProofName: proofFile.name,
        weeklyIncome: form.workType === "Driver" ? 22000 : 18000,
        deviceId: authRiskSnapshot.deviceId,
        location: authRiskSnapshot.location,
        trustScore: initialTrustScore,
        trustLevel: initialTrustLevel,
      },
      {
        authMode,
        registrationToken: currentRegistrationToken,
      }
    );

    saveAuthSession({
      ...response,
      user: buildRegisteredUser(authRiskSnapshot, response.user),
    });

    await wait(900);
    navigate("/dashboard", { replace: true });
  }

  async function handleSendRegistrationOtp() {
    const response = await requestOtp(form.phone, {
      purpose: "register",
      allowDemoFallback: false,
    });

    setAuthMode(response.authMode || "real");
    setSessionId(response.sessionId);
    setOtpLength(response.otpLength || DEFAULT_PHONE_OTP_LENGTH);
    setOtp(new Array(response.otpLength || DEFAULT_PHONE_OTP_LENGTH).fill(""));
    setActiveOtpCode(response.otp ? String(response.otp) : "");
    setIsOtpStepActive(true);
    setMessage(
      response.otp
        ? `OTP sent successfully. Use ${response.otp} to continue signup.`
        : "OTP sent successfully. Enter the verification code to continue signup."
    );
    setIsVerificationNoticeVisible(false);
  }

  async function handleVerifyAndRegister() {
    const combinedOtp = otp.join("");
    if (combinedOtp.length !== otpLength) {
      setError(`Enter all ${otpLength} OTP digits to continue.`);
      return;
    }

    const response = await verifyOtp({
      sessionId,
      phone: form.phone,
      otp: combinedOtp,
      authMode: "real",
    });

    if (response.registrationRequired && response.registrationToken) {
      setRegistrationToken(response.registrationToken);
      setMessage("Phone verified successfully. Completing your registration...");
      await finalizeRegistration(response.registrationToken);
      return;
    }

    if (response.token && response.user) {
      saveAuthSession(response);
      await wait(600);
      navigate("/dashboard", { replace: true });
      return;
    }

    throw new Error("Unable to complete OTP verification.");
  }

  async function handleDemoRegistration() {
    const authRiskSnapshot = await assessAndSaveAuthRisk({
      phone: form.phone,
      flow: "signup",
      formStartedAt: formStartedAtRef.current,
    });

    const workVerificationStatus = "pending";
    const workVerificationFlag = authRiskSnapshot.internalFlags?.sameDeviceMultipleAccounts
      ? "suspicious_device_reuse"
      : null;

    const response = await registerWorker({
      fullName: form.fullName.trim(),
      phone: form.phone,
      city: form.city.trim(),
      zone: form.city.trim(),
      platform: form.platform,
      workType: form.workType,
      workerId: form.workerId.trim(),
      workProofName: proofFile.name,
      workVerificationStatus,
      workVerificationFlag,
      weeklyIncome: form.workType === "Driver" ? 22000 : 18000,
      deviceId: authRiskSnapshot.deviceId,
      signupTime: authRiskSnapshot.signupTime,
      location: authRiskSnapshot.location,
      authRiskScore: authRiskSnapshot.riskScore,
      authRiskLevel: authRiskSnapshot.riskLevel,
      authRiskStatus: authRiskSnapshot.riskStatus,
      trustScore: initialTrustScore,
      trustLevel: initialTrustLevel,
    });

    saveAuthSession({
      ...response,
      user: buildRegisteredUser(authRiskSnapshot, response.user),
    });

    await wait(900);
    navigate("/dashboard", { replace: true });
  }

  function handleBackToForm() {
    setIsOtpStepActive(false);
    setSessionId("");
    setOtpLength(DEFAULT_PHONE_OTP_LENGTH);
    setOtp(new Array(DEFAULT_PHONE_OTP_LENGTH).fill(""));
    setActiveOtpCode("");
    setMessage("");
    setError("");
    formStartedAtRef.current = Date.now();
  }

  async function handleResendOtp() {
    const response = await requestOtp(form.phone, {
      purpose: "register",
      allowDemoFallback: false,
    });

    setSessionId(response.sessionId);
    setOtpLength(response.otpLength || DEFAULT_PHONE_OTP_LENGTH);
    setOtp(new Array(response.otpLength || DEFAULT_PHONE_OTP_LENGTH).fill(""));
    setActiveOtpCode(response.otp ? String(response.otp) : "");
    setMessage(
      response.otp
        ? `A fresh OTP is ready. Use ${response.otp} to continue signup.`
        : "A fresh OTP has been sent. Enter it to continue signup."
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isContinueDisabled) {
      return;
    }

    if (!isOtpStep && !canRequestPhoneOtp) {
      setError("Complete email verification and upload work profile proof before continuing.");
      return;
    }

    setError("");
    setLoading(true);
    setIsVerificationNoticeVisible(true);

    try {
      if (isRealRegistrationFlow) {
        if (registrationToken) {
          await finalizeRegistration(registrationToken);
        } else if (isOtpStep) {
          await handleVerifyAndRegister();
        } else {
          await handleSendRegistrationOtp();
        }
      } else {
        await handleDemoRegistration();
      }
    } catch (registerError) {
      setError(extractApiErrorMessage(registerError, "Service unavailable."));
      setIsVerificationNoticeVisible(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Signup"
      title="Create your GigPredict AI account"
      description="Secure onboarding with AI checks, document validation, and OTP verification."
      note="We are an AI-powered parametric insurance and decision intelligence platform for gig workers."
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-blue-600 transition-colors duration-200 hover:text-blue-700"
          >
            Sign in here
          </Link>
          .
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="grid gap-3 sm:grid-cols-3">
          {STEP_LABELS.map((label, index) => {
            const isComplete = stepCompletionStates[index];
            const isActive = activeStepIndex === index || (activeStepIndex === -1 && index === 2);

            return (
              <div
                key={label}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${getStepCardClassName(
                  isComplete,
                  isActive
                )}`}
              >
                {label}
              </div>
            );
          })}
        </section>

        <section className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div>
            <p className="text-sm font-medium text-slate-500">Personal Details</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
              Step 1: Personal Info
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TextInput
                id="full-name"
                label="Full Name"
                value={form.fullName}
                onChange={(value) => updateField("fullName", value)}
                placeholder="Kunal Sharma"
                autoComplete="name"
                autoFocus
                disabled={loading || isOtpStep}
              />
            </div>

            <TextInput
              id="mobile-number"
              label="Mobile Number"
              value={form.phone}
              onChange={(value) => updateField("phone", value)}
              placeholder="9876543210"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              disabled={loading || isOtpStep || Boolean(registrationToken)}
            />

            <div className="space-y-2">
              <TextInput
                id="email"
                label="Email"
                value={form.email}
                onChange={handleEmailChange}
                placeholder="name@example.com"
                autoComplete="email"
                disabled={loading || isOtpStep}
              />
              <div className="flex items-center justify-between gap-3 px-1 text-xs">
                <span className={isEmailFormatValid ? "text-emerald-600" : "text-slate-500"}>
                  {isEmailFormatValid ? "Valid email format" : "Enter a valid email"}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 font-semibold ${
                    emailVerificationStatus === "verified"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {emailVerificationStatus === "verified" ? "Verified" : "Not Verified"}
                </span>
              </div>
            </div>

            <div className="sm:col-span-2 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-700">Email OTP verification</p>
                <div className="flex gap-2">
                  <SurfaceButton
                    type="button"
                    variant="secondary"
                    onClick={handleSendEmailOtp}
                    disabled={
                      loading ||
                      isOtpStep ||
                      emailOtpLoading ||
                      !isEmailFormatValid ||
                      emailVerificationStatus === "verified"
                    }
                  >
                    {emailOtpLoading ? "Sending..." : "Send Email OTP"}
                  </SurfaceButton>
                  <SurfaceButton
                    type="button"
                    onClick={handleVerifyEmailOtp}
                    disabled={
                      loading ||
                      isOtpStep ||
                      emailOtpLoading ||
                      !activeEmailOtpCode ||
                      emailVerificationStatus === "verified"
                    }
                  >
                    {emailOtpLoading ? "Verifying..." : "Verify Email OTP"}
                  </SurfaceButton>
                </div>
              </div>

              {activeEmailOtpCode ? (
                <>
                  <OtpInputGroup
                    value={emailOtp}
                    onChange={setEmailOtp}
                    autoFocus={false}
                    disabled={loading || isOtpStep || emailOtpLoading}
                  />
                  <p className="text-xs text-slate-500">
                    Current email verification code: {activeEmailOtpCode}
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-500">
                  Send Email OTP to start verification.
                </p>
              )}

              {emailVerificationMessage ? (
                <p className="text-sm text-emerald-700">{emailVerificationMessage}</p>
              ) : null}
              {emailVerificationError ? (
                <p className="text-sm text-red-700">{emailVerificationError}</p>
              ) : null}
            </div>

            <TextInput
              id="city"
              label="City"
              value={form.city}
              onChange={(value) => updateField("city", value)}
              placeholder="Bengaluru"
              autoComplete="address-level2"
              disabled={loading || isOtpStep}
            />

            <div className="flex items-end">
              <SurfaceButton
                type="button"
                variant="secondary"
                className="w-full"
                onClick={handleDetectLocation}
                disabled={loading || isOtpStep || isDetectingLocation}
              >
                {isDetectingLocation ? "Detecting..." : "Detect My Location"}
              </SurfaceButton>
            </div>

            {locationMessage ? (
              <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {locationMessage}
              </div>
            ) : null}

            {locationError ? (
              <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {locationError}
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div>
            <p className="text-sm font-medium text-slate-500">Work Verification</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
              Step 2: Work Details
            </h2>
          </div>

          <SelectInput
            id="work-type"
            label="Work Type"
            value={form.workType}
            onChange={(value) => updateField("workType", value)}
            options={WORK_TYPE_OPTIONS}
            disabled={loading || isOtpStep}
          />

          <SelectInput
            id="platform"
            label="Which platform do you work with?"
            value={form.platform}
            onChange={(value) => updateField("platform", value)}
            options={PLATFORM_OPTIONS}
            disabled={loading || isOtpStep}
          />

          <TextInput
            id="worker-id"
            label="Partner ID / Worker ID"
            value={form.workerId}
            onChange={(value) => updateField("workerId", value.toUpperCase())}
            placeholder="e.g. SWG12345"
            autoComplete="off"
            disabled={loading || isOtpStep}
          />

          <div className="space-y-2 rounded-xl border border-slate-200 bg-white px-4 py-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">Upload Work Profile Proof</p>
              <InfoTooltip
                label="Work profile proof information"
                text="This helps verify that you are an active gig worker without requiring sensitive documents."
              />
            </div>
            <p className="text-sm text-slate-600">
              Upload a screenshot of your gig platform profile to verify your work activity.
            </p>
            <div className="text-xs text-slate-500">
              <p>Examples:</p>
              <p>- Swiggy / Zomato profile screen</p>
              <p>- Uber / Ola driver profile</p>
              <p>- Delivery partner dashboard</p>
              <p>- Worker ID screen</p>
            </div>
          </div>

          <FileUploadCard
            label="Upload Work Profile Proof"
            helperText="Upload a screenshot of your gig platform profile to verify your work activity."
            file={proofFile}
            previewUrl={proofPreviewUrl}
            onFileSelect={handleProofSelect}
            disabled={loading || isOtpStep}
            accept="image/png,image/jpeg,.png,.jpg,.jpeg"
            dropTitle="Drag and drop your work profile screenshot here"
            dropDescription="Make sure your name and platform details are visible"
            actionLabel="Upload Work Proof"
            replaceActionLabel="Upload Work Proof"
          />

          {proofUploadError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {proofUploadError}
            </div>
          ) : null}

          {proofFile ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold">Proof uploaded successfully</p>
              <p className="mt-1">Status: Pending AI Verification</p>
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            We do not collect sensitive government IDs. Your data is used only for verification purposes.
          </div>
        </section>

        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <p className="text-sm font-medium text-slate-500">AI Verification</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
              Step 3: Verification
            </h2>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Work Proof Verification</p>
            <p className="mt-2 text-sm text-slate-600">{documentVerification.message}</p>
            {proofFile ? (
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <p className="text-slate-700">
                  Upload status: <span className="font-semibold">Proof uploaded successfully</span>
                </p>
                <p className="text-slate-700">
                  Verification status:{" "}
                  <span className="font-semibold">
                    {proofVerificationLoading
                      ? "Pending AI Verification"
                      : documentVerification.status === "completed"
                        ? "Completed"
                        : "Pending AI Verification"}
                  </span>
                </p>
                <p className="text-slate-500 sm:col-span-2">
                  Source: {documentVerification.source}
                </p>
              </div>
            ) : null}

            {documentVerification.status === "completed" ? (
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Fraud Score
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">
                      {documentVerification.fraudScore}/100
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Risk Level
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">
                      {documentVerification.riskLevel}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Decision
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">
                      {documentVerification.decision}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-sm font-semibold text-slate-900">Explanation</p>
                  {documentVerification.reasons.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {documentVerification.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600">No additional reasons available.</p>
                  )}
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-900">
                  {documentVerification.systemNote}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">AI Risk Preview</p>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getRiskClassName(riskPreview.level)}`}>
                Your risk profile: {riskPreview.level}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{riskPreview.summary}</p>
            <p className="mt-2 text-xs text-slate-500">Risk score: {riskPreview.score}</p>
            <p className="mt-2 text-xs text-slate-500">{riskPreview.factors.join(" | ")}</p>
            <p className="mt-2 text-xs text-slate-600">
              Initial Trust Level: <span className="font-semibold">{initialTrustLevel}</span>
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-800">
              Recommended Plan: {policySuggestion.title}
            </p>
            <p className="mt-1 text-sm text-blue-700">{policySuggestion.description}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Trust & Security</p>
            <p className="mt-2 text-sm text-slate-600">✔ Secure verification</p>
            <p className="text-sm text-slate-600">✔ AI fraud protection</p>
            <p className="text-sm text-slate-600">✔ Real-time monitoring</p>
            <p className="mt-2 text-sm text-slate-700">
              Initial Trust: <span className="font-semibold">{initialTrustLevel}</span>
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            User enters details → uploads work profile proof → AI verifies → risk score shown → policy suggested → OTP verification → account created
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4">
            <input
              type="checkbox"
              checked={form.declarationAccepted}
              disabled={loading || isOtpStep}
              onChange={(event) => updateField("declarationAccepted", event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
            />
            <span className="text-sm text-slate-700">
              I confirm that I am an active gig worker and I agree to secure onboarding checks.
            </span>
          </label>
        </section>

        {isOtpStep ? (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-700">Phone OTP Verification</p>
                <p className="mt-1 text-sm text-slate-500">Code sent to +91 {form.phone}</p>
              </div>

              <button
                type="button"
                onClick={handleBackToForm}
                className="text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-slate-900"
              >
                Edit details
              </button>
            </div>

            <OtpInputGroup
              value={otp}
              onChange={setOtp}
              autoFocus={isOtpStep}
              disabled={loading}
            />

            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-500">
                {activeOtpCode
                  ? `Current verification code: ${activeOtpCode}`
                  : `Enter the latest ${otpLength}-digit OTP sent to your phone.`}
              </span>
              <button
                type="button"
                onClick={handleResendOtp}
                className="font-medium text-blue-600 transition-colors duration-200 hover:text-blue-700"
              >
                Resend OTP
              </button>
            </div>
          </section>
        ) : null}

        {!isOtpStep && isRealRegistrationFlow ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              canRequestPhoneOtp
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {canRequestPhoneOtp
              ? "All checks completed. You can now send OTP."
              : "Complete required fields, verify email, and upload work profile proof to enable Send OTP."}
          </div>
        ) : null}

        {isVerificationNoticeVisible ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Verification in progress...
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {isRealRegistrationFlow && !registrationToken
              ? "Your account details stay protected while OTP and AI safety checks run in parallel."
              : "Secure onboarding remains active while the system prepares your account."}
          </div>
        )}

        {message ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <SurfaceButton type="submit" className="w-full" loading={loading} disabled={isContinueDisabled}>
          {isOtpStep
            ? "Verify OTP and create account"
            : registrationToken
              ? "Complete registration"
              : isRealRegistrationFlow
                ? "Send OTP"
                : "Create account"}
        </SurfaceButton>
      </form>
    </AuthShell>
  );
}
