"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BloodRequest,
  createRequestAction,
  createRequest,
  DonorEligibility,
  DonorProfile,
  DonorSummary,
  getDonorEligibility,
  getDonorFeed,
  getMedicalCenters,
  getPublicMedicalCenters,
  getMe,
  getDonorProfile,
  getDonorSummary,
  MedicalCenter,
  reverseGeocodeCity,
  getRequestActions,
  getRequests,
  RequestAction,
  RequestActionPayload,
  updateRequestStatus,
  upsertDonorProfile,
} from "@/lib/api";
import { RequireRole } from "@/components/AuthGuards";
import ConfirmModal from "@/components/ConfirmModal";
import ToastStack from "@/components/ToastStack";
import ThemeToggle from "@/components/ThemeToggle";
import { clearSession, getStoredToken } from "@/lib/session";
import { useToastQueue } from "@/lib/useToastQueue";

const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false });

function formatErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function parseCoordinatePair(latRaw: string, lngRaw: string): { lat: number; lng: number } | null {
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  // Reject (0,0) as invalid location
  if (lat === 0 && lng === 0) {
    return null;
  }
  return { lat, lng };
}

function toLocalDateTimeInputValue(date: Date): string {
  const next = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return next.toISOString().slice(0, 16);
}

function calculateAgeFromDateOfBirth(dateOfBirth: string): string {
  if (!dateOfBirth) return "";
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return "";

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age >= 0 ? String(age) : "";
}

function deriveDateOfBirthFromAge(ageYears: number, existingDob: string): string {
  const today = new Date();
  const fallback = new Date(`${today.getFullYear() - ageYears}-01-01T00:00:00`);

  if (!existingDob) {
    return fallback.toISOString().slice(0, 10);
  }

  const currentDob = new Date(`${existingDob}T00:00:00`);
  if (Number.isNaN(currentDob.getTime())) {
    return fallback.toISOString().slice(0, 10);
  }

  const month = currentDob.getMonth() + 1;
  const day = currentDob.getDate();
  const year = today.getFullYear() - ageYears;
  const paddedMonth = String(month).padStart(2, "0");
  const paddedDay = String(day).padStart(2, "0");
  return `${year}-${paddedMonth}-${paddedDay}`;
}

type DonorTab = "overview" | "profile" | "create" | "requests" | "map";
type ConfirmState = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
} | null;

type DonorForm = {
  blood_group: string;
  date_of_birth: string;
  weight_kg: string;
  gender: "M" | "F" | "O";
  is_available: boolean;
  lat: string;
  lng: string;
};

type RequestForm = {
  patient_name: string;
  description: string;
  patient_age: string;
  blood_group_needed: string;
  units_required: string;
  urgency: "STANDARD" | "URGENT" | "CRITICAL";
  required_by_datetime: string;
  hospital_name: string;
  lat: string;
  lng: string;
};

const initialDonorForm: DonorForm = {
  blood_group: "O+",
  date_of_birth: "1998-01-01",
  weight_kg: "60",
  gender: "O",
  is_available: true,
  lat: "",
  lng: "",
};

const initialRequestForm: RequestForm = {
  patient_name: "",
  description: "",
  patient_age: "",
  blood_group_needed: "O+",
  units_required: "1",
  urgency: "URGENT",
  required_by_datetime: "",
  hospital_name: "",
  lat: "",
  lng: "",
};

export default function DonorDashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<DonorTab>("overview");
  const [form, setForm] = useState<DonorForm>(initialDonorForm);
  const [requestForm, setRequestForm] = useState<RequestForm>(initialRequestForm);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [feed, setFeed] = useState<BloodRequest[]>([]);
  const [eligibility, setEligibility] = useState<DonorEligibility | null>(null);
  const [summary, setSummary] = useState<DonorSummary | null>(null);
  const [displayName, setDisplayName] = useState("Donor");
  const [requestFilter, setRequestFilter] = useState<"ALL" | "CRITICAL" | "URGENT" | "STANDARD">("ALL");
  const [radiusKm, setRadiusKm] = useState(10);
  const [mapSource, setMapSource] = useState<"nearby" | "all">("nearby");
  const [mapBloodGroup, setMapBloodGroup] = useState("ALL");
  const [mapUrgency, setMapUrgency] = useState<"ALL" | "STANDARD" | "URGENT" | "CRITICAL">("ALL");
  const [selectedMapRequestId, setSelectedMapRequestId] = useState<number | null>(null);
  const [requestActions, setRequestActions] = useState<Record<number, RequestAction[]>>({});
  const [autoDetectAttempted, setAutoDetectAttempted] = useState(false);
  const [busyText, setBusyText] = useState("");
  const [message, setMessage] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [actionLoadingById, setActionLoadingById] = useState<Record<number, boolean>>({});
  const [expandedActivityId, setExpandedActivityId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [requestCreating, setRequestCreating] = useState(false);
  const [successModal, setSuccessModal] = useState<{ title: string; description: string } | null>(null);
  const [sameGroupOnly, setSameGroupOnly] = useState(true);
  const [medicalCenters, setMedicalCenters] = useState<MedicalCenter[]>([]);
  const [detectedCity, setDetectedCity] = useState("");
  const [selectedCenterId, setSelectedCenterId] = useState("");
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [ageYears, setAgeYears] = useState("");
  const { toasts, pushToast, dismissToast } = useToastQueue();

  const myRequests = useMemo(() => requests.filter((item) => item.requester === userId), [requests, userId]);
  const compatibleRequests = useMemo(
    () => requests.filter((item) => item.blood_group_needed === form.blood_group),
    [requests, form.blood_group]
  );
  const requestRows = useMemo(() => {
    if (!sameGroupOnly) return requests;
    return requests.filter((item) => item.blood_group_needed === form.blood_group || item.requester === userId);
  }, [requests, sameGroupOnly, form.blood_group, userId]);
  const donorRequestStats = useMemo(() => {
    const active = requests.filter((r) => r.status === "ACTIVE").length;
    const partial = requests.filter((r) => r.status === "PARTIAL").length;
    const fulfilled = requests.filter((r) => r.status === "FULFILLED").length;
    const closed = requests.filter((r) => r.status === "CLOSED").length;
    const denominator = Math.max(active + partial + fulfilled + closed, 1);
    return {
      active,
      partial,
      fulfilled,
      closed,
      denominator,
      resolutionRate: Math.round(((fulfilled + closed) / denominator) * 100),
    };
  }, [requests]);
  const filteredRequestRows = useMemo(() => {
    if (requestFilter === "ALL") return requestRows;
    return requestRows.filter((item) => item.urgency === requestFilter);
  }, [requestRows, requestFilter]);

  const mapCenter = useMemo(
    () => ({ lat: Number(form.lat) || 0, lng: Number(form.lng) || 0 }),
    [form.lat, form.lng]
  );

  const filteredMapRequests = useMemo(() => {
    const source = mapSource === "nearby" ? feed : requests;
    return source.filter((item) => {
      const bloodMatch = mapBloodGroup === "ALL" || item.blood_group_needed === mapBloodGroup;
      const urgencyMatch = mapUrgency === "ALL" || item.urgency === mapUrgency;
      return bloodMatch && urgencyMatch;
    });
  }, [feed, mapSource, mapBloodGroup, mapUrgency, requests]);

  const mapPoints = useMemo(
    () => [] as Array<{ id: string | number; label: string; lat: number; lng: number; color: string }>,
    []
  );

  const selectedMapRequest = useMemo(
    () => filteredMapRequests.find((item) => item.id === selectedMapRequestId) || filteredMapRequests[0] || null,
    [filteredMapRequests, selectedMapRequestId]
  );

  // Auto-pan map to selected request location when in map view
  const effectiveMapCenter = useMemo(() => {
    return mapCenter;
  }, [mapCenter]);
  const mapRadiusMeters = useMemo(() => Math.max(radiusKm, 1) * 1000, [radiusKm]);
  const requestDraftCenter = useMemo(
    () => ({ lat: Number(requestForm.lat) || mapCenter.lat, lng: Number(requestForm.lng) || mapCenter.lng }),
    [requestForm.lat, requestForm.lng, mapCenter.lat, mapCenter.lng]
  );
  const displayDate = useMemo(
    () => new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    []
  );
  const maxBirthDate = useMemo(() => toLocalDateTimeInputValue(new Date()).slice(0, 10), []);
  const minRequiredByDateTime = useMemo(() => toLocalDateTimeInputValue(new Date()), []);

  function normalizeCityName(city: string): string {
    return city
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .replace(/\b(city|district|division|tehsil|capital|territory|pakistan)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cityMatches(centerCity: string, detected: string): boolean {
    const a = normalizeCityName(centerCity || "");
    const b = normalizeCityName(detected || "");
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a);
  }

  async function getBrowserLocationCoords(): Promise<{ lat: number; lng: number } | null> {
    if (typeof window === "undefined" || !navigator.geolocation) {
      return null;
    }

    try {
      const coords = await new Promise<GeolocationCoordinates>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve(position.coords),
          () => reject(new Error("Location unavailable")),
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        );
      });

      const lat = Number(coords.latitude.toFixed(6));
      const lng = Number(coords.longitude.toFixed(6));
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
        return null;
      }

      return { lat, lng };
    } catch {
      return null;
    }
  }

  function geolocationBlockedHint(): string {
    if (typeof window === "undefined") return "";
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!window.isSecureContext && !isLocalhost) {
      return "Location access is blocked on non-HTTPS LAN URLs. Use https or localhost, or set coordinates manually.";
    }
    return "";
  }

  useEffect(() => {
    const activeToken = getStoredToken();
    if (!activeToken) return;

    setToken(activeToken);
    void loadDonorDashboard(activeToken, radiusKm);
  }, [radiusKm]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    if (tabParam === "overview" || tabParam === "profile" || tabParam === "create" || tabParam === "requests" || tabParam === "map") {
      setActiveTab(tabParam);
    }
  }, []);

  useEffect(() => {
    if (filteredMapRequests.length && !selectedMapRequestId) {
      setSelectedMapRequestId(filteredMapRequests[0].id);
    }
  }, [filteredMapRequests, selectedMapRequestId]);

  // Auto-dismiss success modal after 3 seconds
  useEffect(() => {
    if (!successModal) return;
    const timer = setTimeout(() => {
      setSuccessModal(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [successModal]);

  useEffect(() => {
    // Keep create-request location aligned with profile location unless a center is actively selected.
    if (selectedCenterId) {
      return;
    }
    setRequestForm((prev) => {
      if (prev.lat === form.lat && prev.lng === form.lng) {
        return prev;
      }
      return { ...prev, lat: form.lat, lng: form.lng };
    });
  }, [form.lat, form.lng, selectedCenterId]);

  useEffect(() => {
    setAgeYears(calculateAgeFromDateOfBirth(form.date_of_birth));
  }, [form.date_of_birth]);

  function changeTab(tab: DonorTab) {
    setActiveTab(tab);
    router.replace(`/dashboard/donor?tab=${tab}`);
  }

  useEffect(() => {
    if (autoDetectAttempted) return;
    if (Number(form.lat) !== 0 || Number(form.lng) !== 0) return;

    setAutoDetectAttempted(true);
    void detectLocation(true);
  }, [autoDetectAttempted, form.lat, form.lng]);

  async function loadDonorDashboard(activeToken: string, radius: number) {
    setLoading(true);
    setMessage("");
    try {
      const [profileResult, requestsResult, meResult] = await Promise.allSettled([
        getDonorProfile(activeToken),
        getRequests(activeToken, { includeHistory: true }),
        getMe(activeToken),
      ]);

      if (profileResult.status !== "fulfilled") {
        throw new Error(formatErrorMessage(profileResult.reason, "Failed to load donor profile."));
      }

      if (requestsResult.status !== "fulfilled") {
        throw new Error(formatErrorMessage(requestsResult.reason, "Failed to load requests."));
      }

      const profile = profileResult.value;
      const allRequests = requestsResult.value;

      let profileLat = Number(profile.location?.lat);
      let profileLng = Number(profile.location?.lng);
      const hasValidProfileLocation =
        Number.isFinite(profileLat) && Number.isFinite(profileLng) && !(profileLat === 0 && profileLng === 0);

      // Fallback: if profile location is invalid, try browser current location and persist it.
      if (!hasValidProfileLocation) {
        const browserLoc = await getBrowserLocationCoords();
        if (browserLoc) {
          profileLat = browserLoc.lat;
          profileLng = browserLoc.lng;
          await upsertDonorProfile(activeToken, {
            blood_group: profile.blood_group,
            date_of_birth: profile.date_of_birth || "1998-01-01",
            weight_kg: Number(profile.weight_kg || 60),
            gender: (profile.gender as "M" | "F" | "O") || "O",
            is_available: profile.is_available,
            location: { lat: profileLat, lng: profileLng },
          } as Partial<DonorProfile>);
          pushToast("success", "Current location detected and saved.");
        }
      }

      const hasResolvedLocation =
        Number.isFinite(profileLat) && Number.isFinite(profileLng) && !(profileLat === 0 && profileLng === 0);

      setForm((prev) => ({
        blood_group: profile.blood_group,
        date_of_birth: profile.date_of_birth || "1998-01-01",
        weight_kg: String(profile.weight_kg || "60"),
        gender: (profile.gender as "M" | "F" | "O") || "O",
        is_available: profile.is_available,
        // Do not overwrite a valid current-location in UI with empty/invalid profile coordinates.
        lat: hasResolvedLocation ? String(profileLat) : prev.lat,
        lng: hasResolvedLocation ? String(profileLng) : prev.lng,
      }));

      setRequestForm((prev) => ({
        ...prev,
        blood_group_needed: profile.blood_group || prev.blood_group_needed,
        lat: hasResolvedLocation ? String(profileLat) : prev.lat,
        lng: hasResolvedLocation ? String(profileLng) : prev.lng,
      }));
      setRequests(allRequests);

      if (meResult.status === "fulfilled") {
        setUserId(meResult.value.id);
        setDisplayName(meResult.value.first_name || meResult.value.email.split("@")[0]);
      }

      // Load feed and summary only when location is valid to avoid server-side 400.
      if (hasResolvedLocation) {
        const [nearbyResult, eligibilityResult, summaryResult] = await Promise.allSettled([
          getDonorFeed(activeToken, radius),
          getDonorEligibility(activeToken),
          getDonorSummary(activeToken, radius),
        ]);

        setFeed(nearbyResult.status === "fulfilled" ? nearbyResult.value : []);
        setEligibility(eligibilityResult.status === "fulfilled" ? eligibilityResult.value : null);
        setSummary(summaryResult.status === "fulfilled" ? summaryResult.value : null);

        if (nearbyResult.status !== "fulfilled") {
          pushToast("error", formatErrorMessage(nearbyResult.reason, "Nearby feed could not be loaded."));
        }
        if (eligibilityResult.status !== "fulfilled") {
          pushToast("error", formatErrorMessage(eligibilityResult.reason, "Eligibility details could not be loaded."));
        }
        if (summaryResult.status !== "fulfilled") {
          pushToast("error", formatErrorMessage(summaryResult.reason, "Summary statistics could not be loaded."));
        }
      } else {
        setFeed([]);
        const eligibility = await getDonorEligibility(activeToken).catch(() => null);
        setEligibility(eligibility);
        setSummary(null);
        pushToast("info", "Location is required for nearby feed. Please allow location access.");
      }

      // Always try to load city centers from current location; if strict call fails, use relaxed city fallback.
      if (hasResolvedLocation) {
        const userCity = await reverseGeocodeCity(profileLat, profileLng);
        const resolvedCity = (userCity || "").trim();
        if (resolvedCity) {
          try {
            const strictCityCenters = await getPublicMedicalCenters({
              city: resolvedCity,
              centerType: "HOSPITAL",
              strictCity: true,
              limit: 200,
            });
            const strictItems = strictCityCenters.items.filter((item) => cityMatches(item.city || "", resolvedCity));

            if (strictItems.length) {
              setMedicalCenters(strictItems);
              setDetectedCity(resolvedCity);
            } else {
              const relaxedCityCenters = await getPublicMedicalCenters({
                city: resolvedCity,
                centerType: "HOSPITAL",
                limit: 200,
              });
              const relaxedItems = relaxedCityCenters.items.filter((item) => cityMatches(item.city || "", resolvedCity));
              setMedicalCenters(relaxedItems);
              setDetectedCity(resolvedCity);
            }
          } catch {
            // Last fallback keeps city-based matching by name only.
            const centerFallback = await getMedicalCenters(activeToken, {
              city: resolvedCity,
              centerType: "HOSPITAL",
            }).catch(() => null);
            const fallbackItems = centerFallback?.items?.filter((item) => cityMatches(item.city || "", resolvedCity)) || [];
            setMedicalCenters(fallbackItems);
            setDetectedCity(resolvedCity);
          }
        } else {
          setMedicalCenters([]);
          setDetectedCity("");
        }
      } else {
        setMedicalCenters([]);
        setDetectedCity("");
      }
    } catch (error) {
      pushToast("error", formatErrorMessage(error, "Failed to load donor dashboard."));
    } finally {
      setLoading(false);
    }
  }

  async function loadRequestActions(requestId: number) {
    if (!token) return;

    try {
      const actions = await getRequestActions(token, requestId);
      setRequestActions((prev) => ({ ...prev, [requestId]: actions }));
    } catch {
      // Keep UI responsive even if action history fetch fails.
    }
  }

  async function detectLocation(saveAfterDetect = false) {
    if (!navigator.geolocation) {
      pushToast("error", "Geolocation is not supported in this browser.");
      return;
    }

    try {
      const coords = await new Promise<GeolocationCoordinates>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve(position.coords),
          (error) => {
            const reason = error.code === error.PERMISSION_DENIED
              ? "Location permission denied."
              : error.code === error.POSITION_UNAVAILABLE
                ? "Location is unavailable."
                : "Location request timed out.";
            reject(new Error(`${reason} ${geolocationBlockedHint()}`.trim()));
          },
          {
            enableHighAccuracy: true,
            timeout: 12_000,
            maximumAge: 0,
          }
        );
      });

      const lat = coords.latitude.toFixed(6);
      const lng = coords.longitude.toFixed(6);
      setForm((prev) => ({ ...prev, lat, lng }));
      setRequestForm((prev) => ({ ...prev, lat, lng }));

      if (!saveAfterDetect) {
        pushToast("success", "Location auto-detected.");
        return;
      }

      if (!token) {
        pushToast("info", "Location detected, but you need to sign in again before auto-saving profile.");
        return;
      }

      setProfileSaving(true);
      setLoading(true);
      setBusyText("Saving auto-detected location...");

      await upsertDonorProfile(token, {
        blood_group: form.blood_group,
        date_of_birth: form.date_of_birth,
        weight_kg: Number(form.weight_kg),
        gender: form.gender,
        is_available: form.is_available,
        location: { lat: Number(lat), lng: Number(lng) },
      } as Partial<DonorProfile>);

      pushToast("success", "Location detected and saved to your profile.");
      await loadDonorDashboard(token, radiusKm);
    } catch (error) {
      pushToast("error", formatErrorMessage(error, "Unable to fetch your location."));
    } finally {
      setProfileSaving(false);
      setLoading(false);
      setBusyText("");
    }
  }

  function handleRequestMapPick(lat: number, lng: number) {
    const nextLat = lat.toFixed(6);
    const nextLng = lng.toFixed(6);
    setRequestForm((prev) => ({ ...prev, lat: nextLat, lng: nextLng }));
    pushToast("info", `Request location updated to ${nextLat}, ${nextLng}.`);
  }

  function handleProfileMapDrag(lat: number, lng: number) {
    const nextLat = lat.toFixed(6);
    const nextLng = lng.toFixed(6);
    setForm((prev) => ({ ...prev, lat: nextLat, lng: nextLng }));
    setRequestForm((prev) => ({ ...prev, lat: nextLat, lng: nextLng }));
    pushToast("info", `Profile location dragged to ${nextLat}, ${nextLng}.`);
  }

  async function handleUpdateProfile(event?: FormEvent) {
    if (event) {
      event.preventDefault();
    }
    if (!token) return;

    const weight = Number(form.weight_kg);
    const location = parseCoordinatePair(form.lat, form.lng);
    const today = new Date();
    const dob = form.date_of_birth ? new Date(`${form.date_of_birth}T00:00:00`) : null;

    if (!form.date_of_birth || !dob || Number.isNaN(dob.getTime())) {
      pushToast("error", "Please enter a valid date of birth.");
      return;
    }

    if (dob >= new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      pushToast("error", "Date of birth must be in the past.");
      return;
    }

    const age = Number(calculateAgeFromDateOfBirth(form.date_of_birth));
    if (!Number.isFinite(age) || age < 18 || age > 100) {
      pushToast("error", "Donor age must be between 18 and 100 years.");
      return;
    }

    if (!Number.isFinite(weight) || weight < 30 || weight > 300) {
      pushToast("error", "Weight must be between 30 kg and 300 kg.");
      return;
    }

    if (!location) {
      // Provide more specific error message
      if (!form.lat.trim() || !form.lng.trim()) {
        pushToast("error", "Location is required. Please use Auto-detect or drag the map marker.");
      } else if (Number(form.lat) === 0 && Number(form.lng) === 0) {
        pushToast("error", "Please set a valid location. The (0,0) coordinates are not allowed.");
      } else {
        pushToast("error", "Please enter valid coordinates (latitude -90 to 90, longitude -180 to 180).");
      }
      return;
    }

    setProfileSaving(true);
    setLoading(true);
    setBusyText("Saving donor profile...");
    setMessage("");
    try {
      await upsertDonorProfile(token, {
        blood_group: form.blood_group,
        date_of_birth: form.date_of_birth,
        weight_kg: weight,
        gender: form.gender,
        is_available: form.is_available,
        location,
      } as Partial<DonorProfile>);

      pushToast("success", "Donor profile updated.");
      await loadDonorDashboard(token, radiusKm);
    } catch (error) {
      pushToast("error", formatErrorMessage(error, "Failed to update donor profile."));
    } finally {
      setProfileSaving(false);
      setLoading(false);
      setBusyText("");
    }
  }

  async function handleCreateRequest(event: FormEvent) {
    event.preventDefault();
    if (!token) return;

    if (requestCreating) {
      return;
    }

    const patientName = requestForm.patient_name.trim();
    const description = requestForm.description.trim();
    const hospitalName = requestForm.hospital_name.trim();
    const requiredBy = requestForm.required_by_datetime ? new Date(requestForm.required_by_datetime) : null;
    const now = new Date();
    const units = Number(requestForm.units_required);
    const location = parseCoordinatePair(requestForm.lat, requestForm.lng) || parseCoordinatePair(form.lat, form.lng);

    if (!patientName) {
      pushToast("error", "Please enter patient name.");
      return;
    }

    if (!hospitalName) {
      pushToast("error", "Please enter hospital or medical center name.");
      return;
    }

    if (!requestForm.required_by_datetime || !requiredBy || Number.isNaN(requiredBy.getTime())) {
      pushToast("error", "Please provide a valid required-by date and time.");
      return;
    }

    if (requiredBy <= now) {
      pushToast("error", "Required-by date and time must be in the future.");
      return;
    }

    if (!Number.isInteger(units) || units <= 0 || units > 20) {
      pushToast("error", "Units required must be a whole number between 1 and 20.");
      return;
    }

    if (requestForm.patient_age.trim()) {
      const patientAge = Number(requestForm.patient_age);
      if (!Number.isInteger(patientAge) || patientAge < 0 || patientAge > 130) {
        pushToast("error", "Patient age must be a whole number between 0 and 130.");
        return;
      }
    }

    if (!location) {
      // Provide more specific error message
      const lat = Number(requestForm.lat || form.lat);
      const lng = Number(requestForm.lng || form.lng);
      if ((isNaN(lat) && !requestForm.lat) || (isNaN(lng) && !requestForm.lng)) {
        pushToast("error", "Please enter valid coordinates for request location. You can also auto-detect location in Profile.");
      } else if (lat === 0 && lng === 0) {
        pushToast("error", "Please set a valid location. The (0,0) coordinates are not allowed. Auto-detect from Profile or drag the map.");
      } else {
        pushToast("error", "Please enter valid coordinates for request location. You can also auto-detect location in Profile.");
      }
      return;
    }

    setRequestCreating(true);
    setLoading(true);
    setBusyText("Creating blood request...");
    setMessage("");

    try {
      await createRequest(token, {
        patient_name: patientName,
        description: description || undefined,
        patient_age: requestForm.patient_age ? Number(requestForm.patient_age) : undefined,
        blood_group_needed: requestForm.blood_group_needed,
        units_required: units,
        urgency: requestForm.urgency,
        required_by_datetime: requiredBy.toISOString(),
        hospital_name: hospitalName,
        location,
      });

      setSuccessModal({
        title: "Request Created Successfully! 🎉",
        description: `A blood request for ${patientName} (${requestForm.blood_group_needed}) has been created and is now visible to nearby donors.`,
      });

      setRequestForm((prev) => ({
        ...initialRequestForm,
        blood_group_needed: form.blood_group || prev.blood_group_needed,
        lat: form.lat,
        lng: form.lng,
      }));
      setSelectedCenterId("");
      changeTab("requests");

      // Optimize: only refresh requests, not entire dashboard.
      try {
        const [nearbyReqs, allReqs] = await Promise.all([
          getDonorFeed(token, radiusKm),
          getRequests(token, { includeHistory: true }),
        ]);
        setFeed(nearbyReqs);
        setRequests(allReqs);
      } catch {
        // If refresh fails, user can manually refresh; don't block success modal.
      }
    } catch (error) {
      pushToast("error", formatErrorMessage(error, "Failed to create request."));
    } finally {
      setRequestCreating(false);
      setLoading(false);
      setBusyText("");
    }
  }

  async function refreshNearbyFeed() {
    if (!token) return;
    setLoading(true);
    setBusyText("Refreshing nearby feed...");
    setMessage("");

    try {
      const nearbyRequests = await getDonorFeed(token, radiusKm);
      setFeed(nearbyRequests);
      pushToast("success", `Nearby feed refreshed. ${nearbyRequests.length} requests found.`);
    } catch (error) {
      pushToast("error", formatErrorMessage(error, "Failed to refresh nearby requests."));
    } finally {
      setLoading(false);
      setBusyText("");
    }
  }

  async function handleOwnerStatusUpdate(requestId: number, status: "ACTIVE" | "PARTIAL" | "FULFILLED" | "CLOSED") {
    if (!token) return;
    setConfirmState({
      title: "Confirm Request Status",
      description: `Are you sure you want to mark this request as ${status}?`,
      confirmLabel: `Mark ${status}`,
      onConfirm: async () => {
        try {
          setLoading(true);
          setBusyText("Updating request status...");
          await updateRequestStatus(token, requestId, { status });
          pushToast("success", `Request marked as ${status}.`);
          await loadDonorDashboard(token, radiusKm);
        } catch (error) {
          pushToast("error", error instanceof Error ? error.message : "Failed to update request status.");
        } finally {
          setLoading(false);
          setBusyText("");
        }
      },
    });
  }

  async function handleTakeAction(requestId: number, actionType: RequestActionPayload["action_type"]) {
    if (!token) return;

    try {
      const existing = requestActions[requestId] ?? (await getRequestActions(token, requestId));
      if (!requestActions[requestId]) {
        setRequestActions((prev) => ({ ...prev, [requestId]: existing }));
      }
      const alreadySent = existing.some((entry) => entry.actor === userId && entry.action_type === actionType);
      if (alreadySent) {
        pushToast("info", `You already sent ${actionType.toLowerCase()} for this request.`);
        return;
      }
    } catch {
      // Continue with submit path and let API return canonical validation if any.
    }

    setConfirmState({
      title: `Confirm ${actionType}`,
      description: `Proceed with ${actionType.toLowerCase()} on this request?`,
      confirmLabel: actionType,
      onConfirm: async () => {
        try {
          setActionLoadingById((prev) => ({ ...prev, [requestId]: true }));
          await createRequestAction(token, requestId, {
            action_type: actionType,
            note: actionType === "FLAG" ? "Flagged for verification" : "Ready to help",
          });
          pushToast("success", `Action submitted: ${actionType}.`);
          await loadDonorDashboard(token, radiusKm);
          await loadRequestActions(requestId);
          setExpandedActivityId(requestId);
        } catch (error) {
          const text = error instanceof Error ? error.message : "Failed to submit request action.";
          if (text.toLowerCase().includes("already") || text.toLowerCase().includes("unique")) {
            pushToast("info", `You already sent ${actionType.toLowerCase()} for this request.`);
            return;
          }
          pushToast("error", text);
        } finally {
          setActionLoadingById((prev) => ({ ...prev, [requestId]: false }));
        }
      },
    });
  }

  async function handleToggleActivity(requestId: number) {
    if (expandedActivityId === requestId) {
      setExpandedActivityId(null);
      pushToast("info", "Activity collapsed.");
      return;
    }

    await loadRequestActions(requestId);
    setExpandedActivityId(requestId);
    pushToast("info", "Loaded latest request activity.");
  }

  async function handleConfirmProceed() {
    if (!confirmState) return;
    setConfirmLoading(true);
    await confirmState.onConfirm();
    setConfirmLoading(false);
    setConfirmState(null);
  }

  function logout() {
    clearSession();
    router.push("/auth/signin");
  }

  function urgencyClass(urgency: BloodRequest["urgency"]): "critical" | "high" | "normal" {
    if (urgency === "CRITICAL") return "critical";
    if (urgency === "URGENT") return "high";
    return "normal";
  }

  function requestStatusClass(status: BloodRequest["status"]): "open" | "progress" | "completed" | "closed" {
    if (status === "ACTIVE") return "open";
    if (status === "PARTIAL") return "progress";
    if (status === "FULFILLED") return "completed";
    return "closed";
  }

  function isActionableStatus(status: BloodRequest["status"]): boolean {
    return status === "ACTIVE" || status === "PARTIAL";
  }

  function renderOwnerActionGroup(item: BloodRequest) {
    if (!isActionableStatus(item.status)) {
      return null;
    }

    return (
      <div className="request-action-grid">
        <button
          className="btn btn-success btn-action"
          onClick={() => {
            pushToast("info", "Opening confirmation for fulfilled status...");
            void handleOwnerStatusUpdate(item.id, "FULFILLED");
          }}
        >
          Mark as Fulfilled
        </button>
        <button
          className="btn btn-danger-soft btn-action"
          onClick={() => {
            pushToast("info", "Opening confirmation to close request...");
            void handleOwnerStatusUpdate(item.id, "CLOSED");
          }}
        >
          No Longer Needed / Close
        </button>
      </div>
    );
  }

  function renderNonOwnerActionGroup(item: BloodRequest) {
    if (!isActionableStatus(item.status)) {
      return null;
    }

    return (
      <div className="request-action-grid">
        <button
          className="btn btn-primary btn-action"
          disabled={actionLoadingById[item.id] || item.blood_group_needed !== form.blood_group}
          title={
            item.blood_group_needed !== form.blood_group
              ? `Your group is ${form.blood_group}; request needs ${item.blood_group_needed}`
              : "Volunteer for this request"
          }
          onClick={() => {
            pushToast("info", "Preparing volunteer action...");
            void handleTakeAction(item.id, "VOLUNTEER");
          }}
        >
          {actionLoadingById[item.id] ? "Working..." : "Volunteer to Donate"}
        </button>
        <button
          className="btn btn-action"
          disabled={actionLoadingById[item.id]}
          onClick={() => {
            pushToast("info", "Preparing support/share action...");
            void handleTakeAction(item.id, "SUPPORT");
          }}
        >
          {actionLoadingById[item.id] ? "Working..." : "Support/Share"}
        </button>
        <button
          className="btn btn-subtle btn-action"
          disabled={actionLoadingById[item.id]}
          onClick={() => {
            pushToast("info", "Preparing flag action...");
            void handleTakeAction(item.id, "FLAG");
          }}
        >
          {actionLoadingById[item.id] ? "Working..." : "Flag"}
        </button>
      </div>
    );
  }

  return (
    <RequireRole roles={["DONOR"]}>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <main className="page dashboard-page">
        <header className="dashboard-topbar">
          <div className="container dashboard-topbar-inner">
            <div className="topbar-logo" aria-label="BloodLink Pakistan">
              <div className="topbar-logo-icon" aria-hidden="true">
                <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 4C18 4 6 14 6 22C6 28.627 11.373 34 18 34C24.627 34 30 28.627 30 22C30 14 18 4 18 4Z" fill="#C8102E" />
                  <path d="M18 10C18 10 11 17 11 22C11 25.866 14.134 29 18 29C21.866 29 25 25.866 25 22C25 17 18 10 18 10Z" fill="rgba(255,255,255,0.15)" />
                  <line x1="18" y1="16" x2="18" y2="28" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
                  <line x1="12" y1="22" x2="24" y2="22" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
                </svg>
              </div>
              <span className="topbar-logo-text">BLOOD<span>LINK PK</span></span>
            </div>
            <div className="topbar-spacer" />
            <div className="topbar-right">
              <ThemeToggle />
              <Link href="/dashboard/donor/inbox" className="btn btn-primary">Inbox</Link>
              <button className="btn" onClick={logout}>Logout</button>
            </div>
          </div>
        </header>

        <section className="container hero dashboard-main">
          <div className="dash-top">
            <div>
              <div className="brand">Donor Dashboard</div>
              <h1 className="title dashboard-title">
                Donor <span className="accent">Operations</span>
              </h1>
              <p className="subtitle">Good day, {displayName}. There are {summary?.nearby_open_requests ?? feed.length} open requests near you.</p>
            </div>
            <div className="actions">
              <div className="notice">{displayDate}</div>
              <button className="btn btn-primary" onClick={() => void loadDonorDashboard(token, radiusKm)} disabled={loading}>Refresh</button>
            </div>
          </div>

          <div className="grid kpis section">
            <div className="card"><div className="label">Nearby Open</div><div className="value red">{summary?.nearby_open_requests ?? feed.length}</div></div>
            <div className="card"><div className="label">Total Donations</div><div className="value green">{summary?.total_donations ?? 0}</div></div>
            <div className="card"><div className="label">Days Until Eligible</div><div className="value amber">{summary?.days_until_eligible ?? eligibility?.days_remaining ?? 0}</div></div>
            <div className="card"><div className="label">Lives Impacted</div><div className="value">{summary?.lives_impacted ?? 0}</div></div>
          </div>

          <div className="dashboard-shell section dashboard-spacious">
            <aside className="dashboard-sidebar">
              <div className="sidebar-title">Donor Sections</div>
              <button className={`tab-btn sidebar-tab ${activeTab === "overview" ? "active" : ""}`} onClick={() => changeTab("overview")}>Overview</button>
              <button className={`tab-btn sidebar-tab ${activeTab === "profile" ? "active" : ""}`} onClick={() => changeTab("profile")}>Profile</button>
              <button className={`tab-btn sidebar-tab ${activeTab === "create" ? "active" : ""}`} onClick={() => changeTab("create")}>Make Blood Request</button>
              <button className={`tab-btn sidebar-tab ${activeTab === "requests" ? "active" : ""}`} onClick={() => changeTab("requests")}>All Requests</button>
              <button className={`tab-btn sidebar-tab ${activeTab === "map" ? "active" : ""}`} onClick={() => changeTab("map")}>Map View</button>
            </aside>

            <div className="dashboard-content">
              {message ? <div className="notice">{message}</div> : null}

              {activeTab === "overview" && (
            <div className="split section">
              <div className="panel">
                <div className="panel-head"><div className="panel-title">Overview Stats</div></div>
                <div style={{ padding: 14 }}>
                  <div className="overview-grid">
                    <div className="overview-stat">
                      <div className="overview-stat-label">Eligibility</div>
                      <div className="overview-stat-value">{summary?.is_eligible ? "Ready" : "Waiting"}</div>
                    </div>
                    <div className="overview-stat">
                      <div className="overview-stat-label">Compatible ({form.blood_group})</div>
                      <div className="overview-stat-value">{compatibleRequests.length}</div>
                    </div>
                    <div className="overview-stat">
                      <div className="overview-stat-label">Nearby Open</div>
                      <div className="overview-stat-value">{summary?.nearby_open_requests ?? feed.length}</div>
                    </div>
                    <div className="overview-stat">
                      <div className="overview-stat-label">Resolution Rate</div>
                      <div className="overview-stat-value">{donorRequestStats.resolutionRate}%</div>
                    </div>
                  </div>
                  <div className="overview-meta-row">
                    <span className="badge accepted">Next eligible: {summary?.next_eligible_on || eligibility?.eligible_on || "--"}</span>
                    <span className="badge pending">Days remaining: {summary?.days_until_eligible ?? eligibility?.days_remaining ?? 0}</span>
                  </div>
                </div>
              </div>
              <div className="panel">
                <div className="panel-head"><div className="panel-title">Request Trend</div></div>
                <div style={{ padding: 14 }}>
                  <div className="trend-row">
                    <div className="trend-label">Active</div>
                    <div className="trend-track"><div className="trend-fill trend-fill-active" style={{ width: `${Math.round((donorRequestStats.active / donorRequestStats.denominator) * 100)}%` }} /></div>
                    <div className="trend-value">{donorRequestStats.active}</div>
                  </div>
                  <div className="trend-row">
                    <div className="trend-label">Partial</div>
                    <div className="trend-track"><div className="trend-fill trend-fill-partial" style={{ width: `${Math.round((donorRequestStats.partial / donorRequestStats.denominator) * 100)}%` }} /></div>
                    <div className="trend-value">{donorRequestStats.partial}</div>
                  </div>
                  <div className="trend-row">
                    <div className="trend-label">Fulfilled</div>
                    <div className="trend-track"><div className="trend-fill trend-fill-fulfilled" style={{ width: `${Math.round((donorRequestStats.fulfilled / donorRequestStats.denominator) * 100)}%` }} /></div>
                    <div className="trend-value">{donorRequestStats.fulfilled}</div>
                  </div>
                </div>
              </div>
            </div>
              )}

              {activeTab === "profile" && (
                <div className="dashboard-content">
                  {/* EDIT BUTTON HEADER */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Profile Information</h2>
                    <button 
                      className={`btn ${isProfileEditing ? "btn-danger-soft" : "btn-primary"}`}
                      onClick={() => {
                        if (isProfileEditing) {
                          setIsProfileEditing(false);
                        } else {
                          setIsProfileEditing(true);
                        }
                      }}
                    >
                      {isProfileEditing ? "✕ Cancel Editing" : "✏️ Edit Profile"}
                    </button>
                  </div>

                  {/* PERSONAL INFORMATION SECTION */}
                  <div className="profile-section section">
                    <div className="profile-section-title">Personal Information</div>
                    <form className="form-row form-row-half">
                      <div className="form-group form-group-last">
                        <label className="form-label">Blood Group</label>
                        <select className="select" value={form.blood_group} onChange={(e) => setForm((p) => ({ ...p, blood_group: e.target.value }))} disabled={!isProfileEditing}>
                          {["A+","A-","B+","B-","O+","O-","AB+","AB-"].map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      <div className="form-group form-group-last">
                        <label className="form-label">Date of Birth</label>
                        <input className="input" type="date" max={maxBirthDate} value={form.date_of_birth} onChange={(e) => setForm((p) => ({ ...p, date_of_birth: e.target.value }))} disabled={!isProfileEditing} />
                      </div>
                      <div className="form-group form-group-last">
                        <label className="form-label">Age (years)</label>
                        <input
                          className="input"
                          type="number"
                          min={18}
                          max={100}
                          step={1}
                          value={ageYears}
                          onChange={(e) => {
                            const numeric = e.target.value.replace(/\D/g, "");
                            setAgeYears(numeric);
                            if (!numeric) {
                              return;
                            }
                            const parsedAge = Number(numeric);
                            if (!Number.isInteger(parsedAge) || parsedAge < 18 || parsedAge > 100) {
                              return;
                            }
                            setForm((p) => ({
                              ...p,
                              date_of_birth: deriveDateOfBirthFromAge(parsedAge, p.date_of_birth),
                            }));
                          }}
                          placeholder="28"
                          disabled={!isProfileEditing}
                        />
                      </div>
                      <div className="form-group form-group-last">
                        <label className="form-label">Weight (kg)</label>
                        <input className="input" type="number" min={30} max={300} step={1} value={form.weight_kg} onChange={(e) => setForm((p) => ({ ...p, weight_kg: e.target.value }))} placeholder="60" disabled={!isProfileEditing} />
                      </div>
                      <div className="form-group form-group-last">
                        <label className="form-label">Gender</label>
                        <select className="select" value={form.gender} onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value as DonorForm["gender"] }))} disabled={!isProfileEditing}>
                          <option value="M">Male</option>
                          <option value="F">Female</option>
                          <option value="O">Other</option>
                        </select>
                      </div>
                    </form>

                    <div className="form-group" style={{ marginTop: 18 }}>
                      <label className="toggle-row" style={{ cursor: isProfileEditing ? "pointer" : "default", opacity: isProfileEditing ? 1 : 0.6 }}>
                        <input type="checkbox" checked={form.is_available} onChange={(e) => setForm((p) => ({ ...p, is_available: e.target.checked }))} disabled={!isProfileEditing} />
                        <span>✓ {form.is_available ? "Available to donate" : "Click to mark as available"}</span>
                      </label>
                    </div>
                  </div>

                  {/* LOCATION INFORMATION SECTION */}
                  <div className="profile-section section">
                    <div className="profile-section-title">Location Information</div>
                    
                    <div className="location-picker">
                      <div className="location-buttons">
                        <button className="btn" type="button" onClick={() => void detectLocation(true)} disabled={!isProfileEditing || profileSaving}>
                          📍 Auto Detect Current Location
                        </button>
                      </div>

                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Current Coordinates: <strong>{form.lat || "0"}, {form.lng || "0"}</strong>
                      </div>

                      <div className="form-label" style={{ marginTop: 12, opacity: isProfileEditing ? 1 : 0.6 }}>Enter Location Manually</div>
                      <div className="location-manual-input">
                        <div className="form-group form-group-last">
                          <label className="form-label">Latitude</label>
                          <input className="input" value={form.lat} onChange={(e) => setForm((p) => ({ ...p, lat: e.target.value }))} placeholder="32.085343" disabled={!isProfileEditing} />
                        </div>
                        <div className="form-group form-group-last">
                          <label className="form-label">Longitude</label>
                          <input className="input" value={form.lng} onChange={(e) => setForm((p) => ({ ...p, lng: e.target.value }))} placeholder="72.686143" disabled={!isProfileEditing} />
                        </div>
                      </div>
                    </div>

                    <div className="map-container">
                      <LiveMap
                        center={mapCenter}
                        points={[
                          {
                            id: "donor-profile-location",
                            label: `You (${form.blood_group})`,
                            lat: mapCenter.lat,
                            lng: mapCenter.lng,
                            color: "#0f766e",
                          },
                        ]}
                        height={300}
                        selectedPointId="donor-profile-location"
                        buffers={[
                          {
                            id: "donor-profile-buffer",
                            lat: mapCenter.lat,
                            lng: mapCenter.lng,
                            radiusMeters: mapRadiusMeters,
                            color: "#0f766e",
                            fillOpacity: 0.1,
                            label: `Coverage buffer: ${radiusKm} km`,
                          },
                        ]}
                        draggableCenter
                        onCenterDrag={handleProfileMapDrag}
                      />
                    </div>
                  </div>

                  {/* PASSWORD CHANGE SECTION */}
                  {isProfileEditing && (
                    <div className="password-change-section section">
                      <div className="profile-section-title">Change Password</div>
                      <form className="form-row" onSubmit={(e) => { e.preventDefault(); }}>
                        <div className="form-group form-group-last">
                          <label className="form-label">Current Password</label>
                          <input className="input" type="password" placeholder="Enter your current password" disabled={!isProfileEditing} />
                        </div>
                        <div className="form-group form-group-last">
                          <label className="form-label">New Password</label>
                          <input className="input" type="password" placeholder="Enter new password" disabled={!isProfileEditing} />
                        </div>
                        <div className="form-group form-group-last">
                          <label className="form-label">Confirm New Password</label>
                          <input className="input" type="password" placeholder="Confirm new password" disabled={!isProfileEditing} />
                        </div>
                        <button className="btn btn-danger-soft" type="submit" style={{ width: "fit-content" }} disabled={!isProfileEditing}>Update Password</button>
                      </form>
                    </div>
                  )}

                  {/* SAVE PROFILE SECTION */}
                  {isProfileEditing && (
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
                      <button 
                        className="btn btn-danger-soft"
                        onClick={() => setIsProfileEditing(false)}
                        disabled={profileSaving}
                      >
                        Cancel
                      </button>
                      <button 
                        className="btn btn-primary" 
                        onClick={() => void handleUpdateProfile()}
                        disabled={profileSaving}
                      >
                        {profileSaving ? "💾 Saving..." : "💾 Save Changes"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "create" && (
            <div className="panel section">
              <div className="panel-head"><div className="panel-title">Create Blood Request</div></div>
              <div style={{ padding: 14 }}>
                <form className="form-grid" onSubmit={handleCreateRequest}>
                  <input className="input" placeholder="Patient full name (for identification)" title="Enter the patient full name" value={requestForm.patient_name} required onChange={(e) => setRequestForm((p) => ({ ...p, patient_name: e.target.value }))} />
                  <input className="input" placeholder="Short request description (condition, ward, notes)" value={requestForm.description} onChange={(e) => setRequestForm((p) => ({ ...p, description: e.target.value }))} />
                  <input className="input" type="number" min={0} max={130} step={1} placeholder="Patient age in years" title="Age helps triage and validation" value={requestForm.patient_age} onChange={(e) => setRequestForm((p) => ({ ...p, patient_age: e.target.value }))} />
                  <select className="select" value={requestForm.blood_group_needed} onChange={(e) => setRequestForm((p) => ({ ...p, blood_group_needed: e.target.value }))}>
                    {["A+","A-","B+","B-","O+","O-","AB+","AB-"].map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <input className="input" type="number" min={1} max={20} step={1} placeholder="Units required (for example: 1 or 2)" title="How many blood units are needed" value={requestForm.units_required} onChange={(e) => setRequestForm((p) => ({ ...p, units_required: e.target.value }))} required />
                  <select className="select" value={requestForm.urgency} onChange={(e) => setRequestForm((p) => ({ ...p, urgency: e.target.value as RequestForm["urgency"] }))}>
                    <option value="STANDARD">STANDARD</option>
                    <option value="URGENT">URGENT</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                  <input className="input" type="datetime-local" min={minRequiredByDateTime} title="Deadline for this request" value={requestForm.required_by_datetime} onChange={(e) => setRequestForm((p) => ({ ...p, required_by_datetime: e.target.value }))} required />
                  <select
                    className="select"
                    value={selectedCenterId}
                    onChange={(e) => {
                      const centerId = e.target.value;
                      setSelectedCenterId(centerId);
                      if (!centerId) return;
                      const center = medicalCenters.find((item) => String(item.id) === centerId);
                      if (!center) return;
                      setRequestForm((prev) => ({
                        ...prev,
                        hospital_name: center.name,
                      }));
                      pushToast("info", `Selected ${center.name} (${center.city}). Keeping your current map location.`);
                    }}
                  >
                    <option value="">Select medical center (optional)</option>
                    {medicalCenters.map((center) => (
                      <option key={center.id} value={center.id}>
                        {center.name} - {center.city} ({center.center_type})
                      </option>
                    ))}
                  </select>
                  <input className="input" placeholder="Request center or hospital name" title="Visible to other users on request cards" value={requestForm.hospital_name} onChange={(e) => setRequestForm((p) => ({ ...p, hospital_name: e.target.value }))} required />
                  <input className="input" placeholder="Latitude (auto-filled from location)" title="Geo location latitude" value={requestForm.lat} onChange={(e) => setRequestForm((p) => ({ ...p, lat: e.target.value }))} required />
                  <input className="input" placeholder="Longitude (auto-filled from location)" title="Geo location longitude" value={requestForm.lng} onChange={(e) => setRequestForm((p) => ({ ...p, lng: e.target.value }))} required />
                  <button className="btn btn-primary" type="submit" disabled={requestCreating}>{requestCreating ? "Creating..." : "Create Request"}</button>
                </form>
                {detectedCity ? <div className="notice section">Showing medical centers for your city: {detectedCity}</div> : null}
                <div className="section">
                  <div className="notice">Pick request location from map (click anywhere to set lat/lon).</div>
                  <LiveMap
                    center={requestDraftCenter}
                    points={[
                      {
                        id: "request-draft-location",
                        label: "Request draft location",
                        lat: requestDraftCenter.lat,
                        lng: requestDraftCenter.lng,
                        color: "#dc2626",
                      },
                    ]}
                    height={300}
                    selectedPointId="request-draft-location"
                    onPickLocation={handleRequestMapPick}
                    draggableCenter
                    onCenterDrag={handleRequestMapPick}
                    pickerLabel="Request draft location"
                  />
                </div>
              </div>
            </div>
              )}

              {activeTab === "requests" && (
            <div className="panel section">
              <div className="panel-head"><div className="panel-title">All Available Requests</div></div>
              <div style={{ padding: "10px 12px 0" }} className="notice">
                Volunteer action is optimized for exact blood-group matching to improve response quality.
              </div>
              <div style={{ padding: "8px 12px" }} className="toggle-row">
                <input type="checkbox" checked={sameGroupOnly} onChange={(e) => setSameGroupOnly(e.target.checked)} />
                Show same blood-group requests (plus your own)
              </div>
              <div className="filter-row" style={{ padding: "10px 12px" }}>
                <button className={`chip ${requestFilter === "ALL" ? "active" : ""}`} onClick={() => setRequestFilter("ALL")}>All ({requestRows.length})</button>
                <button className={`chip ${requestFilter === "CRITICAL" ? "active" : ""}`} onClick={() => setRequestFilter("CRITICAL")}>Critical ({requestRows.filter((r) => r.urgency === "CRITICAL").length})</button>
                <button className={`chip ${requestFilter === "URGENT" ? "active" : ""}`} onClick={() => setRequestFilter("URGENT")}>Urgent ({requestRows.filter((r) => r.urgency === "URGENT").length})</button>
                <button className={`chip ${requestFilter === "STANDARD" ? "active" : ""}`} onClick={() => setRequestFilter("STANDARD")}>Standard ({requestRows.filter((r) => r.urgency === "STANDARD").length})</button>
              </div>
              <div className="request-list-cards" style={{ padding: "12px" }}>
                {filteredRequestRows.map((item) => (
                  <div key={item.id} className={`request-item-card ${urgencyClass(item.urgency)}`}>
                    <div className={`req-blood-chip ${urgencyClass(item.urgency)}`}>{item.blood_group_needed}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="req-card-top">
                        <div className="req-name">{item.patient_name}</div>
                        <span className={`req-urg-tag ${urgencyClass(item.urgency)}`}>{item.urgency}</span>
                      </div>
                      <div className="req-meta-line">
                        {item.hospital_name} • {new Date(item.required_by_datetime).toLocaleString()} •
                        <span className={`status-pill ${requestStatusClass(item.status)}`}>{item.status}</span>
                      </div>
                      {item.description ? <div className="req-meta-line">{item.description}</div> : null}
                      <div className="req-meta-line">Units: {item.units_fulfilled}/{item.units_required}</div>
                      <div className="section">
                        {userId === item.requester ? renderOwnerActionGroup(item) : renderNonOwnerActionGroup(item)}
                        {!isActionableStatus(item.status) ? <div className="badge resolved">Resolved • {item.status}</div> : null}
                        <div className="actions compact-actions">
                          <button className="btn btn-action" onClick={() => void handleToggleActivity(item.id)}>
                            {expandedActivityId === item.id ? "Hide Activity" : "View Activity"}
                          </button>
                        </div>
                        {requestActions[item.id]?.length ? (
                          <div className="notice">Actions: {requestActions[item.id].slice(0, 2).map((a) => `${a.actor_role}:${a.action_type}`).join(" | ")}</div>
                        ) : null}
                        <div className="notice">Total activity: {item.actions_count ?? 0}</div>
                        <div className="actions compact-actions">
                          <Link
                            href={`/dashboard/requests/${item.id}`}
                            className="btn btn-primary"
                            onClick={() => pushToast("info", "Opening full activity timeline...")}
                          >
                            View Full Activity
                          </Link>
                        </div>
                        {expandedActivityId === item.id ? (
                          <div className="activity-timeline">
                            {requestActions[item.id]?.length ? (
                              requestActions[item.id].slice(0, 5).map((activity) => (
                                <div key={activity.id} className="activity-item">
                                  {new Date(activity.created_at).toLocaleString()} • {activity.actor_role} • {activity.action_type}
                                  {activity.note ? ` • ${activity.note}` : ""}
                                </div>
                              ))
                            ) : (
                              <div className="activity-item">No activity yet.</div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
                {!filteredRequestRows.length ? <div className="notice">No requests match the selected filter.</div> : null}
              </div>
            </div>
              )}

              {activeTab === "map" && (
            <div className="panel section">
              <div className="panel-head">
                <div className="panel-title">Map and Filters</div>
                <div className="actions">
                  <select className="select" value={mapSource} onChange={(e) => setMapSource(e.target.value as "nearby" | "all")}> 
                    <option value="nearby">Nearby Feed</option>
                    <option value="all">All Requests</option>
                  </select>
                  <select className="select" value={mapBloodGroup} onChange={(e) => setMapBloodGroup(e.target.value)}>
                    <option value="ALL">All Blood Groups</option>
                    {["A+","A-","B+","B-","O+","O-","AB+","AB-"].map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <select className="select" value={mapUrgency} onChange={(e) => setMapUrgency(e.target.value as "ALL" | "STANDARD" | "URGENT" | "CRITICAL")}>
                    <option value="ALL">All Urgency</option>
                    <option value="STANDARD">STANDARD</option>
                    <option value="URGENT">URGENT</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                  <input className="input" type="number" min={1} max={50} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} />
                  <button className="btn btn-primary" onClick={() => void refreshNearbyFeed()} disabled={loading}>Refresh Nearby</button>
                </div>
              </div>
              <div style={{ padding: 12 }}>
                <div className="split">
                  <div className="panel" style={{ maxHeight: 520, overflowY: "auto" }}>
                    <div className="panel-head"><div className="panel-title">Request List</div></div>
                    <div style={{ padding: 10 }}>
                      {filteredMapRequests.map((item) => (
                        <button
                          key={item.id}
                          className={`list-item-btn ${selectedMapRequest?.id === item.id ? "active" : ""}`}
                          onClick={() => setSelectedMapRequestId(item.id)}
                        >
                          <div className="list-item-title">{item.patient_name} • {item.blood_group_needed}</div>
                          <div className="list-item-sub">{item.hospital_name} • {item.urgency} • {item.status}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <LiveMap
                      center={effectiveMapCenter}
                      points={mapPoints}
                      height={520}
                      selectedPointId={selectedMapRequest?.id}
                      onPointClick={(pointId) => setSelectedMapRequestId(Number(pointId))}
                      buffers={[
                        {
                          id: "donor-map-radius",
                          lat: effectiveMapCenter.lat,
                          lng: effectiveMapCenter.lng,
                          radiusMeters: mapRadiusMeters,
                          color: "#0284c7",
                          fillOpacity: 0.08,
                          label: `Map radius: ${radiusKm} km`,
                        },
                      ]}
                    />
                    {selectedMapRequest ? (
                      <div className="panel section" style={{ marginTop: 12 }}>
                        <div className="panel-head"><div className="panel-title">Selected Request Details</div></div>
                        <div style={{ padding: 12 }}>
                          <div className="notice"><strong>Patient:</strong> {selectedMapRequest.patient_name}</div>
                          <div className="notice"><strong>Blood:</strong> {selectedMapRequest.blood_group_needed}</div>
                          {selectedMapRequest.description ? <div className="notice"><strong>Description:</strong> {selectedMapRequest.description}</div> : null}
                          <div className="notice"><strong>Units:</strong> {selectedMapRequest.units_fulfilled}/{selectedMapRequest.units_required}</div>
                          <div className="notice">
                            <strong>Status:</strong>
                            <span className={`status-pill ${requestStatusClass(selectedMapRequest.status)}`}>
                              {selectedMapRequest.status}
                            </span>
                          </div>
                          <div className="notice"><strong>Required By:</strong> {new Date(selectedMapRequest.required_by_datetime).toLocaleString()}</div>
                          <div className="actions compact-actions"><Link href={`/dashboard/requests/${selectedMapRequest.id}`} className="btn btn-primary">View Full Activity</Link></div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="notice">Map shows only your current location.</div>
              </div>
            </div>
              )}

              {loading && busyText ? <div className="notice section">{busyText}</div> : null}
            </div>
          </div>
        </section>
      </main>
      <ConfirmModal
        isOpen={Boolean(confirmState)}
        title={confirmState?.title || "Confirm Action"}
        description={confirmState?.description || "Please confirm this action."}
        confirmLabel={confirmState?.confirmLabel || "Confirm"}
        loading={confirmLoading}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => void handleConfirmProceed()}
      />
      <ConfirmModal
        isOpen={Boolean(successModal)}
        title={successModal?.title || "Success"}
        description={successModal?.description || "Operation completed successfully."}
        confirmLabel="View Requests"
        cancelLabel="Done"
        loading={false}
        onCancel={() => {
          setSuccessModal(null);
          setRequestCreating(false);
        }}
        onConfirm={() => {
          setSuccessModal(null);
          setRequestCreating(false);
          changeTab("requests");
        }}
      />
    </RequireRole>
  );
}
