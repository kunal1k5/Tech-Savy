import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthField from "../components/auth/AuthField";
import AuthShell from "../components/auth/AuthShell";
import OtpInputGroup from "../components/auth/OtpInputGroup";
import SurfaceButton from "../components/ui/SurfaceButton";
import { extractApiErrorMessage } from "../services/api";
import { requestOtp, verifyOtp } from "../services/workerFlow";
import { findStoredUserByPhone, saveAuthSession, signInWithDemoAccount } from "../utils/auth";
import {
  getAuthRiskProfile,
  getLoginAttemptCount,
  assessAndSaveAuthRisk,
  recordLoginAttempt,
  sanitizePhoneNumber,
} from "../utils/authRisk";

const DEFAULT_OTP_LENGTH = 6;
const OTP_RESEND_SECONDS = 30;
const LOCATION_TIMEOUT_MS = 4500;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function wait(durationMs) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function buildMockOtp(length = DEFAULT_OTP_LENGTH) {
  const digits = Array.from({ length }, () => String(Math.floor(Math.random() * 10)));
  if (digits[0] === "0") {
    digits[0] = String(Math.floor(Math.random() * 9) + 1);
  }
  return digits.join("");
}

function hashString(input) {
  return Math.abs(
    String(input || "").split("").reduce((hash, character) => {
      const nextHash = (hash << 5) - hash + character.charCodeAt(0);
      return nextHash | 0;
    }, 0)
  );
}

function getTrustAppearance(score) {
  if (score >= 80) {
    return {
      label: "Safe",
      toneClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: ShieldCheck,
    };
  }

  if (score >= 55) {
    return {
      label: "Medium",
      toneClassName: "border-amber-200 bg-amber-50 text-amber-700",
      icon: ShieldAlert,
    };
  }

  return {
    label: "Risky",
    toneClassName: "border-red-200 bg-red-50 text-red-700",
    icon: ShieldAlert,
  };
}

async function fetchJsonWithTimeout(url, timeoutMs = LOCATION_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Location request failed (${response.status})`);
    }

    return response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function extractCity(payload) {
  const candidates = [
    payload?.city,
    payload?.city_name,
    payload?.district,
    payload?.region,
    payload?.region_name,
  ];

  return candidates
    .map((value) => String(value || "").trim())
    .find((value) => Boolean(value));
}

async function detectLoginCityFromIp() {
  const providers = [
    { name: "IP API", url: "https://ipapi.co/json/" },
    { name: "IP Who", url: "https://ipwho.is/" },
  ];

  for (const provider of providers) {
    try {
      const payload = await fetchJsonWithTimeout(provider.url);

      if (provider.name === "IP Who" && payload?.success === false) {
        continue;
      }

      const city = extractCity(payload);
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

  throw new Error("Unable to resolve login city");
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = location.state?.from || "/dashboard";
  const formStartedAtRef = useRef(Date.now());

  const [step, setStep] = useState(1);
  const [loginMethod, setLoginMethod] = useState("mobile");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otpLength, setOtpLength] = useState(DEFAULT_OTP_LENGTH);
  const [otp, setOtp] = useState(new Array(DEFAULT_OTP_LENGTH).fill(""));
  const [sessionId, setSessionId] = useState("");
  const [authMode, setAuthMode] = useState("demo");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeOtpCode, setActiveOtpCode] = useState("");
  const [isVerificationNoticeVisible, setIsVerificationNoticeVisible] = useState(false);
  const [loginCity, setLoginCity] = useState("");
  const [locationSource, setLocationSource] = useState("");
  const [locationLoading, setLocationLoading] = useState(true);

  const normalizedPhone = sanitizePhoneNumber(phone);
  const normalizedEmail = normalizeEmail(email);
  const isStepOneInputValid =
    loginMethod === "mobile"
      ? normalizedPhone.length === 10
      : isValidEmail(normalizedEmail);

  const trustIndicator = useMemo(() => {
    if (loginMethod === "mobile") {
      if (!normalizedPhone) {
        return null;
      }

      const attempts = getLoginAttemptCount(normalizedPhone);
      const existingProfile = getAuthRiskProfile(normalizedPhone);
      const storedRiskScore = Number(existingProfile?.riskScore ?? 0);
      const sameDeviceUsers = Number(existingProfile?.signals?.sameDeviceUsers ?? 0);
      const locationChangePenalty = existingProfile?.signals?.locationChange ? 6 : 0;

      const score = clamp(
        Math.round(94 - attempts * 8 - storedRiskScore * 0.28 - sameDeviceUsers * 4 - locationChangePenalty),
        20,
        99
      );

      return {
        score,
        ...getTrustAppearance(score),
      };
    }

    if (!normalizedEmail) {
      return null;
    }

    const domain = normalizedEmail.split("@")[1] || "";
    const localPart = normalizedEmail.split("@")[0] || "";
    const suspiciousDomainPenalty = ["mailinator.com", "tempmail.com", "10minutemail.com"].includes(domain)
      ? 28
      : 0;
    const entropyPenalty = localPart.length < 4 ? 10 : 0;

    const score = clamp(
      Math.round(86 - suspiciousDomainPenalty - entropyPenalty),
      30,
      98
    );

    return {
      score,
      ...getTrustAppearance(score),
    };
  }, [loginMethod, normalizedEmail, normalizedPhone]);

  useEffect(() => {
    let isMounted = true;

    async function detectLocation() {
      setLocationLoading(true);
      try {
        const detectedLocation = await detectLoginCityFromIp();
        if (!isMounted) {
          return;
        }

        setLoginCity(detectedLocation.city);
        setLocationSource(detectedLocation.source);
      } catch (_) {
        if (!isMounted) {
          return;
        }

        setLoginCity("Location unavailable");
        setLocationSource("fallback");
      } finally {
        if (isMounted) {
          setLocationLoading(false);
        }
      }
    }

    detectLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (step !== 2 || resendCountdown <= 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setResendCountdown((currentSeconds) => {
        if (currentSeconds <= 1) {
          window.clearInterval(intervalId);
          return 0;
        }
        return currentSeconds - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [resendCountdown, step]);

  function handleSwitchLoginMethod(nextMethod) {
    if (loading || step !== 1) {
      return;
    }

    setLoginMethod(nextMethod);
    setError("");
    setMessage("");
    setIsVerificationNoticeVisible(false);
    setShowSuccessAnimation(false);
  }

  function startOtpStep({ nextSessionId, nextAuthMode, nextOtpLength, otpCode, successMessage }) {
    const resolvedOtpLength = nextOtpLength || DEFAULT_OTP_LENGTH;
    setSessionId(nextSessionId);
    setAuthMode(nextAuthMode);
    setOtpLength(resolvedOtpLength);
    setOtp(new Array(resolvedOtpLength).fill(""));
    setActiveOtpCode(otpCode ? String(otpCode) : "");
    setStep(2);
    setResendCountdown(OTP_RESEND_SECONDS);
    setMessage(successMessage);
  }

  async function handleSendOtp(event) {
    event.preventDefault();

    if (!isStepOneInputValid) {
      setError(
        loginMethod === "mobile"
          ? "Enter a valid 10-digit mobile number."
          : "Enter a valid email address."
      );
      return;
    }

    setLoading(true);
    setError("");
    setMessage("Running background verification and AI trust analysis...");
    setIsVerificationNoticeVisible(true);
    setShowSuccessAnimation(false);

    try {
      if (loginMethod === "mobile") {
        const sanitizedPhone = sanitizePhoneNumber(phone);
        recordLoginAttempt(sanitizedPhone);
        const response = await requestOtp(sanitizedPhone);

        setPhone(sanitizedPhone);
        startOtpStep({
          nextSessionId: response.sessionId,
          nextAuthMode: response.authMode || "demo",
          nextOtpLength: response.otpLength || DEFAULT_OTP_LENGTH,
          otpCode: response.otp,
          successMessage: response.otp
            ? `OTP sent successfully. Use ${response.otp} to continue.`
            : "OTP sent successfully. Enter the verification code to continue.",
        });
      } else {
        const generatedOtp = buildMockOtp(DEFAULT_OTP_LENGTH);
        await wait(350);

        startOtpStep({
          nextSessionId: `email-${Date.now()}`,
          nextAuthMode: "email-demo",
          nextOtpLength: DEFAULT_OTP_LENGTH,
          otpCode: generatedOtp,
          successMessage: `OTP sent successfully. Use ${generatedOtp} to continue with email login.`,
        });
      }

      setIsVerificationNoticeVisible(false);
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "Service unavailable."));
      setIsVerificationNoticeVisible(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();
    const combinedOtp = otp.join("");
    const sanitizedPhone = sanitizePhoneNumber(phone);

    if (combinedOtp.length !== otpLength) {
      setError(`Enter all ${otpLength} OTP digits to continue.`);
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setIsVerificationNoticeVisible(true);

    try {
      if (authMode === "email-demo") {
        if (combinedOtp !== activeOtpCode) {
          throw new Error("Invalid OTP. Please check and try again.");
        }

        const emailHash = hashString(normalizedEmail);
        const emailLocalName = (normalizedEmail.split("@")[0] || "Demo User")
          .replace(/[._-]+/g, " ")
          .replace(/\b\w/g, (character) => character.toUpperCase());
        const phoneSuffix = String(emailHash).padStart(9, "0").slice(0, 9);

        signInWithDemoAccount({
          id: `demo-email-${emailHash}`,
          full_name: emailLocalName,
          phone: `9${phoneSuffix}`,
          city: loginCity && loginCity !== "Location unavailable" ? loginCity : "Bengaluru",
        });

        setMessage("Verification successful. Secure session established.");
        setShowSuccessAnimation(true);
        await wait(700);
        navigate(redirectPath, { replace: true });
        return;
      }

      const authRiskSnapshot = await assessAndSaveAuthRisk({
        phone: sanitizedPhone,
        flow: "login",
        formStartedAt: formStartedAtRef.current,
      });
      const savedUser = findStoredUserByPhone(sanitizedPhone);
      const persistedProfile = savedUser
        ? {
            full_name: savedUser.full_name,
            city: savedUser.city,
            zone: savedUser.zone,
            platform: savedUser.platform,
            weekly_income: savedUser.weekly_income,
            work_type: savedUser.work_type,
            worker_id: savedUser.worker_id,
            work_proof_name: savedUser.work_proof_name,
            work_verification_status: savedUser.work_verification_status,
            work_verification_flag: savedUser.work_verification_flag,
            signup_time: savedUser.signup_time,
          }
        : {};

      const response = await verifyOtp({
        sessionId,
        phone: sanitizedPhone,
        otp: combinedOtp,
        authMode,
        profile: {
          ...persistedProfile,
          deviceId: authRiskSnapshot.deviceId,
          authRiskScore: authRiskSnapshot.riskScore,
          authRiskLevel: authRiskSnapshot.riskLevel,
          authRiskStatus: authRiskSnapshot.riskStatus,
          location: authRiskSnapshot.location,
        },
      });

      if (response.registrationRequired && response.registrationToken) {
        await wait(350);
        navigate("/register", {
          replace: true,
          state: {
            phone: sanitizedPhone,
            registrationToken: response.registrationToken,
            authMode: response.authMode || "real",
          },
        });
        return;
      }

      saveAuthSession({
        ...response,
        user: {
          ...response.user,
          ...persistedProfile,
          phone: sanitizedPhone,
          deviceId: authRiskSnapshot.deviceId,
          authRiskScore: authRiskSnapshot.riskScore,
          authRiskLevel: authRiskSnapshot.riskLevel,
          authRiskStatus: authRiskSnapshot.riskStatus,
          location: authRiskSnapshot.location,
        },
      });

      setMessage("Verification successful. Secure session established.");
      setShowSuccessAnimation(true);
      await wait(700);
      navigate(redirectPath, { replace: true });
    } catch (verifyError) {
      if (authMode !== "email-demo") {
        recordLoginAttempt(sanitizedPhone);
      }
      setError(extractApiErrorMessage(verifyError, "Service unavailable."));
      setIsVerificationNoticeVisible(false);
      setShowSuccessAnimation(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCountdown > 0 || resendLoading || loading) {
      return;
    }

    const sanitizedPhone = sanitizePhoneNumber(phone);

    setResendLoading(true);
    setError("");

    try {
      if (authMode === "email-demo") {
        const generatedOtp = buildMockOtp(DEFAULT_OTP_LENGTH);
        await wait(250);
        setOtp(new Array(DEFAULT_OTP_LENGTH).fill(""));
        setActiveOtpCode(generatedOtp);
        setMessage(`A fresh OTP is ready. Use ${generatedOtp} to continue.`);
        setResendCountdown(OTP_RESEND_SECONDS);
      } else {
        recordLoginAttempt(sanitizedPhone);
        const response = await requestOtp(sanitizedPhone);
        setSessionId(response.sessionId);
        setAuthMode(response.authMode || "demo");
        setOtpLength(response.otpLength || DEFAULT_OTP_LENGTH);
        setOtp(new Array(response.otpLength || DEFAULT_OTP_LENGTH).fill(""));
        setActiveOtpCode(response.otp ? String(response.otp) : "");
        setMessage(
          response.otp
            ? `A fresh OTP is ready. Use ${response.otp} to continue.`
            : "A fresh OTP has been sent. Enter it to continue."
        );
        setResendCountdown(OTP_RESEND_SECONDS);
      }
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "Service unavailable."));
    } finally {
      setResendLoading(false);
    }
  }

  function handleChangeNumber() {
    setStep(1);
    setOtpLength(DEFAULT_OTP_LENGTH);
    setOtp(new Array(DEFAULT_OTP_LENGTH).fill(""));
    setSessionId("");
    setAuthMode("demo");
    setError("");
    setMessage("");
    setActiveOtpCode("");
    setIsVerificationNoticeVisible(false);
    setResendCountdown(0);
    setShowSuccessAnimation(false);
    formStartedAtRef.current = Date.now();
  }

  function handleContinueWithDemo() {
    setError("");
    setMessage("");
    setIsVerificationNoticeVisible(false);
    setShowSuccessAnimation(false);
    signInWithDemoAccount();
    navigate(redirectPath, { replace: true });
  }

  return (
    <AuthShell
      eyebrow="Login"
      title="Sign in to GigPredict AI"
      description="Use mobile or email OTP to access your secure real-time decision workspace."
      note="Fast sign-in, clean feedback, and silent trust checks run in the background while you move forward."
      footer={
        <>
          Need an account?{" "}
          <Link to="/register" className="font-medium text-blue-600 transition-colors duration-200 hover:text-blue-700">
            Create one here
          </Link>
          .
        </>
      }
    >
      <form onSubmit={step === 1 ? handleSendOtp : handleVerify} className="space-y-6">
        <AnimatePresence mode="wait" initial={false}>
          {step === 1 ? (
            <motion.div
              key="phone-step"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => handleSwitchLoginMethod("mobile")}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 ${
                    loginMethod === "mobile"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Login via Mobile
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchLoginMethod("email")}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 ${
                    loginMethod === "email"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Login via Email
                </button>
              </div>

              <AuthField
                id="mobile-number"
                label={loginMethod === "mobile" ? "Mobile Number" : "Email Address"}
                value={loginMethod === "mobile" ? phone : email}
                onChange={(value) =>
                  loginMethod === "mobile"
                    ? setPhone(sanitizePhoneNumber(value))
                    : setEmail(normalizeEmail(value))
                }
                placeholder={loginMethod === "mobile" ? "9876543210" : "name@example.com"}
                inputMode={loginMethod === "mobile" ? "numeric" : "email"}
                autoComplete={loginMethod === "mobile" ? "tel" : "email"}
                maxLength={loginMethod === "mobile" ? 10 : undefined}
                autoFocus
                prefix={loginMethod === "mobile" ? "+91" : undefined}
                disabled={loading}
                helperText="Secure OTP login with intelligent fallback access for testing environments"
              />

              {trustIndicator ? (
                <motion.div
                  key={`trust-indicator-${loginMethod}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className={`rounded-2xl border px-4 py-3 text-sm ${trustIndicator.toneClassName}`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <trustIndicator.icon size={16} />
                    Device Trust Score: {trustIndicator.score}% ({trustIndicator.label})
                  </div>
                </motion.div>
              ) : null}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Logging in from: {locationLoading ? "Detecting location..." : loginCity || "Location unavailable"}
                {locationSource ? ` (${locationSource})` : ""}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="otp-step"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-700">OTP Verification</p>
                  <p className="mt-1 text-sm text-slate-500">Code sent to +91 {phone}</p>
                </div>

                <button
                  type="button"
                  onClick={handleChangeNumber}
                  className="text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-slate-900"
                >
                  Change number
                </button>
              </div>

              <OtpInputGroup
                value={otp}
                onChange={setOtp}
                autoFocus={step === 2}
                disabled={loading}
              />

              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-slate-500">
                  {activeOtpCode
                    ? `Current verification code: ${activeOtpCode}`
                    : `Enter the latest ${otpLength}-digit OTP sent to your ${authMode === "email-demo" ? "email" : "phone"}.`}
                </span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCountdown > 0 || resendLoading || loading}
                  className="font-medium text-blue-600 transition-colors duration-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {resendCountdown > 0
                    ? `Resend OTP in ${resendCountdown}s`
                    : resendLoading
                      ? "Resending..."
                      : "Resend OTP"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isVerificationNoticeVisible ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {step === 1
              ? "Running background verification and AI trust analysis..."
              : "Verification in progress..."}
          </div>
        ) : null}

        {showSuccessAnimation ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          >
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 size={18} />
              OTP verified successfully. Secure login completed.
            </div>
          </motion.div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <SurfaceButton
          type="submit"
          className="w-full"
          loading={loading}
          disabled={loading || (step === 1 ? !isStepOneInputValid : otp.join("").length !== otpLength)}
        >
          {step === 1 ? "Send OTP" : "Verify and continue"}
        </SurfaceButton>

        {step === 1 ? (
          <SurfaceButton
            type="button"
            variant="secondary"
            className="w-full"
            onClick={handleContinueWithDemo}
            disabled={loading}
          >
            Continue with demo account
          </SurfaceButton>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">Security & Trust</p>
          <p className="mt-2">+ Secure OTP authentication</p>
          <p>+ AI-powered fraud detection</p>
          <p>+ Real-time monitoring system</p>
        </div>
      </form>
    </AuthShell>
  );
}
