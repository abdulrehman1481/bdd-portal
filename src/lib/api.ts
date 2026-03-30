import {
  clearSession,
  getStoredRefreshToken,
  setStoredRefreshToken,
  setStoredToken,
} from "@/lib/session";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://blood-link-zeta.vercel.app/api";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  token?: string;
  body?: unknown;
  skipAuthRefresh?: boolean;
};

type RefreshResponse = {
  access: string;
  refresh?: string;
};

function isTokenAuthErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("token") ||
    lower.includes("jwt") ||
    lower.includes("expired") ||
    lower.includes("authentication credentials were not provided") ||
    lower.includes("invalid authorization header")
  );
}

async function shouldAttemptTokenRefresh(response: Response): Promise<boolean> {
  if (response.status !== 401) {
    return false;
  }

  const contentType = response.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const payload = (await response.clone().json()) as Record<string, unknown>;
      const detail = typeof payload.detail === "string" ? payload.detail : "";
      if (detail && isTokenAuthErrorMessage(detail)) {
        return true;
      }

      const aggregate = Object.values(payload)
        .flatMap((value) => normalizeErrorField(value))
        .join(" ");
      if (aggregate && isTokenAuthErrorMessage(aggregate)) {
        return true;
      }
    } else {
      const text = await response.clone().text();
      if (text && isTokenAuthErrorMessage(text)) {
        return true;
      }
    }
  } catch {
    return true;
  }

  return false;
}

let refreshInFlight: Promise<string> | null = null;

function normalizeErrorField(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
      normalizeErrorField(nested).map((msg) => `${key}: ${msg}`)
    );
  }
  return [];
}

async function buildApiErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as Record<string, unknown>;
      const detail = typeof payload.detail === "string" ? payload.detail : null;
      const messages = Object.entries(payload)
        .filter(([key]) => key !== "detail")
        .flatMap(([key, value]) => normalizeErrorField(value).map((msg) => `${key}: ${msg}`));

      const parts = [detail, ...messages].filter(Boolean) as string[];
      if (parts.length) {
        return parts.join(" | ");
      }
    } catch {
      // Fall through to text parsing.
    }
  }

  const text = await response.text();
  return text || response.statusText || "Request failed.";
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    throw new Error("Session expired. Please sign in again.");
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
        cache: "no-store",
      });

      if (!response.ok) {
        const message = await buildApiErrorMessage(response);
        throw new Error(`API ${response.status}: ${message}`);
      }

      const payload = (await response.json()) as RefreshResponse;
      setStoredToken(payload.access);
      if (payload.refresh) {
        setStoredRefreshToken(payload.refresh);
      }
      return payload.access;
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const call = async (token?: string) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return fetch(`${API_BASE_URL}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
  };

  let response = await call(options.token);

  if (options.token && !options.skipAuthRefresh && (await shouldAttemptTokenRefresh(response))) {
    try {
      const nextAccess = await refreshAccessToken();
      response = await call(nextAccess);
    } catch {
      clearSession();
      throw new Error("Session expired. Please sign in again.");
    }
  }

  if (!response.ok) {
    const message = await buildApiErrorMessage(response);
    throw new Error(`API ${response.status}: ${message}`);
  }

  return (await response.json()) as T;
}

export type TokenResponse = {
  access: string;
  refresh: string;
};

export type UserRole = "DONOR" | "HOSPITAL" | "ADMIN";

export type UserMe = {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  role: UserRole;
  is_phone_verified: boolean;
  is_email_verified: boolean;
};

export type RegisterPayload = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  role: UserRole;
  hospital_center_id?: number;
  hospital_new?: {
    name: string;
    city?: string;
    area?: string;
    address?: string;
    contact?: string;
    location: { lat: number; lng: number };
  };
};

export type HospitalSummary = {
  critical_open: number;
  active_requests: number;
  fulfilled_requests: number;
  expiring_within_6h: number;
};

export type BloodRequest = {
  id: number;
  requester: number;
  patient_name: string;
  description?: string;
  patient_age: number | null;
  blood_group_needed: string;
  units_required: number;
  units_fulfilled: number;
  urgency: "STANDARD" | "URGENT" | "CRITICAL";
  status: "ACTIVE" | "PARTIAL" | "FULFILLED" | "CLOSED";
  required_by_datetime: string;
  hospital_name: string;
  location: { lat: number; lng: number };
  actions_count?: number;
};

export type RequestAction = {
  id: number;
  blood_request: number;
  actor: number;
  actor_email: string;
  actor_role: UserRole;
  action_type: "VOLUNTEER" | "FLAG" | "SUPPORT";
  note: string;
  created_at: string;
};

export type DonorProfile = {
  id: number;
  user?: number;
  blood_group: string;
  date_of_birth?: string;
  weight_kg?: string | number;
  gender?: "M" | "F" | "O";
  is_available: boolean;
  is_eligible_to_donate?: boolean;
  last_donation_date: string | null;
  location: { lat: number; lng: number };
  location_updated_at?: string;
};

export type RadarDonor = {
  id: number;
  donor_user_id: number;
  donor_email: string;
  blood_group: string;
  is_available: boolean;
  is_eligible_to_donate: boolean;
  display_name: string;
  distance_km: number;
};

export type HospitalProfile = {
  id: number;
  user: number;
  facility_name: string;
  license_number: string;
  is_verified_by_admin: boolean;
  nodal_officer_name: string;
  emergency_phone: string;
  location: { lat: number; lng: number };
};

export type DonorEligibility = {
  is_eligible: boolean;
  eligible_on: string;
  days_remaining: number;
};

export type DonorTimelineItem = {
  id: number;
  status: "ACCEPTED" | "DONATED" | "REJECTED_AT_HOSPITAL" | "NO_SHOW";
  hospital_name: string;
  blood_group: string;
  accepted_at: string;
  resolved_at: string | null;
};

export type DonorSummary = {
  nearby_open_requests: number;
  total_donations: number;
  lives_impacted: number;
  days_until_eligible: number;
  is_eligible: boolean;
  next_eligible_on: string;
  donation_timeline: DonorTimelineItem[];
};

export type DonorInboxPing = {
  id: number;
  pinged_at: string;
  response_status: "PENDING" | "ACCEPTED" | "DECLINED";
  response_note: string;
  responded_at: string | null;
  hospital_name: string;
  request_id: number;
  patient_name: string;
  description: string;
  blood_group_needed: string;
  urgency: "STANDARD" | "URGENT" | "CRITICAL";
  request_status: "ACTIVE" | "PARTIAL" | "FULFILLED" | "CLOSED";
  can_open_request_detail: boolean;
  required_by_datetime: string;
};

export type DonorInboxPingDetail = DonorInboxPing;

export type DonorInboxHistoryResponse = {
  user_id: number;
  total_count: number;
  items: DonorInboxPing[];
};

export type MedicalCenter = {
  id: number;
  name: string;
  city: string;
  area: string;
  address?: string;
  contact?: string;
  doctors_count?: number | null;
  center_type: "HOSPITAL" | "LAB" | "CLINIC" | "BLOOD_BANK";
  location: { lat: number; lng: number };
  source: string;
  external_id: string | null;
};

export type MedicalCenterListResponse = {
  city: string;
  count: number;
  items: MedicalCenter[];
};

export type RequestPingStatus = {
  id: number;
  donor_id: number;
  donor_name: string;
  blood_group: string;
  response_status: "PENDING" | "ACCEPTED" | "DECLINED";
  response_note: string;
  pinged_at: string;
  responded_at: string | null;
};

export type HospitalPingSent = {
  id: number;
  donor_id: number;
  donor_name: string;
  donor_blood_group: string;
  response_status: string;
  response_note: string;
  pinged_at: string;
  responded_at: string | null;
  request_id: number;
  patient_name: string;
  blood_group_needed: string;
  urgency: string;
  request_status: string;
};

export type RequestComment = {
  id: number;
  blood_request: number;
  author: number;
  author_email: string;
  author_first_name: string;
  author_role: UserRole;
  message: string;
  created_at: string;
};

export type BloodRequestCreatePayload = {
  patient_name: string;
  description?: string;
  patient_age?: number;
  blood_group_needed: string;
  units_required: number;
  urgency: "STANDARD" | "URGENT" | "CRITICAL";
  required_by_datetime: string;
  hospital_name: string;
  location: { lat: number; lng: number };
};

export type BloodRequestStatusPayload = {
  status?: "ACTIVE" | "PARTIAL" | "FULFILLED" | "CLOSED";
  units_fulfilled?: number;
};

export type RequestActionPayload = {
  action_type: "VOLUNTEER" | "FLAG" | "SUPPORT";
  note?: string;
};

export async function login(email: string, password: string): Promise<TokenResponse> {
  const normalizedEmail = email.trim().toLowerCase();
  return apiRequest<TokenResponse>("/auth/token/", {
    method: "POST",
    body: { email: normalizedEmail, password },
  });
}

export async function registerUser(payload: RegisterPayload): Promise<Partial<UserMe>> {
  const normalizedEmail = payload.email.trim().toLowerCase();
  return apiRequest<Partial<UserMe>>("/auth/register/", {
    method: "POST",
    body: {
      ...payload,
      email: normalizedEmail,
    },
  });
}

export async function getMe(token: string): Promise<UserMe> {
  return apiRequest<UserMe>("/auth/me/", { token });
}

export async function getHospitalSummary(token: string): Promise<HospitalSummary> {
  return apiRequest<HospitalSummary>("/dashboard/hospital/summary/", { token });
}

export async function getRequests(token: string, options?: { includeHistory?: boolean }): Promise<BloodRequest[]> {
  const includeHistory = options?.includeHistory ? "?include_history=1" : "";
  return apiRequest<BloodRequest[]>(`/requests/${includeHistory}`, { token });
}

export async function getRequestById(token: string, requestId: number): Promise<BloodRequest> {
  return apiRequest<BloodRequest>(`/requests/${requestId}/`, { token });
}

export async function createRequest(token: string, payload: BloodRequestCreatePayload): Promise<BloodRequest> {
  return apiRequest<BloodRequest>("/requests/create/", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function triggerMatching(token: string, requestId: number): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>(`/requests/${requestId}/trigger-matching/`, {
    method: "POST",
    token,
  });
}

export async function updateRequestStatus(
  token: string,
  requestId: number,
  payload: BloodRequestStatusPayload
): Promise<BloodRequest> {
  return apiRequest<BloodRequest>(`/requests/${requestId}/status/`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export async function createRequestAction(
  token: string,
  requestId: number,
  payload: RequestActionPayload
): Promise<RequestAction> {
  return apiRequest<RequestAction>(`/requests/${requestId}/actions/`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function getRequestActions(token: string, requestId: number): Promise<RequestAction[]> {
  return apiRequest<RequestAction[]>(`/requests/${requestId}/actions/`, { token });
}

export async function getRadarDonors(
  token: string,
  bloodGroup: string,
  radiusKm: number,
  lat?: number,
  lon?: number
): Promise<RadarDonor[]> {
  const latLonPart = lat !== undefined && lon !== undefined ? `&lat=${lat}&lon=${lon}` : "";
  return apiRequest<RadarDonor[]>(
    `/donors/radar/?blood_group=${encodeURIComponent(bloodGroup)}&radius_km=${radiusKm}${latLonPart}`,
    { token }
  );
}

export async function pingDonor(
  token: string,
  donorId: number,
  payload: { request_id: number }
): Promise<{ detail: string; ping_id?: number; donor_user_id?: number; donor_email?: string; request_id?: number }> {
  return apiRequest<{ detail: string; ping_id?: number; donor_user_id?: number; donor_email?: string; request_id?: number }>(`/donors/${donorId}/ping/`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function getDonorInbox(token: string): Promise<DonorInboxPing[]> {
  return apiRequest<DonorInboxPing[]>("/dashboard/donor/inbox/", { token });
}

export async function getDonorInboxHistory(token: string): Promise<DonorInboxHistoryResponse> {
  return apiRequest<DonorInboxHistoryResponse>(`/dashboard/donor/inbox/history/?t=${Date.now()}`, { token });
}

export async function getMedicalCenters(
  token: string,
  options?: {
    city?: string;
    centerType?: "HOSPITAL" | "LAB" | "CLINIC" | "BLOOD_BANK";
    query?: string;
    strictCity?: boolean;
  }
): Promise<MedicalCenterListResponse> {
  const params = new URLSearchParams();
  if (options?.city) params.set("city", options.city);
  if (options?.centerType) params.set("center_type", options.centerType);
  if (options?.query) params.set("q", options.query);
  if (options?.strictCity) params.set("strict_city", "1");
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<MedicalCenterListResponse>(`/directory/medical-centers/${suffix}`, { token });
}

export async function getPublicMedicalCenters(options?: {
  city?: string;
  centerType?: "HOSPITAL" | "LAB" | "CLINIC" | "BLOOD_BANK";
  query?: string;
  lat?: number;
  lng?: number;
  limit?: number;
  strictCity?: boolean;
}): Promise<MedicalCenterListResponse> {
  const params = new URLSearchParams();
  if (options?.city) params.set("city", options.city);
  if (options?.centerType) params.set("center_type", options.centerType);
  if (options?.query) params.set("q", options.query);
  if (options?.lat !== undefined) params.set("lat", String(options.lat));
  if (options?.lng !== undefined) params.set("lng", String(options.lng));
  if (options?.limit !== undefined) params.set("limit", String(options.limit));
  if (options?.strictCity) params.set("strict_city", "1");
  params.set("compact", "1");
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<MedicalCenterListResponse>(`/directory/medical-centers/${suffix}`);
}

export async function reverseGeocodeCity(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("zoom", "10");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        county?: string;
        municipality?: string;
        state_district?: string;
      };
    };

    const address = payload.address;
    if (!address) {
      return null;
    }

    return (
      address.city ||
      address.town ||
      address.village ||
      address.county ||
      address.municipality ||
      address.state_district ||
      null
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getDonorInboxPingDetail(token: string, pingId: number): Promise<DonorInboxPingDetail> {
  return apiRequest<DonorInboxPingDetail>(`/dashboard/donor/inbox/${pingId}/`, { token });
}

export async function respondDonorInboxPing(
  token: string,
  pingId: number,
  payload: { response_status: "ACCEPTED" | "DECLINED"; response_note?: string }
): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>(`/dashboard/donor/inbox/${pingId}/respond/`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function getRequestPings(token: string, requestId: number): Promise<RequestPingStatus[]> {
  return apiRequest<RequestPingStatus[]>(`/requests/${requestId}/pings/`, { token });
}

export async function getDonorFeed(token: string, radiusKm = 10): Promise<BloodRequest[]> {
  return apiRequest<BloodRequest[]>(`/dashboard/donor/feed/?radius_km=${radiusKm}`, { token });
}

export async function getDonorEligibility(token: string): Promise<DonorEligibility> {
  return apiRequest<DonorEligibility>("/dashboard/donor/eligibility/", { token });
}

export async function getDonorSummary(token: string, radiusKm = 10): Promise<DonorSummary> {
  return apiRequest<DonorSummary>(`/dashboard/donor/summary/?radius_km=${radiusKm}`, { token });
}

export async function getHospitalProfile(token: string): Promise<HospitalProfile> {
  return apiRequest<HospitalProfile>("/profiles/hospital/", { token });
}

export async function upsertHospitalProfile(
  token: string,
  payload: Partial<HospitalProfile>
): Promise<HospitalProfile> {
  return apiRequest<HospitalProfile>("/profiles/hospital/", {
    method: "PATCH",
    token,
    body: payload,
  });
}

export async function getDonorProfile(token: string): Promise<DonorProfile> {
  return apiRequest<DonorProfile>("/profiles/donor/", { token });
}

export async function upsertDonorProfile(
  token: string,
  payload: Partial<DonorProfile>
): Promise<DonorProfile> {
  return apiRequest<DonorProfile>("/profiles/donor/", {
    method: "PATCH",
    token,
    body: payload,
  });
}

export async function getRequestComments(token: string, requestId: number): Promise<RequestComment[]> {
  return apiRequest<RequestComment[]>(`/requests/${requestId}/comments/`, { token });
}

export async function createRequestComment(
  token: string,
  requestId: number,
  payload: { message: string }
): Promise<RequestComment> {
  return apiRequest<RequestComment>(`/requests/${requestId}/comments/`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function deleteRequestComment(token: string, commentId: number): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>(`/requests/comments/${commentId}/`, {
    method: "DELETE",
    token,
  });
}

export async function getHospitalSentPings(token: string): Promise<HospitalPingSent[]> {
  return apiRequest<HospitalPingSent[]>("/dashboard/hospital/pings/", { token });
}

export async function deleteHospitalPing(token: string, pingId: number): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>(`/dashboard/hospital/pings/${pingId}/`, {
    method: "DELETE",
    token,
  });
}
