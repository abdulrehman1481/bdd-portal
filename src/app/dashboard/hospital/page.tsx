"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BloodRequest,
  createRequestAction,
  createRequest,
  getMe,
  getHospitalProfile,
  getRequestActions,
  getHospitalSummary,
  getRadarDonors,
  getRequestPings,
  getRequests,
  HospitalProfile,
  HospitalSummary,
  MedicalCenter,
  getMedicalCenters,
  reverseGeocodeCity,
  pingDonor,
  RadarDonor,
  RequestPingStatus,
  RequestAction,
  RequestActionPayload,
  triggerMatching,
  updateRequestStatus,
  upsertHospitalProfile,
} from "@/lib/api";
import { RequireRole } from "@/components/AuthGuards";
import ConfirmModal from "@/components/ConfirmModal";
import ToastStack from "@/components/ToastStack";
import ThemeToggle from "@/components/ThemeToggle";
import { clearSession, getStoredToken } from "@/lib/session";
import { useToastQueue } from "@/lib/useToastQueue";

const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false });
type HospitalTab = "overview" | "profile" | "create" | "requests" | "map";
type ConfirmState = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
} | null;

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

type ProfileForm = {
  facility_name: string;
  license_number: string;
  nodal_officer_name: string;
  emergency_phone: string;
  lat: string;
  lng: string;
};

const initialRequest: RequestForm = {
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

const initialProfileForm: ProfileForm = {
  facility_name: "",
  license_number: "",
  nodal_officer_name: "",
  emergency_phone: "",
  lat: "",
  lng: "",
};

export default function HospitalDashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<HospitalTab>("overview");
  const [summary, setSummary] = useState<HospitalSummary | null>(null);
  const [displayName, setDisplayName] = useState("Hospital Team");
  const [requestFilter, setRequestFilter] = useState<"ALL" | "CRITICAL" | "URGENT" | "STANDARD">("ALL");
  const [profile, setProfile] = useState<HospitalProfile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>(initialProfileForm);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [donors, setDonors] = useState<RadarDonor[]>([]);
  const [requestForm, setRequestForm] = useState<RequestForm>(initialRequest);
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [radiusKm, setRadiusKm] = useState(5);
  const [showDonors, setShowDonors] = useState(true);
  const [showRequests, setShowRequests] = useState(true);
  const [selectedMapRequestId, setSelectedMapRequestId] = useState<number | null>(null);
  const [pingTargetRequestId, setPingTargetRequestId] = useState<number | null>(null);
  const [requestActions, setRequestActions] = useState<Record<number, RequestAction[]>>({});
  const [pingStatusByRequest, setPingStatusByRequest] = useState<Record<number, RequestPingStatus[]>>({});
  const [autoDetectAttempted, setAutoDetectAttempted] = useState(false);
  const [busyText, setBusyText] = useState("");
  const [message, setMessage] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [actionLoadingById, setActionLoadingById] = useState<Record<number, boolean>>({});
  const [pingingDonorId, setPingingDonorId] = useState<number | null>(null);
  const [expandedActivityId, setExpandedActivityId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [medicalCenters, setMedicalCenters] = useState<MedicalCenter[]>([]);
  const [detectedCity, setDetectedCity] = useState("");
  const [selectedCenterId, setSelectedCenterId] = useState("");
  const { toasts, pushToast, dismissToast } = useToastQueue();

  const myRequests = useMemo(() => requests.filter((item) => item.requester === userId), [requests, userId]);
  const actionableMyRequests = useMemo(
    () => myRequests.filter((item) => isActionableStatus(item.status)),
    [myRequests]
  );
  const filteredRequests = useMemo(() => {
    if (requestFilter === "ALL") return requests;
    return requests.filter((item) => item.urgency === requestFilter);
  }, [requests, requestFilter]);
  const eligibleDonors = useMemo(
    () => donors.filter((item) => item.is_eligible_to_donate !== false),
    [donors]
  );
  const hospitalRequestStats = useMemo(() => {
    const active = requests.filter((r) => r.status === "ACTIVE").length;
    const partial = requests.filter((r) => r.status === "PARTIAL").length;
    const fulfilled = requests.filter((r) => r.status === "FULFILLED").length;
    const closed = requests.filter((r) => r.status === "CLOSED").length;
    const critical = requests.filter((r) => r.urgency === "CRITICAL" && (r.status === "ACTIVE" || r.status === "PARTIAL")).length;
    const expiringSoon = requests.filter((r) => {
      const due = new Date(r.required_by_datetime).getTime();
      return due > Date.now() && due <= Date.now() + 6 * 60 * 60 * 1000 && (r.status === "ACTIVE" || r.status === "PARTIAL");
    }).length;
    const denominator = Math.max(active + partial + fulfilled + closed, 1);
    return {
      active,
      partial,
      fulfilled,
      closed,
      critical,
      expiringSoon,
      denominator,
      fulfillmentRate: Math.round((fulfilled / denominator) * 100),
    };
  }, [requests]);
  const mapRadiusMeters = useMemo(() => Math.max(radiusKm, 1) * 1000, [radiusKm]);

  const mapCenter = useMemo(() => {
    if (profileForm.lat && profileForm.lng) return { lat: Number(profileForm.lat), lng: Number(profileForm.lng) };
    if (requests[0]?.location) return requests[0].location;
    return { lat: 0, lng: 0 };
  }, [profileForm.lat, profileForm.lng, requests]);

  const mapPoints = useMemo(() => {
    return [] as Array<{ id: string | number; label: string; lat: number; lng: number; color: string }>;
  }, []);

  const selectedMapRequest = useMemo(
    () => requests.find((item) => item.id === selectedMapRequestId) || requests[0] || null,
    [requests, selectedMapRequestId]
  );

  // Auto-pan map to selected request location when viewing requests on map
  const effectiveMapCenter = useMemo(() => {
    return mapCenter;
  }, [mapCenter]);
  const requestDraftCenter = useMemo(
    () => ({ lat: Number(requestForm.lat) || mapCenter.lat, lng: Number(requestForm.lng) || mapCenter.lng }),
    [requestForm.lat, requestForm.lng, mapCenter.lat, mapCenter.lng]
  );
  const displayDate = useMemo(
    () => new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    []
  );

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

  function handleMapPointClick(pointId: string | number) {
    if (typeof pointId === "string" && pointId.startsWith("donor-")) {
      return;
    }
    setSelectedMapRequestId(Number(pointId));
  }

  useEffect(() => {
    const activeToken = getStoredToken();
    if (!activeToken) return;

    setToken(activeToken);
    void loadDashboard(activeToken);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    if (tabParam === "overview" || tabParam === "profile" || tabParam === "create" || tabParam === "requests" || tabParam === "map") {
      setActiveTab(tabParam);
    }
  }, []);

  useEffect(() => {
    if (requests.length && !selectedMapRequestId) {
      setSelectedMapRequestId(requests[0].id);
    }
  }, [requests, selectedMapRequestId]);

  useEffect(() => {
    if (!actionableMyRequests.length) {
      setPingTargetRequestId(null);
      return;
    }

    const hasSelected = pingTargetRequestId
      ? actionableMyRequests.some((item) => item.id === pingTargetRequestId)
      : false;
    if (!hasSelected) {
      setPingTargetRequestId(actionableMyRequests[0].id);
    }
  }, [actionableMyRequests, pingTargetRequestId]);

  useEffect(() => {
    if (!token || activeTab !== "requests") return;

    const ownedRequestIds = requests.filter((item) => item.requester === userId).map((item) => item.id);
    if (!ownedRequestIds.length) return;

    const poll = async () => {
      await Promise.all(ownedRequestIds.map((id) => loadRequestPings(id)));
    };

    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [token, activeTab, requests, userId]);

  function changeTab(tab: HospitalTab) {
    setActiveTab(tab);
    router.replace(`/dashboard/hospital?tab=${tab}`);
  }

  useEffect(() => {
    if (autoDetectAttempted) return;
    if (Number(profileForm.lat) !== 0 || Number(profileForm.lng) !== 0) return;

    setAutoDetectAttempted(true);
    void detectLocation(true);
  }, [autoDetectAttempted, profileForm.lat, profileForm.lng]);

  async function loadDashboard(activeToken: string) {
    setLoading(true);
    setBusyText("Loading dashboard data...");
    setMessage("");

    try {
      const [summaryData, requestData, profile] = await Promise.allSettled([
        getHospitalSummary(activeToken),
        getRequests(activeToken, { includeHistory: true }),
        getHospitalProfile(activeToken),
      ]);

      const me = await getMe(activeToken);
      setUserId(me.id);
      setDisplayName(me.first_name || me.email.split("@")[0]);

      if (summaryData.status === "fulfilled") {
        setSummary(summaryData.value);
      }
      if (requestData.status === "fulfilled") {
        setRequests(requestData.value);
      }
      if (profile.status === "fulfilled") {
        const profileData = profile.value;
        setProfile(profileData);

        let resolvedLat = Number(profileData.location?.lat);
        let resolvedLng = Number(profileData.location?.lng);
        const browserLoc = await getBrowserLocationCoords();
        if (browserLoc) {
          resolvedLat = browserLoc.lat;
          resolvedLng = browserLoc.lng;

          const profileLat = Number(profileData.location?.lat);
          const profileLng = Number(profileData.location?.lng);
          const profileNeedsSync =
            !Number.isFinite(profileLat) ||
            !Number.isFinite(profileLng) ||
            profileLat === 0 ||
            profileLng === 0 ||
            Math.abs(profileLat - browserLoc.lat) > 0.0003 ||
            Math.abs(profileLng - browserLoc.lng) > 0.0003;

          if (profileNeedsSync) {
            await upsertHospitalProfile(activeToken, {
              location: { lat: resolvedLat, lng: resolvedLng },
            });
          }
        }

        const hasResolvedLocation =
          Number.isFinite(resolvedLat) && Number.isFinite(resolvedLng) && !(resolvedLat === 0 && resolvedLng === 0);

        setProfileForm((prev) => ({
          facility_name: profileData.facility_name || "",
          license_number: profileData.license_number || "",
          nodal_officer_name: profileData.nodal_officer_name || "",
          emergency_phone: profileData.emergency_phone || "",
          lat: hasResolvedLocation ? String(resolvedLat) : prev.lat,
          lng: hasResolvedLocation ? String(resolvedLng) : prev.lng,
        }));

        setRequestForm((prev) => ({
          ...prev,
          hospital_name: profileData.facility_name || prev.hospital_name || "Hospital",
          lat: hasResolvedLocation ? String(resolvedLat) : prev.lat,
          lng: hasResolvedLocation ? String(resolvedLng) : prev.lng,
        }));

        if (!profileData.is_verified_by_admin) {
          setMessage("Hospital account is not yet admin-verified. You can still test dashboard and requests for now.");
        }

        if (hasResolvedLocation) {
          try {
            const radar = await getRadarDonors(
              activeToken,
              bloodGroup,
              radiusKm,
              resolvedLat,
              resolvedLng
            );
            setDonors(radar);
          } catch {
            setDonors([]);
          }

          const userCity = await reverseGeocodeCity(resolvedLat, resolvedLng);
          const resolvedCity = (userCity || "").trim();

          if (resolvedCity) {
            try {
              const strictCenters = await getMedicalCenters(activeToken, {
                centerType: "HOSPITAL",
                city: resolvedCity,
                strictCity: true,
              });
              const strictItems = strictCenters.items.filter((item) => cityMatches(item.city || "", resolvedCity));

              if (strictItems.length) {
                setMedicalCenters(strictItems);
                setDetectedCity(resolvedCity);
              } else {
                const relaxedCenters = await getMedicalCenters(activeToken, {
                  centerType: "HOSPITAL",
                  city: resolvedCity,
                });
                const relaxedItems = relaxedCenters.items.filter((item) => cityMatches(item.city || "", resolvedCity));
                setMedicalCenters(relaxedItems);
                setDetectedCity(resolvedCity);
              }
            } catch {
              setMedicalCenters([]);
              setDetectedCity(resolvedCity);
            }
          } else {
            setMedicalCenters([]);
            setDetectedCity("");
          }
        } else {
          setDonors([]);
          setMedicalCenters([]);
          setDetectedCity("");
        }
      }
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
      setBusyText("");
    }
  }

  async function loadRequestActions(requestId: number) {
    if (!token) return;

    try {
      const actions = await getRequestActions(token, requestId);
      setRequestActions((prev) => ({ ...prev, [requestId]: actions }));
    } catch {
      // Keep request list usable even if action history is unavailable.
    }
  }

  async function loadRequestPings(requestId: number) {
    if (!token) return;

    try {
      const pingRows = await getRequestPings(token, requestId);
      setPingStatusByRequest((prev) => ({ ...prev, [requestId]: pingRows }));
    } catch {
      // Keep request flow active even if ping status fetch fails.
    }
  }

  async function detectLocation(saveAfterDetect = false) {
    if (!navigator.geolocation) {
      setMessage("Geolocation is not supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        setProfileForm((prev) => ({ ...prev, lat, lng }));
        setRequestForm((prev) => ({
          ...prev,
          hospital_name: prev.hospital_name || profileForm.facility_name || "Hospital",
          lat,
          lng,
        }));

        if (saveAfterDetect && token) {
          try {
            await upsertHospitalProfile(token, {
              location: { lat: Number(lat), lng: Number(lng) },
            });
            pushToast("success", "Location auto-detected and saved.");
          } catch {
            pushToast("info", "Location detected. Please save profile to persist it.");
          }
          return;
        }

        pushToast("success", "Location auto-detected. Save profile to persist it.");
      },
      (error) => {
        const reason = error.code === error.PERMISSION_DENIED
          ? "Location permission denied."
          : error.code === error.POSITION_UNAVAILABLE
            ? "Location is unavailable."
            : "Location request timed out.";
        pushToast("error", `${reason} ${geolocationBlockedHint()}`.trim());
      }
    );
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
    setProfileForm((prev) => ({ ...prev, lat: nextLat, lng: nextLng }));
    pushToast("info", `Profile location dragged to ${nextLat}, ${nextLng}.`);
  }

  async function handlePingDonor(donorId: number, donorName: string) {
    if (!token) {
      pushToast("error", "Session token missing. Please sign in again.");
      return;
    }

    const targetRequest = actionableMyRequests.find((item) => item.id === pingTargetRequestId);
    if (!targetRequest) {
      pushToast("info", "Create or select one of your active requests before pinging donors.");
      return;
    }

    setConfirmState({
      title: "Confirm Donor Ping",
      description: `Send ping to ${donorName} for request #${targetRequest.id} (${targetRequest.patient_name})?`,
      confirmLabel: "Send Ping",
      onConfirm: async () => {
        try {
          setPingingDonorId(donorId);
          const result = await pingDonor(token, donorId, { request_id: targetRequest.id });
          pushToast("success", `${result.detail} (${donorName})`);
          pushToast(
            "info",
            `Ping #${result.ping_id ?? "-"} delivered to donor user #${result.donor_user_id ?? "-"}. Waiting for response.`
          );
          await loadRequestPings(targetRequest.id);
          setExpandedActivityId(targetRequest.id);
        } catch (error) {
          pushToast("error", error instanceof Error ? error.message : "Failed to ping donor.");
        } finally {
          setPingingDonorId(null);
        }
      },
    });
  }

  async function handleSaveProfile(event?: FormEvent) {
    if (event) {
      event.preventDefault();
    }
    if (!token) return;

    // Validate location
    const lat = Number(profileForm.lat);
    const lng = Number(profileForm.lng);
    
    if (!profileForm.lat.trim() || !profileForm.lng.trim()) {
      pushToast("error", "Location is required. Please use Auto-detect or drag the map marker.");
      return;
    }
    
    if (isNaN(lat) || isNaN(lng)) {
      pushToast("error", "Invalid location coordinates. Please detect your location again.");
      return;
    }
    
    // Check for invalid (0,0) location
    if (lat === 0 && lng === 0) {
      pushToast("error", "Please set a valid location. The (0,0) coordinates are not allowed. Use Auto-detect or drag the map marker.");
      return;
    }
    
    // Validate latitude/longitude ranges
    if (lat < -90 || lat > 90) {
      pushToast("error", "Invalid latitude. Must be between -90 and 90.");
      return;
    }
    
    if (lng < -180 || lng > 180) {
      pushToast("error", "Invalid longitude. Must be between -180 and 180.");
      return;
    }

    setLoading(true);
    setBusyText("Saving hospital profile...");
    setMessage("");

    try {
      await upsertHospitalProfile(token, {
        facility_name: profileForm.facility_name,
        license_number: profileForm.license_number,
        nodal_officer_name: profileForm.nodal_officer_name,
        emergency_phone: profileForm.emergency_phone,
        location: { lat, lng },
      });
      pushToast("success", "Hospital profile updated successfully.");
      await loadDashboard(token);
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Failed to update profile.");
    } finally {
      setLoading(false);
      setBusyText("");
    }
  }

  async function handleCreateRequest(event: FormEvent) {
    event.preventDefault();
    if (!token) return;

    // Validate required fields
    if (!requestForm.patient_name.trim()) {
      pushToast("info", "Patient name is required.");
      return;
    }

    const hospitalName = requestForm.hospital_name.trim() || profileForm.facility_name.trim() || "Hospital";

    if (!requestForm.required_by_datetime) {
      pushToast("info", "Please provide required by date and time.");
      return;
    }

    // Validate location (with fallback to current browser location)
    let lat = Number(requestForm.lat);
    let lng = Number(requestForm.lng);
    
    if (!requestForm.lat.trim() || !requestForm.lng.trim() || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
      const browserLoc = await getBrowserLocationCoords();
      if (browserLoc) {
        lat = browserLoc.lat;
        lng = browserLoc.lng;
        setProfileForm((prev) => ({ ...prev, lat: String(lat), lng: String(lng) }));
        setRequestForm((prev) => ({
          ...prev,
          hospital_name: hospitalName,
          lat: String(lat),
          lng: String(lng),
        }));
      }
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      pushToast("error", "Invalid location coordinates. Please detect your location again.");
      return;
    }
    
    // Check for invalid (0,0) location
    if (lat === 0 && lng === 0) {
      pushToast("error", "Please set a valid location. The (0,0) coordinates are invalid. Use Auto-detect or drag the map marker.");
      return;
    }
    
    // Validate latitude/longitude ranges
    if (lat < -90 || lat > 90) {
      pushToast("error", "Invalid latitude. Must be between -90 and 90.");
      return;
    }
    
    if (lng < -180 || lng > 180) {
      pushToast("error", "Invalid longitude. Must be between -180 and 180.");
      return;
    }

    const requiredByDate = new Date(requestForm.required_by_datetime);
    if (Number.isNaN(requiredByDate.getTime())) {
      pushToast("error", "Invalid required-by date/time.");
      return;
    }
    if (requiredByDate.getTime() <= Date.now()) {
      pushToast("error", "Required-by date/time must be in the future.");
      return;
    }
    const requiredByIso = requiredByDate.toISOString();

    setLoading(true);
    setBusyText("Creating blood request...");
    setMessage("");

    try {
      // Update hospital profile with the request location
      await upsertHospitalProfile(token, {
        facility_name: profileForm.facility_name || hospitalName,
        nodal_officer_name: profileForm.nodal_officer_name,
        emergency_phone: profileForm.emergency_phone,
        location: { lat, lng },
      });

      // Create the blood request with validated location
      await createRequest(token, {
        patient_name: requestForm.patient_name.trim(),
        description: requestForm.description,
        patient_age: requestForm.patient_age ? Number(requestForm.patient_age) : undefined,
        blood_group_needed: requestForm.blood_group_needed,
        units_required: Number(requestForm.units_required),
        urgency: requestForm.urgency,
        required_by_datetime: requiredByIso,
        hospital_name: hospitalName,
        location: { lat, lng },
      });

      pushToast("success", "Blood request created successfully.");
      changeTab("requests");
      await loadDashboard(token);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to create request.";
      if (msg.includes("location") || msg.includes("lat") || msg.includes("lng")) {
        pushToast("error", "Could not use your location for request creation. Please click Auto Detect Location and try again.");
      } else {
        pushToast("error", msg);
      }
    } finally {
      setLoading(false);
      setBusyText("");
    }
  }

  async function handleRunRadar() {
    if (!token) return;
    setLoading(true);
    setBusyText("Running donor radar...");
    setMessage("");

    try {
      const radar = await getRadarDonors(token, bloodGroup, radiusKm, Number(requestForm.lat), Number(requestForm.lng));
      setDonors(radar);
      pushToast("success", `Found ${radar.length} eligible donors.`);
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Failed to run radar.");
    } finally {
      setLoading(false);
      setBusyText("");
    }
  }

  async function handleTriggerMatching(requestId: number) {
    if (!token) return;

    try {
      setLoading(true);
      setBusyText("Triggering donor matching...");
      const result = await triggerMatching(token, requestId);
      pushToast("success", result.detail);
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Failed to trigger matching.");
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
          await loadDashboard(token);
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
            note: actionType === "FLAG" ? "Flagged for follow-up" : "Hospital support response",
          });
          pushToast("success", `Action submitted: ${actionType}.`);
          await loadDashboard(token);
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
    await loadRequestPings(requestId);
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
          disabled={actionLoadingById[item.id]}
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
    <RequireRole roles={["HOSPITAL"]}>
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
              <button className="btn" onClick={logout}>Logout</button>
            </div>
          </div>
        </header>

        <section className="container hero dashboard-main">
          <div className="dash-top">
            <div>
              <div className="brand">Hospital Dashboard</div>
              <h1 className="title dashboard-title">
                Command <span className="accent">Center</span>
              </h1>
              <p className="subtitle">Welcome, {displayName}. Manage profile settings, monitor requests, and run donor radar with better visibility.</p>
            </div>
            <div className="actions">
              <div className="notice">{displayDate}</div>
              <button className="btn btn-primary" onClick={() => void loadDashboard(token)} disabled={loading}>Refresh</button>
            </div>
          </div>

          <div className="grid kpis section">
            <div className="card"><div className="label">Critical Open</div><div className="value red">{summary?.critical_open ?? 0}</div></div>
            <div className="card"><div className="label">Active Requests</div><div className="value amber">{summary?.active_requests ?? 0}</div></div>
            <div className="card"><div className="label">Fulfilled</div><div className="value green">{summary?.fulfilled_requests ?? 0}</div></div>
            <div className="card"><div className="label">Eligible Matches</div><div className="value">{eligibleDonors.length}</div></div>
          </div>

          <div className="dashboard-shell section dashboard-spacious">
            <aside className="dashboard-sidebar">
              <div className="sidebar-title">Hospital Sections</div>
              <button className={`tab-btn sidebar-tab ${activeTab === "overview" ? "active" : ""}`} onClick={() => changeTab("overview")}>Overview</button>
              <button className={`tab-btn sidebar-tab ${activeTab === "profile" ? "active" : ""}`} onClick={() => changeTab("profile")}>Profile</button>
              <button className={`tab-btn sidebar-tab ${activeTab === "create" ? "active" : ""}`} onClick={() => changeTab("create")}>Make Blood Request</button>
              <button className={`tab-btn sidebar-tab ${activeTab === "requests" ? "active" : ""}`} onClick={() => changeTab("requests")}>All Requests</button>
              <Link href="/dashboard/hospital/pings" className="tab-btn sidebar-tab">Manage Pings</Link>
              <button className={`tab-btn sidebar-tab ${activeTab === "map" ? "active" : ""}`} onClick={() => changeTab("map")}>Map and Radar</button>
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
                      <div className="overview-stat-label">Your Requests</div>
                      <div className="overview-stat-value">{myRequests.length}</div>
                    </div>
                    <div className="overview-stat">
                      <div className="overview-stat-label">Network Requests</div>
                      <div className="overview-stat-value">{requests.length}</div>
                    </div>
                    <div className="overview-stat">
                      <div className="overview-stat-label">Eligible Matches</div>
                      <div className="overview-stat-value">{eligibleDonors.length}</div>
                    </div>
                    <div className="overview-stat">
                      <div className="overview-stat-label">Fulfillment Rate</div>
                      <div className="overview-stat-value">{hospitalRequestStats.fulfillmentRate}%</div>
                    </div>
                  </div>
                  <div className="overview-meta-row">
                    <span className="badge critical">Critical Open: {summary?.critical_open ?? hospitalRequestStats.critical}</span>
                    <span className="badge pending">Expiring ≤ 6h: {summary?.expiring_within_6h ?? hospitalRequestStats.expiringSoon}</span>
                  </div>
                </div>
              </div>
              <div className="panel">
                <div className="panel-head"><div className="panel-title">Request Trend</div></div>
                <div style={{ padding: 14 }}>
                  <div className="trend-row">
                    <div className="trend-label">Active</div>
                    <div className="trend-track"><div className="trend-fill trend-fill-active" style={{ width: `${Math.round((hospitalRequestStats.active / hospitalRequestStats.denominator) * 100)}%` }} /></div>
                    <div className="trend-value">{hospitalRequestStats.active}</div>
                  </div>
                  <div className="trend-row">
                    <div className="trend-label">Partial</div>
                    <div className="trend-track"><div className="trend-fill trend-fill-partial" style={{ width: `${Math.round((hospitalRequestStats.partial / hospitalRequestStats.denominator) * 100)}%` }} /></div>
                    <div className="trend-value">{hospitalRequestStats.partial}</div>
                  </div>
                  <div className="trend-row">
                    <div className="trend-label">Fulfilled</div>
                    <div className="trend-track"><div className="trend-fill trend-fill-fulfilled" style={{ width: `${Math.round((hospitalRequestStats.fulfilled / hospitalRequestStats.denominator) * 100)}%` }} /></div>
                    <div className="trend-value">{hospitalRequestStats.fulfilled}</div>
                  </div>
                </div>
              </div>
            </div>
              )}

              {activeTab === "profile" && (
                <div className="dashboard-content">
                  <div className="profile-section section">
                    <div className="profile-section-title">Hospital Information</div>
                    <form className="form-row form-row-half" onSubmit={handleSaveProfile}>
                      <div className="form-group form-group-last">
                        <label className="form-label">Facility Name</label>
                        <input className="input" value={profileForm.facility_name} onChange={(e) => setProfileForm((p) => ({ ...p, facility_name: e.target.value }))} required />
                      </div>
                      <div className="form-group form-group-last">
                        <label className="form-label">License Number</label>
                        <input className="input" value={profileForm.license_number} onChange={(e) => setProfileForm((p) => ({ ...p, license_number: e.target.value }))} required />
                      </div>
                      <div className="form-group form-group-last">
                        <label className="form-label">Nodal Officer Name</label>
                        <input className="input" value={profileForm.nodal_officer_name} onChange={(e) => setProfileForm((p) => ({ ...p, nodal_officer_name: e.target.value }))} required />
                      </div>
                      <div className="form-group form-group-last">
                        <label className="form-label">Emergency Phone</label>
                        <input className="input" value={profileForm.emergency_phone} onChange={(e) => setProfileForm((p) => ({ ...p, emergency_phone: e.target.value }))} required />
                      </div>
                      <div className="form-group form-group-last">
                        <label className="form-label">Verification Status</label>
                        <div className={`badge ${profile?.is_verified_by_admin ? "accepted" : "pending"}`}>
                          {profile?.is_verified_by_admin ? "Verified" : "Pending Verification"}
                        </div>
                      </div>
                      <div className="form-group form-group-last">
                        <label className="form-label">Detected City</label>
                        <div className="notice" style={{ margin: 0 }}>
                          {detectedCity || "Not detected yet"}
                        </div>
                      </div>
                    </form>
                  </div>

                  <div className="profile-section section">
                    <div className="profile-section-title">Location Information</div>
                    <div className="location-picker">
                      <div className="location-buttons">
                        <button className="btn" type="button" onClick={() => void detectLocation()} disabled={loading}>Auto Detect Current Location</button>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Current Coordinates: <strong>{profileForm.lat || "0"}, {profileForm.lng || "0"}</strong>
                      </div>
                      <div className="location-manual-input">
                        <div className="form-group form-group-last">
                          <label className="form-label">Latitude</label>
                          <input className="input" value={profileForm.lat} onChange={(e) => setProfileForm((p) => ({ ...p, lat: e.target.value }))} required />
                        </div>
                        <div className="form-group form-group-last">
                          <label className="form-label">Longitude</label>
                          <input className="input" value={profileForm.lng} onChange={(e) => setProfileForm((p) => ({ ...p, lng: e.target.value }))} required />
                        </div>
                      </div>
                    </div>
                    <div className="map-container">
                      <LiveMap
                        center={mapCenter}
                        points={[
                          {
                            id: "hospital-profile-location",
                            label: profileForm.facility_name || "Hospital location",
                            lat: mapCenter.lat,
                            lng: mapCenter.lng,
                            color: "#dc2626",
                          },
                        ]}
                        height={320}
                        selectedPointId="hospital-profile-location"
                        buffers={[
                          {
                            id: "hospital-profile-buffer",
                            lat: mapCenter.lat,
                            lng: mapCenter.lng,
                            radiusMeters: mapRadiusMeters,
                            color: "#dc2626",
                            fillOpacity: 0.1,
                            label: `Operational radius: ${radiusKm} km`,
                          },
                        ]}
                        draggableCenter
                        onCenterDrag={handleProfileMapDrag}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                      <button className="btn btn-primary" type="button" onClick={() => void handleSaveProfile()} disabled={loading}>
                        {loading ? "Saving..." : "Save Profile"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "create" && (
            <div className="panel section">
              <div className="panel-head"><div className="panel-title">Create Blood Request</div></div>
              <div style={{ padding: 14 }}>
                <form className="form-grid" onSubmit={handleCreateRequest}>
                  <input className="input" placeholder="Patient full name (for identification)" title="Enter patient full name" value={requestForm.patient_name} onChange={(e) => setRequestForm((p) => ({ ...p, patient_name: e.target.value }))} required />
                  <input className="input" placeholder="Short request description (condition, ward, notes)" value={requestForm.description} onChange={(e) => setRequestForm((p) => ({ ...p, description: e.target.value }))} />
                  <input className="input" placeholder="Patient age in years" title="Age helps medical triage" value={requestForm.patient_age} onChange={(e) => setRequestForm((p) => ({ ...p, patient_age: e.target.value }))} />
                  <select className="select" value={requestForm.blood_group_needed} onChange={(e) => setRequestForm((p) => ({ ...p, blood_group_needed: e.target.value }))}>
                    {["A+","A-","B+","B-","O+","O-","AB+","AB-"].map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <input className="input" placeholder="Units required (for example: 1 or 2)" title="How many units are needed" value={requestForm.units_required} onChange={(e) => setRequestForm((p) => ({ ...p, units_required: e.target.value }))} required />
                  <select className="select" value={requestForm.urgency} onChange={(e) => setRequestForm((p) => ({ ...p, urgency: e.target.value as RequestForm["urgency"] }))}>
                    <option value="STANDARD">STANDARD</option>
                    <option value="URGENT">URGENT</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                  <input className="input" type="datetime-local" title="Deadline for this blood request" value={requestForm.required_by_datetime} onChange={(e) => setRequestForm((p) => ({ ...p, required_by_datetime: e.target.value }))} required />
                  <input
                    className="input"
                    placeholder="Hospital/facility name shown to users"
                    title="Auto-filled from your profile facility name"
                    value={requestForm.hospital_name || profileForm.facility_name || "Hospital"}
                    readOnly
                    required
                  />
                  <input
                    className="input"
                    placeholder="Latitude (auto-filled from your current location)"
                    title="Auto-filled from current user location"
                    value={requestForm.lat}
                    readOnly
                    required
                  />
                  <input
                    className="input"
                    placeholder="Longitude (auto-filled from your current location)"
                    title="Auto-filled from current user location"
                    value={requestForm.lng}
                    readOnly
                    required
                  />
                  <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Working..." : "Create Request"}</button>
                </form>
                {detectedCity ? <div className="notice section">Detected city: {detectedCity}. Request uses your current location.</div> : null}
                <div className="section">
                  <div className="notice">Pick request location from map (click anywhere to set lat/lon).</div>
                  <LiveMap
                    center={requestDraftCenter}
                    points={[
                      {
                        id: "hospital-request-draft-location",
                        label: "Request draft location",
                        lat: requestDraftCenter.lat,
                        lng: requestDraftCenter.lng,
                        color: "#dc2626",
                      },
                    ]}
                    height={300}
                    selectedPointId="hospital-request-draft-location"
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
              <div className="panel-head"><div className="panel-title">All Requests</div></div>
              <div style={{ padding: "10px 12px 0" }} className="notice">
                Review all requests, load recent activity, and open full timeline details for each item.
              </div>
              <div className="filter-row" style={{ padding: "10px 12px" }}>
                <button className={`chip ${requestFilter === "ALL" ? "active" : ""}`} onClick={() => setRequestFilter("ALL")}>All ({requests.length})</button>
                <button className={`chip ${requestFilter === "CRITICAL" ? "active" : ""}`} onClick={() => setRequestFilter("CRITICAL")}>Critical ({requests.filter((r) => r.urgency === "CRITICAL").length})</button>
                <button className={`chip ${requestFilter === "URGENT" ? "active" : ""}`} onClick={() => setRequestFilter("URGENT")}>Urgent ({requests.filter((r) => r.urgency === "URGENT").length})</button>
                <button className={`chip ${requestFilter === "STANDARD" ? "active" : ""}`} onClick={() => setRequestFilter("STANDARD")}>Standard ({requests.filter((r) => r.urgency === "STANDARD").length})</button>
              </div>
              <div className="request-list-cards" style={{ padding: "12px" }}>
                {filteredRequests.map((item) => (
                  <div key={item.id} className={`request-item-card ${urgencyClass(item.urgency)}`}>
                    <div className={`req-blood-chip ${urgencyClass(item.urgency)}`}>{item.blood_group_needed}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="req-card-top">
                        <div className="req-name">{item.patient_name}</div>
                        <span className={`req-urg-tag ${urgencyClass(item.urgency)}`}>{item.urgency}</span>
                      </div>
                      <div className="req-meta-line">
                        {item.hospital_name} •
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
                          {userId === item.requester && isActionableStatus(item.status) ? (
                            <button
                              className="btn btn-action"
                              onClick={() => {
                                pushToast("info", "Triggering matching for this request...");
                                void handleTriggerMatching(item.id);
                              }}
                            >
                              Ping Donors
                            </button>
                          ) : null}
                        </div>
                        {requestActions[item.id]?.length ? (
                          <div className="notice">Actions: {requestActions[item.id].slice(0, 2).map((a) => `${a.actor_role}:${a.action_type}`).join(" | ")}</div>
                        ) : null}
                        {item.requester === userId ? (
                          <div className="notice">
                            Ping Responses: Pending {pingStatusByRequest[item.id]?.filter((p) => p.response_status === "PENDING").length ?? 0}
                            , Accepted {pingStatusByRequest[item.id]?.filter((p) => p.response_status === "ACCEPTED").length ?? 0}
                            , Declined {pingStatusByRequest[item.id]?.filter((p) => p.response_status === "DECLINED").length ?? 0}
                          </div>
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
                            {item.requester === userId && pingStatusByRequest[item.id]?.length ? (
                              pingStatusByRequest[item.id].slice(0, 5).map((ping) => (
                                <div key={ping.id} className="activity-item">
                                  Ping • {ping.donor_name} ({ping.blood_group}) • {ping.response_status}
                                  {ping.response_note ? ` • ${ping.response_note}` : ""}
                                </div>
                              ))
                            ) : null}
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
                {!filteredRequests.length ? <div className="notice">No requests match the selected filter.</div> : null}
              </div>
            </div>
              )}

              {activeTab === "map" && (
            <div className="panel section">
              <div className="panel-head">
                <div className="panel-title">Map and Donor Radar</div>
                <div className="actions">
                  <select className="select" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                    {["A+","A-","B+","B-","O+","O-","AB+","AB-"].map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <input className="input" type="number" min={1} max={50} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} />
                  <button className="btn btn-primary" onClick={handleRunRadar} disabled={loading}>Run Radar</button>
                </div>
              </div>
              <div style={{ padding: 12 }}>
                <div className="actions compact-actions" style={{ marginBottom: 12 }}>
                  <label className="toggle-row">
                    <input type="checkbox" checked={showRequests} onChange={(e) => setShowRequests(e.target.checked)} />
                    Show Requests
                  </label>
                  <label className="toggle-row">
                    <input type="checkbox" checked={showDonors} onChange={(e) => setShowDonors(e.target.checked)} />
                    Show Eligible Donors (names only)
                  </label>
                </div>
                <div className="split">
                  <div className="panel" style={{ maxHeight: 520, overflowY: "auto" }}>
                    <div className="panel-head"><div className="panel-title">Request List</div></div>
                    <div style={{ padding: 10 }}>
                      {requests.map((item) => (
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
                      onPointClick={handleMapPointClick}
                      buffers={[
                        {
                          id: "hospital-map-radius",
                          lat: effectiveMapCenter.lat,
                          lng: effectiveMapCenter.lng,
                          radiusMeters: mapRadiusMeters,
                          color: "#dc2626",
                          fillOpacity: 0.08,
                          label: `Radar radius: ${radiusKm} km`,
                        },
                      ]}
                      autoPanToSelected
                    />
                    {selectedMapRequest ? (
                      <div className="panel section" style={{ marginTop: 12 }}>
                        <div className="panel-head"><div className="panel-title">Selected Request Details</div></div>
                        <div style={{ padding: 12 }}>
                          <div className="notice"><strong>Patient:</strong> {selectedMapRequest.patient_name}</div>
                          <div className="notice"><strong>Blood:</strong> {selectedMapRequest.blood_group_needed}</div>
                          {selectedMapRequest.description ? <div className="notice"><strong>Description:</strong> {selectedMapRequest.description}</div> : null}
                          <div className="notice"><strong>Units:</strong> {selectedMapRequest.units_fulfilled}/{selectedMapRequest.units_required}</div>
                          <div className="notice"><strong>Status:</strong> {selectedMapRequest.status}</div>
                          <div className="notice"><strong>Required By:</strong> {new Date(selectedMapRequest.required_by_datetime).toLocaleString()}</div>
                          <div className="actions compact-actions"><Link href={`/dashboard/requests/${selectedMapRequest.id}`} className="btn btn-primary">View Full Activity</Link></div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                {showDonors ? (
                  <div className="panel section" style={{ marginTop: 12 }}>
                    <div className="panel-head"><div className="panel-title">Eligible Donors in Radar</div></div>
                    <div style={{ padding: 12 }}>
                      <div className="notice" style={{ marginBottom: 10 }}>
                        <strong>Ping Request:</strong>{" "}
                        {actionableMyRequests.length ? (
                          <select
                            className="select"
                            value={pingTargetRequestId ?? ""}
                            onChange={(e) => setPingTargetRequestId(Number(e.target.value))}
                            style={{ marginLeft: 8, minWidth: 280 }}
                          >
                            {actionableMyRequests.map((requestItem) => (
                              <option key={requestItem.id} value={requestItem.id}>
                                #{requestItem.id} - {requestItem.patient_name} ({requestItem.blood_group_needed})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span>No active hospital request available.</span>
                        )}
                      </div>
                      {eligibleDonors.length ? (
                        eligibleDonors.slice(0, 8).map((donor) => (
                          <div key={donor.id} className="notice">
                            {donor.display_name} • {donor.blood_group} • {donor.distance_km} km away • user #{donor.donor_user_id} • {donor.donor_email}
                            <button
                              className="btn btn-action"
                              style={{ marginLeft: 8 }}
                              disabled={pingingDonorId === donor.id}
                              onClick={() => void handlePingDonor(donor.id, donor.display_name)}
                            >
                              {pingingDonorId === donor.id ? "Pinging..." : "Ping on App"}
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="notice">No eligible donors found for current blood group and radius.</div>
                      )}
                    </div>
                  </div>
                ) : null}
                <div className="notice">Map shows only your current location. Eligible donors matched in last radar run: {eligibleDonors.length}.</div>
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
    </RequireRole>
  );
}
