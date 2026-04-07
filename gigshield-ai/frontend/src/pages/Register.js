import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthShell from "../components/auth/AuthShell";
import OtpInputGroup from "../components/auth/OtpInputGroup";
import FileUploadCard from "../components/onboarding/FileUploadCard";
import SelectInput from "../components/onboarding/SelectInput";
import TextInput from "../components/onboarding/TextInput";
import SurfaceButton from "../components/ui/SurfaceButton";
import { extractApiErrorMessage } from "../services/api";
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
  city: "",
  workType: "Delivery",
  platform: "",
  workerId: "",
  declarationAccepted: false,
};
const DEFAULT_OTP_LENGTH = 6;

function wait(durationMs) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectedPhone = sanitizePhoneNumber(location.state?.phone || "");
  const redirectedRegistrationToken = location.state?.registrationToken || "";
  const formStartedAtRef = useRef(Date.now());
  const [form, setForm] = useState({
    ...INITIAL_FORM,
    phone: redirectedPhone,
  });
  const [proofFile, setProofFile] = useState(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState("");
  const [authMode, setAuthMode] = useState(
    redirectedRegistrationToken ? "real" : isRealAuthEnabled() ? "real" : "demo"
  );
  const [sessionId, setSessionId] = useState("");
  const [registrationToken, setRegistrationToken] = useState(redirectedRegistrationToken);
  const [otpLength, setOtpLength] = useState(DEFAULT_OTP_LENGTH);
  const [otp, setOtp] = useState(new Array(DEFAULT_OTP_LENGTH).fill(""));
  const [isOtpStepActive, setIsOtpStepActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(
    redirectedRegistrationToken
      ? "Phone number already verified. Complete your profile to finish signup."
      : ""
  );
  const [activeOtpCode, setActiveOtpCode] = useState("");
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

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: field === "phone" ? sanitizePhoneNumber(value) : value,
    }));
  }

  function handleProofSelect(file) {
    if (proofPreviewUrl) {
      URL.revokeObjectURL(proofPreviewUrl);
    }

    setProofFile(file);
    setProofPreviewUrl(file.type.startsWith("image/") ? URL.createObjectURL(file) : "");
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
    setOtpLength(response.otpLength || DEFAULT_OTP_LENGTH);
    setOtp(new Array(response.otpLength || DEFAULT_OTP_LENGTH).fill(""));
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
    setOtpLength(DEFAULT_OTP_LENGTH);
    setOtp(new Array(DEFAULT_OTP_LENGTH).fill(""));
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
    setOtpLength(response.otpLength || DEFAULT_OTP_LENGTH);
    setOtp(new Array(response.otpLength || DEFAULT_OTP_LENGTH).fill(""));
    setActiveOtpCode(response.otp ? String(response.otp) : "");
    setMessage(
      response.otp
        ? `A fresh OTP is ready. Use ${response.otp} to continue signup.`
        : "A fresh OTP has been sent. Enter it to continue signup."
    );
  }

  const isFormInvalid =
    !form.fullName.trim() ||
    form.phone.length !== 10 ||
    !form.city.trim() ||
    !form.workType ||
    !form.platform ||
    !form.workerId.trim() ||
    !proofFile ||
    !form.declarationAccepted;
  const isContinueDisabled = loading || (isOtpStep ? otp.join("").length !== otpLength : isFormInvalid);

  async function handleSubmit(event) {
    event.preventDefault();
    if (isContinueDisabled) {
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
      description="Set up your profile and verify your work details to join the decision intelligence network."
      note="We are not an insurance platform - we are an AI Decision Intelligence System and real-time protection system for gig workers."
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

          <TextInput
            id="city"
            label="City"
            value={form.city}
            onChange={(value) => updateField("city", value)}
            placeholder="Bengaluru"
            autoComplete="address-level2"
            disabled={loading || isOtpStep}
          />

          <div className="sm:col-span-2">
            <SelectInput
              id="work-type"
              label="Work Type"
              value={form.workType}
              onChange={(value) => updateField("workType", value)}
              options={WORK_TYPE_OPTIONS}
              disabled={loading || isOtpStep}
            />
          </div>
        </div>

        <section className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div>
            <p className="text-sm font-medium text-slate-500">Work Verification</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
              Verify your work profile to activate monitoring
            </h2>
          </div>

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
            label="Enter your Partner ID / Worker ID"
            value={form.workerId}
            onChange={(value) => updateField("workerId", value.toUpperCase())}
            placeholder="e.g. SWG12345"
            autoComplete="off"
            disabled={loading || isOtpStep}
          />

          <FileUploadCard
            label="Upload Proof"
            helperText="Upload a screenshot of your app profile or an ID card."
            file={proofFile}
            previewUrl={proofPreviewUrl}
            onFileSelect={handleProofSelect}
            disabled={loading || isOtpStep}
          />

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4">
            <input
              type="checkbox"
              checked={form.declarationAccepted}
              disabled={loading || isOtpStep}
              onChange={(event) => updateField("declarationAccepted", event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
            />
            <span className="text-sm text-slate-700">
              I confirm that I am an active gig worker
            </span>
          </label>
        </section>

        {isOtpStep ? (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-700">OTP Verification</p>
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

        {isVerificationNoticeVisible ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Verification in progress...
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {isRealRegistrationFlow && !registrationToken
              ? "Your account details stay here while OTP verification and background checks happen in parallel."
              : "Work verification stays simple for the user while background checks continue silently."}
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
                : "Continue"}
        </SurfaceButton>
      </form>
    </AuthShell>
  );
}
