import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  BadgeCheck,
  Briefcase,
  Camera,
  Clock3,
  FileText,
  Fingerprint,
  ShieldCheck,
} from "lucide-react";
import DocumentUploadCard from "../components/profile/DocumentUploadCard";
import InputField from "../components/profile/InputField";
import ProfileCard from "../components/profile/ProfileCard";
import SurfaceButton from "../components/ui/SurfaceButton";
import StatusBadge from "../components/ui/StatusBadge";
import { getUserFromToken } from "../utils/auth";
import { getAuthRiskProfile } from "../utils/authRisk";
import { cn } from "../utils/cn";
import { useGigShieldData } from "../context/GigShieldDataContext";

const PROFILE_STORAGE_KEY = "gigshield_profile_kyc";
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

function deriveWorkType(platform) {
  const normalized = String(platform || "").toLowerCase();
  if (["swiggy", "zomato", "zepto", "blinkit", "delivery"].includes(normalized)) {
    return "Delivery";
  }

  if (normalized === "driver" || normalized.includes("driver") || normalized.includes("cab")) {
    return "Driver";
  }

  return "Other";
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

function getInitialState(worker, sessionUser) {
  const storedState = readStorage(PROFILE_STORAGE_KEY, {});

  return {
    personalDetails: {
      fullName:
        storedState.personalDetails?.fullName ||
        sessionUser?.full_name ||
        worker.name ||
        "",
      mobileNumber:
        storedState.personalDetails?.mobileNumber ||
        sessionUser?.phone ||
        "",
      city: storedState.personalDetails?.city || sessionUser?.city || worker.city || "",
      workType:
        storedState.personalDetails?.workType ||
        deriveWorkType(sessionUser?.work_type || sessionUser?.platform || worker.platform),
    },
    documents: getInitialDocuments(storedState.documents),
  };
}

function getOverallStatus(documents, isProfileComplete) {
  const documentList = Object.values(documents);

  if (documentList.some((document) => document.status === "rejected")) {
    return "rejected";
  }

  const requiredDocumentsVerified = DOCUMENT_CONFIG
    .filter((document) => document.required)
    .every((document) => documents[document.id]?.status === "verified");

  if (isProfileComplete && requiredDocumentsVerified) {
    return "verified";
  }

  return "pending";
}

function getPreviewState(documentId, file, currentPreview) {
  if (currentPreview) {
    URL.revokeObjectURL(currentPreview);
  }

  if (file.type.startsWith("image/")) {
    return URL.createObjectURL(file);
  }

  return "";
}

export default function Profile() {
  const { platformState } = useGigShieldData();
  const sessionUser = getUserFromToken();
  const initialState = useMemo(
    () => getInitialState(platformState.worker, sessionUser),
    [platformState.worker, sessionUser]
  );
  const [personalDetails, setPersonalDetails] = useState(initialState.personalDetails);
  const [documents, setDocuments] = useState(initialState.documents);
  const [previewUrls, setPreviewUrls] = useState({});

  useEffect(() => {
    writeStorage(PROFILE_STORAGE_KEY, { personalDetails, documents });
  }, [documents, personalDetails]);

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
      personalDetails.fullName.trim() &&
        personalDetails.mobileNumber.length === 10 &&
        personalDetails.city.trim() &&
        personalDetails.workType
    );
  }, [personalDetails]);

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
    () => getAuthRiskProfile(personalDetails.mobileNumber),
    [personalDetails.mobileNumber]
  );
  const workVerificationDetails = useMemo(() => {
    return {
      platform: sessionUser?.platform || platformState.worker.platform || "Not added",
      workerId: sessionUser?.worker_id || "Not added",
      proofName: sessionUser?.work_proof_name || "No proof uploaded",
      status: sessionUser?.work_verification_status || "pending",
    };
  }, [platformState.worker.platform, sessionUser]);

  const internalFraudFlags = useMemo(() => {
    const offlineUsers = readStorage(OFFLINE_USERS_KEY, {});
    const phoneRecord = personalDetails.mobileNumber
      ? offlineUsers[personalDetails.mobileNumber]
      : null;

    return {
      duplicatePhoneAccount: Boolean(
        phoneRecord &&
          phoneRecord.full_name &&
          phoneRecord.full_name !== personalDetails.fullName.trim()
      ),
      incompleteProfile: !isProfileComplete,
      missingDocuments: !requiredDocumentsUploaded,
      onboardingMonitor: onboardingRiskProfile?.riskLevel === "medium",
      onboardingFlagged: onboardingRiskProfile?.riskLevel === "high",
    };
  }, [
    isProfileComplete,
    onboardingRiskProfile?.riskLevel,
    personalDetails.fullName,
    personalDetails.mobileNumber,
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
    setPersonalDetails((current) => ({
      ...current,
      [field]: field === "mobileNumber" ? sanitizePhone(value) : value,
    }));
  }

  function handleSaveDetails(event) {
    event.preventDefault();

    if (!isProfileComplete) {
      toast.error("Complete all personal details first.");
      return;
    }

    toast.success("Profile details saved.");
  }

  function handleDocumentUpload(documentId, file) {
    setPreviewUrls((current) => ({
      ...current,
      [documentId]: getPreviewState(documentId, file, current[documentId]),
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
      toast.error("Complete your personal details before verification.");
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

  return (
    <motion.div
      className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 md:py-8 xl:px-8"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants}>
        <ProfileCard
          fullName={personalDetails.fullName}
          mobileNumber={personalDetails.mobileNumber}
          city={personalDetails.city}
          workType={personalDetails.workType}
          verificationStatus={overallStatus}
          trustLevel={trustLevel}
        />
      </motion.div>

      <motion.section
        variants={itemVariants}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Personal Details</p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
              Basic worker information
            </h3>
          </div>
        </div>

        <form onSubmit={handleSaveDetails} className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <InputField
              id="full-name"
              label="Full Name"
              value={personalDetails.fullName}
              onChange={(value) => updateField("fullName", value)}
              placeholder="Kunal Sharma"
            />
            <InputField
              id="mobile-number"
              label="Mobile Number"
              value={personalDetails.mobileNumber}
              onChange={(value) => updateField("mobileNumber", value)}
              placeholder="9876543210"
              inputMode="numeric"
            />
            <InputField
              id="city"
              label="City"
              value={personalDetails.city}
              onChange={(value) => updateField("city", value)}
              placeholder="Bengaluru"
            />
            <InputField
              id="work-type"
              label="Work Type"
              value={personalDetails.workType}
              onChange={(value) => updateField("workType", value)}
              options={WORK_TYPE_OPTIONS}
            />
          </div>

          <SurfaceButton type="submit" className="w-full sm:w-auto">
            Save details
          </SurfaceButton>
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
              Verified worker profile
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Your work profile details are reviewed before protection is fully activated.
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
