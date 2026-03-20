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
  const mapRadiusMeters = useMemo(() => Math.max(radiusKm, 1) * 1000, [radiusKm]);

  const mapCenter = useMemo(() => {
    if (profileForm.lat && profileForm.lng) return { lat: Number(profileForm.lat), lng: Number(profileForm.lng) };
    if (requests[0]?.location) return requests[0].location;
    return { lat: 0, lng: 0 };
  }, [profileForm.lat, profileForm.lng, requests]);

  const mapPoints = useMemo(() => {
    const requestPoints = showRequests ? requests.map((item) => ({
      id: item.id,
      label: `${item.patient_name} (${item.blood_group_needed})`,
      lat: item.location.lat,
      lng: item.location.lng,
      color: "#e83b55",
    })) : [];

    const donorPoints: Array<{ id: string | number; label: string; lat: number; lng: number; color: string }> = [];

    return [...requestPoints, ...donorPoints];
  }, [requests, eligibleDonors, showDonors, showRequests]);

  const selectedMapRequest = useMemo(
    () => requests.find((item) => item.id === selectedMapRequestId) || requests[0] || null,
    [requests, selectedMapRequestId]
  );

  // Auto-pan map to selected request location when viewing requests on map
  const effectiveMapCenter = useMemo(() => {
    if (showRequests && selectedMapRequest) {
      return selectedMapRequest.location;
    }
    return mapCenter;
  }, [showRequests, selectedMapRequest, mapCenter]);
  const requestDraftCenter = useMemo(
    () => ({ lat: Number(requestForm.lat) || mapCenter.lat, lng: Number(requestForm.lng) || mapCenter.lng }),
    [requestForm.lat, requestForm.lng, mapCenter.lat, mapCenter.lng]
  );
  const displayDate = useMemo(
    () => new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    []
  );

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
    void detectLocation();
  }, [autoDetectAttempted, profileForm.lat, profileForm.lng]);

  async function loadDashboard(activeToken: string) {
    setLoading(true);
    setBusyText("Loading dashboard data...");
    setMessage("");

    try {
      const [summaryData, requestData, profile] = await Promise.all([
        getHospitalSummary(activeToken),
        getRequests(activeToken, { includeHistory: true }),
        getHospitalProfile(activeToken),
      ]);

      const me = await getMe(activeToken);
      setUserId(me.id);
      setDisplayName(me.first_name || me.email.split("@")[0]);

      setSummary(summaryData);
      setRequests(requestData);
      setProfile(profile);

      setProfileForm({
        facility_name: profile.facility_name || "",
        license_number: profile.license_number || "",
        nodal_officer_name: profile.nodal_officer_name || "",
        emergency_phone: profile.emergency_phone || "",
        lat: String(profile.location?.lat ?? ""),
        lng: String(profile.location?.lng ?? ""),
      });

      setRequestForm((prev) => ({
        ...prev,
        hospital_name: profile.facility_name || prev.hospital_name,
        lat: String(profile.location?.lat ?? prev.lat),
        lng: String(profile.location?.lng ?? prev.lng),
      }));

      if (!profile.is_verified_by_admin) {
        setMessage("Hospital account is not yet admin-verified. You can still test dashboard and requests for now.");
      }

      const radar = await getRadarDonors(
        activeToken,
        bloodGroup,
        radiusKm,
        profile.location?.lat,
        profile.location?.lng
      );
      setDonors(radar);
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

  async function detectLocation() {
    if (!navigator.geolocation) {
      setMessage("Geolocation is not supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        setProfileForm((prev) => ({ ...prev, lat, lng }));
        setRequestForm((prev) => ({ ...prev, lat, lng }));
        pushToast("success", "Location auto-detected. Save profile to persist it.");
      },
      () => {
        pushToast("error", "Unable to detect location. Please enable browser location permission.");
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

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault();
    if (!token) return;

    setLoading(true);
    setBusyText("Saving hospital profile...");
    setMessage("");

    try {
      await upsertHospitalProfile(token, {
        facility_name: profileForm.facility_name,
        license_number: profileForm.license_number,
        nodal_officer_name: profileForm.nodal_officer_name,
        emergency_phone: profileForm.emergency_phone,
        location: { lat: Number(profileForm.lat), lng: Number(profileForm.lng) },
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

    if (!requestForm.required_by_datetime) {
      pushToast("info", "Please provide required by date and time.");
      return;
    }

    const requiredByIso = new Date(requestForm.required_by_datetime).toISOString();

    setLoading(true);
    setBusyText("Creating blood request...");
    setMessage("");

    try {
      await upsertHospitalProfile(token, {
        facility_name: profileForm.facility_name || requestForm.hospital_name,
        nodal_officer_name: profileForm.nodal_officer_name,
        emergency_phone: profileForm.emergency_phone,
        location: { lat: Number(requestForm.lat), lng: Number(requestForm.lng) },
      });

      await createRequest(token, {
        patient_name: requestForm.patient_name,
        description: requestForm.description,
        patient_age: requestForm.patient_age ? Number(requestForm.patient_age) : undefined,
        blood_group_needed: requestForm.blood_group_needed,
        units_required: Number(requestForm.units_required),
        urgency: requestForm.urgency,
        required_by_datetime: requiredByIso,
        hospital_name: requestForm.hospital_name,
        location: { lat: Number(requestForm.lat), lng: Number(requestForm.lng) },
      });

      pushToast("success", "Blood request created successfully.");
      changeTab("requests");
      await loadDashboard(token);
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Failed to create request.");
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
          className="btn btn-primary btn-action"
          onClick={() => {
            pushToast("info", "Opening confirmation for fulfilled status...");
            void handleOwnerStatusUpdate(item.id, "FULFILLED");
          }}
        >
          Mark as Fulfilled
        </button>
        <button
          className="btn btn-action"
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
      <main className="page">
        <section className="container hero">
          <div className="dashboard-topbar section">
            <div className="topbar-logo">BloodLink</div>
            <div className="topbar-search-wrap"><input className="topbar-search-input" placeholder="Search patients, requests..." /></div>
            <div className="topbar-right">
              <button className="btn">Alerts</button>
              <button className="btn" onClick={logout}>Logout</button>
            </div>
          </div>
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

          <div className="dashboard-shell section">
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
                  <div className="notice">Your requests: {myRequests.length}</div>
                  <div className="notice">Total network requests: {requests.length}</div>
                  <div className="notice">Eligible donor matches: {eligibleDonors.length}</div>
                  <div className="notice">Critical open: {summary?.critical_open ?? 0}</div>
                </div>
              </div>
              <div className="panel">
                <div className="panel-head"><div className="panel-title">Request Trend</div></div>
                <div style={{ padding: 14 }}>
                  <div className="bar-row"><div className="bar-label">Active</div><div className="bar-wrap"><div className="bar-fill" style={{ width: `${Math.min(requests.filter((r) => r.status === "ACTIVE").length * 10, 100)}%` }} /></div></div>
                  <div className="bar-row"><div className="bar-label">Partial</div><div className="bar-wrap"><div className="bar-fill amber" style={{ width: `${Math.min(requests.filter((r) => r.status === "PARTIAL").length * 10, 100)}%` }} /></div></div>
                  <div className="bar-row"><div className="bar-label">Fulfilled</div><div className="bar-wrap"><div className="bar-fill green" style={{ width: `${Math.min(requests.filter((r) => r.status === "FULFILLED").length * 10, 100)}%` }} /></div></div>
                </div>
              </div>
            </div>
              )}

              {activeTab === "profile" && (
            <div className="panel section">
              <div className="panel-head"><div className="panel-title">Hospital Profile and Settings</div></div>
              <div style={{ padding: 14 }}>
                <form className="form-grid" onSubmit={handleSaveProfile}>
                  <input className="input" placeholder="Facility name" value={profileForm.facility_name} onChange={(e) => setProfileForm((p) => ({ ...p, facility_name: e.target.value }))} required />
                  <input className="input" placeholder="License number" value={profileForm.license_number} onChange={(e) => setProfileForm((p) => ({ ...p, license_number: e.target.value }))} required />
                  <input className="input" placeholder="Nodal officer name" value={profileForm.nodal_officer_name} onChange={(e) => setProfileForm((p) => ({ ...p, nodal_officer_name: e.target.value }))} required />
                  <input className="input" placeholder="Emergency phone" value={profileForm.emergency_phone} onChange={(e) => setProfileForm((p) => ({ ...p, emergency_phone: e.target.value }))} required />
                  <input className="input" placeholder="Latitude" value={profileForm.lat} onChange={(e) => setProfileForm((p) => ({ ...p, lat: e.target.value }))} required />
                  <input className="input" placeholder="Longitude" value={profileForm.lng} onChange={(e) => setProfileForm((p) => ({ ...p, lng: e.target.value }))} required />
                  <div className="actions compact-actions">
                    <button className="btn" type="button" onClick={detectLocation}>Auto Detect Location</button>
                    <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Saving..." : "Save Profile"}</button>
                  </div>
                </form>
                <div className="notice">Verification status: {profile?.is_verified_by_admin ? "Verified" : "Pending Verification"}</div>
                <div className="section">
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
                  <input className="input" placeholder="Hospital/facility name shown to users" title="Displayed to users viewing the request" value={requestForm.hospital_name} onChange={(e) => setRequestForm((p) => ({ ...p, hospital_name: e.target.value }))} required />
                  <input className="input" placeholder="Latitude (auto-filled from location)" title="Geo latitude for map matching" value={requestForm.lat} onChange={(e) => setRequestForm((p) => ({ ...p, lat: e.target.value }))} required />
                  <input className="input" placeholder="Longitude (auto-filled from location)" title="Geo longitude for map matching" value={requestForm.lng} onChange={(e) => setRequestForm((p) => ({ ...p, lng: e.target.value }))} required />
                  <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Working..." : "Create Request"}</button>
                </form>
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
                      <div className="req-meta-line">{item.hospital_name} • {item.status}</div>
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
                <div className="notice">Showing {mapPoints.length} request points. Eligible donors matched in last radar run: {eligibleDonors.length}.</div>
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
