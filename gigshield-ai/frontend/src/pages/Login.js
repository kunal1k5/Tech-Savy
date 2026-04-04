import React, { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthField from "../components/auth/AuthField";
import AuthShell from "../components/auth/AuthShell";
import OtpInputGroup from "../components/auth/OtpInputGroup";
import SurfaceButton from "../components/ui/SurfaceButton";
import { extractApiErrorMessage } from "../services/api";
import { requestOtp, verifyOtp } from "../services/workerFlow";
import { findStoredUserByPhone, saveAuthSession } from "../utils/auth";
import {
  assessAndSaveAuthRisk,
  recordLoginAttempt,
  sanitizePhoneNumber,
} from "../utils/authRisk";

const OTP_LENGTH = 4;

function wait(durationMs) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = location.state?.from || "/dashboard";
  const formStartedAtRef = useRef(Date.now());
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(new Array(OTP_LENGTH).fill(""));
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeOtpCode, setActiveOtpCode] = useState("");
  const [isVerificationNoticeVisible, setIsVerificationNoticeVisible] = useState(false);

  async function handleSendOtp(event) {
    event.preventDefault();
    const sanitizedPhone = sanitizePhoneNumber(phone);

    if (sanitizedPhone.length !== 10) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      recordLoginAttempt(sanitizedPhone);
      const response = await requestOtp(sanitizedPhone);

      setPhone(sanitizedPhone);
      setSessionId(response.sessionId);
      setStep(2);
      setActiveOtpCode(response.otp ? String(response.otp) : "");
      setMessage(
        response.otp
          ? `OTP sent successfully. Use ${response.otp} to continue.`
          : "OTP sent successfully. Enter the verification code to continue."
      );
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "Service unavailable."));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();
    const combinedOtp = otp.join("");
    const sanitizedPhone = sanitizePhoneNumber(phone);

    if (combinedOtp.length !== OTP_LENGTH) {
      setError("Enter all 4 OTP digits to continue.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setIsVerificationNoticeVisible(true);

    try {
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
        profile: {
          ...persistedProfile,
          deviceId: authRiskSnapshot.deviceId,
          authRiskScore: authRiskSnapshot.riskScore,
          authRiskLevel: authRiskSnapshot.riskLevel,
          authRiskStatus: authRiskSnapshot.riskStatus,
          location: authRiskSnapshot.location,
        },
      });

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

      await wait(650);
      navigate(redirectPath, { replace: true });
    } catch (verifyError) {
      recordLoginAttempt(sanitizedPhone);
      setError(extractApiErrorMessage(verifyError, "Service unavailable."));
      setIsVerificationNoticeVisible(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    const sanitizedPhone = sanitizePhoneNumber(phone);

    try {
      recordLoginAttempt(sanitizedPhone);
      const response = await requestOtp(sanitizedPhone);
      setSessionId(response.sessionId);
      setOtp(new Array(OTP_LENGTH).fill(""));
      setActiveOtpCode(response.otp ? String(response.otp) : "");
      setError("");
      setMessage(
        response.otp
          ? `A fresh OTP is ready. Use ${response.otp} to continue.`
          : "A fresh OTP has been sent. Enter it to continue."
      );
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "Service unavailable."));
    }
  }

  function handleChangeNumber() {
    setStep(1);
    setOtp(new Array(OTP_LENGTH).fill(""));
    setSessionId("");
    setError("");
    setMessage("");
    setActiveOtpCode("");
    setIsVerificationNoticeVisible(false);
    formStartedAtRef.current = Date.now();
  }

  return (
    <AuthShell
      eyebrow="Login"
      title="Sign in to GigShield AI"
      description="Enter your mobile number and a 4-digit OTP to continue into your real-time decision workspace."
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
            >
              <AuthField
                id="mobile-number"
                label="Mobile Number"
                value={phone}
                onChange={(value) => setPhone(sanitizePhoneNumber(value))}
                placeholder="9876543210"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
                autoFocus
                prefix="+91"
                disabled={loading}
                helperText="Use your registered 10-digit mobile number. The local API returns the current OTP while SMS delivery is not configured."
              />
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
                    : "Enter the latest OTP sent to your phone."}
                </span>
                <button
                  type="button"
                  onClick={handleResend}
                  className="font-medium text-blue-600 transition-colors duration-200 hover:text-blue-700"
                >
                  Resend OTP
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isVerificationNoticeVisible ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Verification in progress...
          </div>
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

        <SurfaceButton type="submit" className="w-full" loading={loading}>
          {step === 1 ? "Send OTP" : "Verify and continue"}
        </SurfaceButton>
      </form>
    </AuthShell>
  );
}
