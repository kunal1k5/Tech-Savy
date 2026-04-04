import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthShell from "../components/auth/AuthShell";
import FileUploadCard from "../components/onboarding/FileUploadCard";
import SelectInput from "../components/onboarding/SelectInput";
import TextInput from "../components/onboarding/TextInput";
import SurfaceButton from "../components/ui/SurfaceButton";
import { extractApiErrorMessage } from "../services/api";
import { registerWorker } from "../services/demoFlow";
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

function wait(durationMs) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

export default function Register() {
  const navigate = useNavigate();
  const formStartedAtRef = useRef(Date.now());
  const [form, setForm] = useState(INITIAL_FORM);
  const [proofFile, setProofFile] = useState(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isVerificationNoticeVisible, setIsVerificationNoticeVisible] = useState(false);

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

  const isContinueDisabled =
    loading ||
    !form.fullName.trim() ||
    form.phone.length !== 10 ||
    !form.city.trim() ||
    !form.workType ||
    !form.platform ||
    !form.workerId.trim() ||
    !proofFile ||
    !form.declarationAccepted;

  async function handleSubmit(event) {
    event.preventDefault();
    if (isContinueDisabled) {
      return;
    }

    setError("");
    setLoading(true);
    setIsVerificationNoticeVisible(true);

    try {
      const authRiskSnapshot = await assessAndSaveAuthRisk({
        phone: form.phone,
        flow: "signup",
        formStartedAt: formStartedAtRef.current,
      });

      const workVerificationStatus = "pending";
      const workVerificationFlag = authRiskSnapshot.internalFlags?.sameDeviceMultipleAccounts
        ? "suspicious_device_reuse"
        : null;

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
          workVerificationStatus,
          workVerificationFlag,
          weeklyIncome: form.workType === "Driver" ? 22000 : 18000,
          deviceId: authRiskSnapshot.deviceId,
          signupTime: authRiskSnapshot.signupTime,
          location: authRiskSnapshot.location,
          authRiskScore: authRiskSnapshot.riskScore,
          authRiskLevel: authRiskSnapshot.riskLevel,
          authRiskStatus: authRiskSnapshot.riskStatus,
        }
      );

      const registeredUser = {
        ...(response.user || {}),
        full_name: form.fullName.trim(),
        phone: form.phone,
        city: form.city.trim(),
        zone: form.city.trim(),
        platform: form.platform,
        work_type: form.workType,
        worker_id: form.workerId.trim(),
        work_proof_name: proofFile.name,
        work_verification_status: workVerificationStatus,
        work_verification_flag: workVerificationFlag,
        weekly_income: form.workType === "Driver" ? 22000 : 18000,
        device_id: authRiskSnapshot.deviceId,
        auth_risk_score: authRiskSnapshot.riskScore,
        auth_risk_level: authRiskSnapshot.riskLevel,
        auth_risk_status: authRiskSnapshot.riskStatus,
        signup_time: authRiskSnapshot.signupTime,
        location: authRiskSnapshot.location,
      };

      saveAuthSession({
        ...response,
        user: registeredUser,
      });

      await wait(900);
      navigate("/dashboard", { replace: true });
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
      title="Create your GigShield account"
      description="Set up your profile and verify your work details to activate protection."
      note="We begin fraud detection at the moment a user enters the system - not after a claim is made."
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
            disabled={loading}
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
            disabled={loading}
          />

          <TextInput
            id="city"
            label="City"
            value={form.city}
            onChange={(value) => updateField("city", value)}
            placeholder="Bengaluru"
            autoComplete="address-level2"
            disabled={loading}
          />

          <div className="sm:col-span-2">
            <SelectInput
              id="work-type"
              label="Work Type"
              value={form.workType}
              onChange={(value) => updateField("workType", value)}
              options={WORK_TYPE_OPTIONS}
              disabled={loading}
            />
          </div>
        </div>

        <section className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div>
            <p className="text-sm font-medium text-slate-500">Work Verification</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
              Verify your work profile to activate protection
            </h2>
          </div>

          <SelectInput
            id="platform"
            label="Which platform do you work with?"
            value={form.platform}
            onChange={(value) => updateField("platform", value)}
            options={PLATFORM_OPTIONS}
            disabled={loading}
          />

          <TextInput
            id="worker-id"
            label="Enter your Partner ID / Worker ID"
            value={form.workerId}
            onChange={(value) => updateField("workerId", value.toUpperCase())}
            placeholder="e.g. SWG12345"
            autoComplete="off"
            disabled={loading}
          />

          <FileUploadCard
            label="Upload Proof"
            helperText="Upload a screenshot of your app profile or an ID card."
            file={proofFile}
            previewUrl={proofPreviewUrl}
            onFileSelect={handleProofSelect}
            disabled={loading}
          />

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4">
            <input
              type="checkbox"
              checked={form.declarationAccepted}
              disabled={loading}
              onChange={(event) => updateField("declarationAccepted", event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
            />
            <span className="text-sm text-slate-700">
              I confirm that I am an active gig worker
            </span>
          </label>
        </section>

        {isVerificationNoticeVisible ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Verification in progress...
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Work verification stays simple for the user while background checks continue silently.
          </div>
        )}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <SurfaceButton type="submit" className="w-full" loading={loading} disabled={isContinueDisabled}>
          Continue
        </SurfaceButton>
      </form>
    </AuthShell>
  );
}
