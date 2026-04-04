import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  BadgeCheck,
  Briefcase,
  Camera,
  Clock3,
  FileText,
  Fingerprint,
  LogOut,
  PencilLine,
  ShieldCheck,
} from "lucide-react";
import DocumentUploadCard from "../components/profile/DocumentUploadCard";
import InputField from "../components/profile/InputField";
import ProfileCard from "../components/profile/ProfileCard";
import SurfaceButton from "../components/ui/SurfaceButton";
import StatusBadge from "../components/ui/StatusBadge";
import {
  clearSession,
  getStoredUser,
  getToken,
  getUserFromToken,
  saveAuthSession,
} from "../utils/auth";
import { getAuthRiskProfile } from "../utils/authRisk";
import { cn } from "../utils/cn";

const PROFILE_STORAGE_KEY_PREFIX = "gigshield_profile_kyc";
const OFFLINE_USERS_KEY = "gigshield_offline_users";

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: "easeOut",
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

const WORK_TYPE_OPTIONS = [
  { label: "Delivery", value: "Delivery" },
  { label: "Driver", value: "Driver" },
  { label: "Other", value: "Other" },
];

const DOCUMENT_CONFIG = [
  {
    id: "aadhaar",
    title: "Aadhaar Card",
    description: "Mandatory ID proof for account verification.",
    required: true,
    accept: "image/*,.pdf",
    icon: FileText,
  },
  {
    id: "profilePhoto",
    title: "Profile Photo",
    description: "Mandatory live profile photo used for trust checks.",
    required: true,
    accept: "image/*",
    icon: Camera,
  },
  {
    id: "drivingLicense",
    title: "Driving License",
    description: "Optional upload for workers who drive or ride.",
    required: false,
    accept: "image/*,.pdf",
    icon: FileText,
  },
];

const EMPTY_DOCUMENT_STATE = {
  status: "not_uploaded",
  fileName: "",
  uploadedAt: "",
};

const EMPTY_PROFILE_FORM = {
  name: "",
  phone: "",
  city: "",
  workType: "",
};

function readStorage(key, fallbackValue) {
  if (typeof window === "undefined") {
    return fallbackValue;
  }

  try {
    const rawValue = localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch {
    localStorage.removeItem(key);
    return fallbackValue;
  }
}

function writeStorage(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(key, JSON.stringify(value));
}

function sanitizePhone(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 10);
}

function getProfileStorageKey(user) {
  return `${PROFILE_STORAGE_KEY_PREFIX}:${user?.id || user?.phone || "guest"}`;
}

function getInitialDocuments(storedDocuments = {}) {
  return DOCUMENT_CONFIG.reduce((result, document) => {
    result[document.id] = {
      ...EMPTY_DOCUMENT_STATE,
      ...(storedDocuments[document.id] || {}),
    };
    return result;
  }, {});
}

function getCurrentStoredUser() {
  return getStoredUser() || getUserFromToken();
}

function getEditableProfile(user) {
  if (!user) {
    return EMPTY_PROFILE_FORM;
  }

  return {
    name: user.full_name || user.fullName || user.name || "",
    phone: user.phone || "",
    city: user.city || "",
    workType: user.work_type || user.workType || "",
  };
}

function getMergedUser(currentUser, form) {
  const fullName = form.name.trim();
  const city = form.city.trim();
  const workType = form.workType;

  return {
    ...(currentUser || {}),
    name: fullName,
    fullName,
    full_name: fullName,
    phone: form.phone,
    city,
    zone: city,
    workType,
    work_type: workType,
    platform: currentUser?.platform || "",
    weeklyIncome: Number(currentUser?.weeklyIncome ?? currentUser?.weekly_income ?? 0),
    weekly_income: Number(currentUser?.weeklyIncome ?? currentUser?.weekly_income ?? 0),
    workerId: currentUser?.workerId || currentUser?.worker_id || "",
    worker_id: currentUser?.workerId || currentUser?.worker_id || "",
    workProofName: currentUser?.workProofName || currentUser?.work_proof_name || "",
    work_proof_name: currentUser?.workProofName || currentUser?.work_proof_name || "",
    workVerificationStatus:
      currentUser?.workVerificationStatus ||
      currentUser?.work_verification_status ||
      "pending",
    work_verification_status:
      currentUser?.workVerificationStatus ||
      currentUser?.work_verification_status ||
      "pending",
    workVerificationFlag:
      currentUser?.workVerificationFlag ?? currentUser?.work_verification_flag ?? null,
    work_verification_flag:
      currentUser?.workVerificationFlag ?? currentUser?.work_verification_flag ?? null,
    deviceId: currentUser?.deviceId ?? currentUser?.device_id ?? null,
    device_id: currentUser?.deviceId ?? currentUser?.device_id ?? null,
    authRiskScore: Number(currentUser?.authRiskScore ?? currentUser?.auth_risk_score ?? 0),
    auth_risk_score: Number(currentUser?.authRiskScore ?? currentUser?.auth_risk_score ?? 0),
    authRiskLevel: currentUser?.authRiskLevel ?? currentUser?.auth_risk_level ?? "low",
    auth_risk_level: currentUser?.authRiskLevel ?? currentUser?.auth_risk_level ?? "low",
    authRiskStatus: currentUser?.authRiskStatus ?? currentUser?.auth_risk_status ?? "Safe",
    auth_risk_status: currentUser?.authRiskStatus ?? currentUser?.auth_risk_status ?? "Safe",
    signupTime: currentUser?.signupTime ?? currentUser?.signup_time ?? null,
    signup_time: currentUser?.signupTime ?? currentUser?.signup_time ?? null,
    location: currentUser?.location ?? null,
  };
}

function getOverallStatus(documents, isProfileComplete) {
  const documentList = Object.values(documents);

  if (documentList.some((document) => document.status === "rejected")) {
    return "rejected";
  }

  const requiredDocumentsVerified = DOCUMENT_CONFIG.filter((document) => document.required).every(
    (document) => documents[document.id]?.status === "verified"
  );

  if (isProfileComplete && requiredDocumentsVerified) {
    return "verified";
  }

  return "pending";
}

function getPreviewState(file, currentPreview) {
  if (currentPreview) {
    URL.revokeObjectURL(currentPreview);
  }

  if (file.type.startsWith("image/")) {
    return URL.createObjectURL(file);
  }

  return "";
}

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getCurrentStoredUser());
  const [form, setForm] = useState(() => getEditableProfile(getCurrentStoredUser()));
  const [isEditing, setIsEditing] = useState(false);
  const [documents, setDocuments] = useState(() => getInitialDocuments());
  const [previewUrls, setPreviewUrls] = useState({});

  const profileStorageKey = useMemo(
    () => getProfileStorageKey(user),
    [user?.id, user?.phone]
  );

  useEffect(() => {
    function syncCurrentUser() {
      const nextUser = getCurrentStoredUser();
      setUser(nextUser);
      setForm(getEditableProfile(nextUser));
      setIsEditing(false);
    }

    window.addEventListener("gigshield-auth-changed", syncCurrentUser);
    return () => {
      window.removeEventListener("gigshield-auth-changed", syncCurrentUser);
    };
  }, []);

  useEffect(() => {
    const storedProfile = readStorage(profileStorageKey, {});
    setDocuments(getInitialDocuments(storedProfile.documents));
    setPreviewUrls((current) => {
      Object.values(current).forEach((previewUrl) => {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
      });

      return {};
    });
  }, [profileStorageKey]);

  useEffect(() => {
    writeStorage(profileStorageKey, { documents });
  }, [documents, profileStorageKey]);

  useEffect(() => {
    return () => {
      Object.values(previewUrls).forEach((previewUrl) => {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
      });
    };
  }, [previewUrls]);

  const isProfileComplete = useMemo(() => {
    return Boolean(
      form.name.trim() &&
        form.phone.length === 10 &&
        form.city.trim() &&
        form.workType
    );
  }, [form]);

  const requiredDocumentIds = useMemo(
    () => DOCUMENT_CONFIG.filter((document) => document.required).map((document) => document.id),
    []
  );

  const requiredDocumentsUploaded = useMemo(() => {
    return requiredDocumentIds.every(
      (documentId) => documents[documentId]?.status !== "not_uploaded"
    );
  }, [documents, requiredDocumentIds]);

  const overallStatus = useMemo(
    () => getOverallStatus(documents, isProfileComplete),
    [documents, isProfileComplete]
  );

  const onboardingRiskProfile = useMemo(
    () => getAuthRiskProfile(form.phone),
    [form.phone]
  );

  const workVerificationDetails = useMemo(() => {
    return {
      platform: user?.platform || "Not added",
      workerId: user?.worker_id || user?.workerId || "Not added",
      proofName: user?.work_proof_name || user?.workProofName || "No proof uploaded",
      status:
        user?.work_verification_status ||
        user?.workVerificationStatus ||
        "pending",
    };
  }, [
    user?.platform,
    user?.workProofName,
    user?.workVerificationStatus,
    user?.work_proof_name,
    user?.work_verification_status,
    user?.workerId,
    user?.worker_id,
  ]);

  const internalFraudFlags = useMemo(() => {
    const offlineUsers = readStorage(OFFLINE_USERS_KEY, {});
    const phoneRecord = form.phone ? offlineUsers[form.phone] : null;

    return {
      duplicatePhoneAccount: Boolean(
        phoneRecord &&
          phoneRecord.full_name &&
          phoneRecord.full_name !== form.name.trim()
      ),
      incompleteProfile: !isProfileComplete,
      missingDocuments: !requiredDocumentsUploaded,
      onboardingMonitor: onboardingRiskProfile?.riskLevel === "medium",
      onboardingFlagged: onboardingRiskProfile?.riskLevel === "high",
    };
  }, [
    form.name,
    form.phone,
    isProfileComplete,
    onboardingRiskProfile?.riskLevel,
    requiredDocumentsUploaded,
  ]);

  const trustLevel = useMemo(() => {
    let trustScore = 100;

    if (internalFraudFlags.duplicatePhoneAccount) {
      trustScore -= 50;
    }
    if (internalFraudFlags.incompleteProfile) {
      trustScore -= 20;
    }
    if (internalFraudFlags.missingDocuments) {
      trustScore -= 30;
    }
    if (internalFraudFlags.onboardingMonitor) {
      trustScore -= 18;
    }
    if (internalFraudFlags.onboardingFlagged) {
      trustScore -= 35;
    }
    if (Object.values(documents).some((document) => document.status === "pending")) {
      trustScore -= 10;
    }

    if (trustScore >= 80) {
      return "high";
    }
    if (trustScore >= 50) {
      return "medium";
    }
    return "low";
  }, [documents, internalFraudFlags]);

  const verificationChecklist = useMemo(() => {
    return [
      {
        label: "Profile details complete",
        done: isProfileComplete,
      },
      {
        label: "Aadhaar uploaded",
        done: documents.aadhaar.status !== "not_uploaded",
      },
      {
        label: "Profile photo uploaded",
        done: documents.profilePhoto.status !== "not_uploaded",
      },
    ];
  }, [documents, isProfileComplete]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: field === "phone" ? sanitizePhone(value) : value,
    }));
  }

  function handleStartEdit() {
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setForm(getEditableProfile(user));
    setIsEditing(false);
  }

  function handleSaveDetails(event) {
    event.preventDefault();

    if (!isProfileComplete) {
      toast.error("Complete all profile details first.");
      return;
    }

    const previousStorageKey = getProfileStorageKey(user);
    const updatedUser = getMergedUser(user, form);
    const nextStorageKey = getProfileStorageKey(updatedUser);

    if (previousStorageKey !== nextStorageKey) {
      writeStorage(nextStorageKey, { documents });
      if (typeof window !== "undefined") {
        localStorage.removeItem(previousStorageKey);
      }
    }

    saveAuthSession({
      token: getToken(),
      user: updatedUser,
    });

    setUser(updatedUser);
    setForm(getEditableProfile(updatedUser));
    setIsEditing(false);
    toast.success("Profile updated successfully.");
  }

  function handleDocumentUpload(documentId, file) {
    setPreviewUrls((current) => ({
      ...current,
      [documentId]: getPreviewState(file, current[documentId]),
    }));

    setDocuments((current) => ({
      ...current,
      [documentId]: {
        ...current[documentId],
        fileName: file.name,
        status: "pending",
        uploadedAt: new Date().toISOString(),
      },
    }));

    toast.success("Document uploaded. Verification is pending.");
  }

  function handleCheckStatus() {
    if (!isProfileComplete) {
      toast.error("Complete your profile before verification.");
      return;
    }

    if (!requiredDocumentsUploaded) {
      toast.error("Upload Aadhaar Card and Profile Photo first.");
      return;
    }

    const hasPendingDocuments = Object.values(documents).some(
      (document) => document.status === "pending"
    );

    if (!hasPendingDocuments && overallStatus === "verified") {
      toast.success("Profile is already verified.");
      return;
    }

    setDocuments((current) =>
      Object.fromEntries(
        Object.entries(current).map(([documentId, document]) => [
          documentId,
          document.status === "pending"
            ? { ...document, status: "verified" }
            : document,
        ])
      )
    );

    toast.success("Verification status updated.");
  }

  function handleLogout() {
    clearSession();
    setUser(null);
    setForm(EMPTY_PROFILE_FORM);
    setDocuments(getInitialDocuments());
    setIsEditing(false);
    toast.success("Logged out successfully.");
    navigate("/login", { replace: true });
  }

  return (
    <motion.div
      className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 md:py-8 xl:px-8"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants}>
        <ProfileCard
          fullName={form.name}
          mobileNumber={form.phone}
          city={form.city}
          workType={form.workType}
          verificationStatus={overallStatus}
          trustLevel={trustLevel}
        />
      </motion.div>

      <motion.section
        variants={itemVariants}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Profile Settings</p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
              Dynamic worker profile
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Profile data is loaded from your saved session and updates instantly after every save.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {isEditing ? (
              <>
                <SurfaceButton
                  type="button"
                  variant="secondary"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </SurfaceButton>
                <SurfaceButton type="submit" form="profile-details-form">
                  Save Changes
                </SurfaceButton>
              </>
            ) : (
              <SurfaceButton
                type="button"
                onClick={handleStartEdit}
                leftIcon={PencilLine}
              >
                Edit Profile
              </SurfaceButton>
            )}

            <SurfaceButton
              type="button"
              variant="secondary"
              leftIcon={LogOut}
              onClick={handleLogout}
            >
              Logout
            </SurfaceButton>
          </div>
        </div>

        <form id="profile-details-form" onSubmit={handleSaveDetails} className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <InputField
              id="full-name"
              label="Full Name"
              value={form.name}
              onChange={(value) => updateField("name", value)}
              placeholder="Kunal Sharma"
              disabled={!isEditing}
            />
            <InputField
              id="mobile-number"
              label="Mobile Number"
              value={form.phone}
              onChange={(value) => updateField("phone", value)}
              placeholder="9876543210"
              inputMode="numeric"
              disabled={!isEditing}
            />
            <InputField
              id="city"
              label="City"
              value={form.city}
              onChange={(value) => updateField("city", value)}
              placeholder="Bengaluru"
              disabled={!isEditing}
            />
            <InputField
              id="work-type"
              label="Work Type"
              value={form.workType}
              onChange={(value) => updateField("workType", value)}
              options={WORK_TYPE_OPTIONS}
              disabled={!isEditing}
            />
          </div>

          <div
            className={cn(
              "rounded-2xl border px-4 py-3 text-sm",
              isEditing
                ? "border-blue-100 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-slate-50 text-slate-600"
            )}
          >
            {isEditing
              ? "Editing is active. Save changes to update the profile everywhere."
              : "Profile is locked. Use Edit Profile to update your details."}
          </div>
        </form>
      </motion.section>

      <motion.section
        variants={itemVariants}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Work Verification</p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
              Saved worker identity
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              These details come from the logged-in user and remain persistent across reloads.
            </p>
          </div>

          <StatusBadge
            status={workVerificationDetails.status}
            label={`Verification Status: ${
              workVerificationDetails.status[0].toUpperCase()
            }${workVerificationDetails.status.slice(1)}`}
          />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Briefcase size={16} />
              Work Platform
            </div>
            <p className="mt-3 text-base font-semibold text-slate-900">
              {workVerificationDetails.platform}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Fingerprint size={16} />
              Worker ID
            </div>
            <p className="mt-3 text-base font-semibold text-slate-900">
              {workVerificationDetails.workerId}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <FileText size={16} />
              Uploaded Proof
            </div>
            <p className="mt-3 truncate text-base font-semibold text-slate-900">
              {workVerificationDetails.proofName}
            </p>
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={itemVariants}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
      >
        <div>
          <p className="text-sm font-medium text-slate-500">Identity Verification</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
            Upload required documents
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Aadhaar Card and Profile Photo are mandatory. Driving License is optional.
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {DOCUMENT_CONFIG.map((document) => (
            <DocumentUploadCard
              key={document.id}
              title={document.title}
              description={document.description}
              required={document.required}
              accept={document.accept}
              icon={document.icon}
              status={documents[document.id].status}
              fileName={documents[document.id].fileName}
              previewUrl={previewUrls[document.id]}
              onUpload={(file) => handleDocumentUpload(document.id, file)}
            />
          ))}
        </div>
      </motion.section>

      <motion.section
        variants={itemVariants}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Verification Status</p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
              KYC review progress
            </h3>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusBadge status={overallStatus} />
            <StatusBadge
              status={trustLevel}
              label={`Trust Level: ${trustLevel[0].toUpperCase()}${trustLevel.slice(1)}`}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[220px_220px_minmax(0,1fr)]">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <ShieldCheck size={16} />
              Profile status
            </div>
            <div className="mt-3">
              <StatusBadge status={overallStatus} className="text-sm" />
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Clock3 size={16} />
              Review state
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {overallStatus === "verified"
                ? "All required details are approved."
                : "Uploaded details stay pending until review is complete."}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <BadgeCheck size={16} />
              Checklist
            </div>

            <div className="mt-4 space-y-3">
              {verificationChecklist.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-4 rounded-xl bg-white px-3 py-3"
                >
                  <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      item.done ? "bg-emerald-500" : "bg-amber-400"
                    )}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <SurfaceButton
          onClick={handleCheckStatus}
          variant="secondary"
          className="mt-6 w-full sm:w-auto"
        >
          Check verification status
        </SurfaceButton>
      </motion.section>
    </motion.div>
  );
}
