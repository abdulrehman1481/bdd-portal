"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { PublicOnly } from "@/components/AuthGuards";
import { MedicalCenter, RegisterPayload, getPublicMedicalCenters, registerUser, reverseGeocodeCity } from "@/lib/api";

const initialForm: RegisterPayload = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  phone_number: "",
  role: "DONOR",
};

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterPayload>(initialForm);
  const [loading, setLoading] = useState(false);
  const [centersLoading, setCentersLoading] = useState(false);
  const [nearbyCenters, setNearbyCenters] = useState<MedicalCenter[]>([]);
  const [detectedCity, setDetectedCity] = useState("");
  const [selectedCenterId, setSelectedCenterId] = useState("");
  const [message, setMessage] = useState("");

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }

  function normalizeCityName(city: string): string {
    return city
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .replace(/\b(city|district|division|tehsil|capital|territory|pakistan)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function filterCentersByCity(items: MedicalCenter[], city: string): MedicalCenter[] {
    const normalizedCity = normalizeCityName(city);
    if (!normalizedCity) return items;
    return items.filter((center) => {
      const centerCity = normalizeCityName(center.city || "");
      return centerCity === normalizedCity || centerCity.includes(normalizedCity) || normalizedCity.includes(centerCity);
    });
  }

  function geolocationBlockedHint(): string {
    if (typeof window === "undefined") return "";
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!window.isSecureContext && !isLocalhost) {
      return " Location is often blocked on non-HTTPS LAN URLs. Use https or localhost for automatic detection.";
    }
    return "";
  }

  async function loadFallbackHospitals() {
    setNearbyCenters([]);
    setDetectedCity("");
    setSelectedCenterId("");
    setMessage("Location is required to show hospitals from your city only. Please allow location access.");
  }

  async function loadNearbyCenters() {
    if (!navigator.geolocation) {
      setMessage(`Geolocation is not supported in this browser.${geolocationBlockedHint()}`);
      await loadFallbackHospitals();
      return;
    }

    setCentersLoading(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const userCity = await reverseGeocodeCity(lat, lng);
          const resolvedCity = (userCity || "").trim();

          if (!resolvedCity) {
            // Fallback 1: ask API to infer city from current coordinates.
            const inferredPayload = await getPublicMedicalCenters({
              lat,
              lng,
              centerType: "HOSPITAL",
              limit: 120,
            });
            const inferredCity = (inferredPayload.city || "").trim();
            const inferredItems = inferredCity
              ? filterCentersByCity(inferredPayload.items, inferredCity)
              : inferredPayload.items;
            setNearbyCenters(inferredItems);
            setDetectedCity(inferredCity);
            if (!inferredItems.length) {
              setMessage("Could not determine your city. Please try again from a stable location signal.");
            }
            return;
          }

          // Primary: strict city filtering
          const strictPayload = await getPublicMedicalCenters({
            city: resolvedCity,
            centerType: "HOSPITAL",
            strictCity: true,
            limit: 120,
          });
          let cityItems = filterCentersByCity(strictPayload.items, resolvedCity);

          // Fallback 2: relaxed city query if strict yields none
          if (!cityItems.length) {
            const relaxedPayload = await getPublicMedicalCenters({
              city: resolvedCity,
              centerType: "HOSPITAL",
              limit: 120,
            });
            cityItems = filterCentersByCity(relaxedPayload.items, resolvedCity);
          }

          // Fallback 3: coordinate-based query but still filtered by city name
          if (!cityItems.length) {
            const coordPayload = await getPublicMedicalCenters({
              lat,
              lng,
              centerType: "HOSPITAL",
              limit: 120,
            });
            cityItems = filterCentersByCity(coordPayload.items, resolvedCity);
          }

          setNearbyCenters(cityItems);
          setDetectedCity(resolvedCity);

          if (!cityItems.length) {
            setMessage(`No hospitals found in ${resolvedCity}.`);
          }
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Failed to load nearby hospitals.");
        } finally {
          setCentersLoading(false);
        }
      },
      () => {
        void loadFallbackHospitals().finally(() => {
          setCentersLoading(false);
          setMessage(`Unable to detect location. Please allow location access.${geolocationBlockedHint()}`);
        });
      }
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    if (!form.phone_number.trim()) {
      setMessage("Phone number is required.");
      setLoading(false);
      return;
    }

    const normalizedPhone = form.phone_number.startsWith("+")
      ? form.phone_number.trim()
      : `+${form.phone_number.trim()}`;

    if (form.role === "HOSPITAL") {
      // Validate hospital selection
      if (!selectedCenterId) {
        setMessage("Please detect location and select your hospital from the nearby list.");
        setLoading(false);
        return;
      }
      
      // Validate that a center was actually loaded
      const selectedCenter = nearbyCenters.find((c) => String(c.id) === selectedCenterId);
      if (!selectedCenter) {
        setMessage("Selected hospital is no longer available. Please reload the hospital list.");
        setLoading(false);
        return;
      }
      
      // Validate city detection (at least one of these should be true)
      if (!detectedCity && nearbyCenters.length === 0) {
        setMessage("Unable to detect your city and no hospitals are available. Please try 'Load Hospitals Without Location'.");
        setLoading(false);
        return;
      }
    }

    try {
      const payload: RegisterPayload = {
        ...form,
        phone_number: normalizedPhone,
      };
      if (form.role === "HOSPITAL" && selectedCenterId) {
        payload.hospital_center_id = Number(selectedCenterId);
      }

      await registerUser(payload);
      setMessage("Signup successful. Redirecting to sign in...");
      setTimeout(() => router.push("/auth/signin"), 700);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Signup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicOnly>
      <main className="page">
        <section className="container hero">
        <div className="actions compact-actions" style={{ marginBottom: 12 }}>
          <button className="btn" type="button" onClick={handleBack}>Back</button>
          <Link href="/" className="btn btn-subtle">Home</Link>
        </div>
        <div className="brand">BloodLink Onboarding</div>
        <h1 className="title">
          Create <span className="accent">Account</span>
        </h1>
        <p className="subtitle">Create donor or hospital account. Hospital verification step can be added next.</p>

        <div className="panel section" style={{ maxWidth: 780 }}>
          <div className="panel-head">
            <div className="panel-title">Sign Up</div>
          </div>
          <div style={{ padding: 16 }}>
            <form className="form-grid" onSubmit={handleSubmit}>
              <input
                className="input"
                placeholder="First name"
                value={form.first_name}
                required
                onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Last name"
                value={form.last_name}
                required
                onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))}
              />
              <input
                className="input"
                type="email"
                placeholder="Email"
                value={form.email}
                required
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
              <input
                className="input"
                type="tel"
                placeholder="Phone (+1555...)"
                value={form.phone_number}
                required
                onChange={(e) => setForm((prev) => ({ ...prev, phone_number: e.target.value }))}
              />
              <input
                className="input"
                type="password"
                placeholder="Password"
                value={form.password}
                minLength={8}
                required
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              />
              <select
                className="select"
                value={form.role}
                onChange={(e) => {
                  const nextRole = e.target.value as RegisterPayload["role"];
                  setForm((prev) => ({ ...prev, role: nextRole }));
                  if (nextRole !== "HOSPITAL") {
                    setNearbyCenters([]);
                    setDetectedCity("");
                    setSelectedCenterId("");
                  }
                }}
              >
                <option value="DONOR">Donor</option>
                <option value="HOSPITAL">Hospital</option>
              </select>

              {form.role === "HOSPITAL" ? (
                <>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => void loadNearbyCenters()}
                    disabled={centersLoading}
                  >
                    {centersLoading ? "Locating..." : "Use Current Location for Nearby Hospitals"}
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => void loadFallbackHospitals()}
                    disabled={centersLoading}
                  >
                    Load Hospitals Without Location
                  </button>
                  <select
                    className="select"
                    value={selectedCenterId}
                    onChange={(e) => setSelectedCenterId(e.target.value)}
                    required={form.role === "HOSPITAL"}
                  >
                    <option value="">Select hospital from list</option>
                    {nearbyCenters.map((center) => (
                      <option key={center.id} value={center.id}>
                        {center.name} - {center.city}{center.area ? ` (${center.area})` : ""}
                      </option>
                    ))}
                  </select>
                  {detectedCity ? <div className="notice">Detected city: {detectedCity}</div> : null}
                </>
              ) : null}

              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Account"}
              </button>
            </form>
            <div className="notice">{message || "Already have an account? Sign in."}</div>
            <div className="notice">
              <Link href="/auth/signin" className="accent-link">
                Go to Sign In
              </Link>
            </div>
          </div>
        </div>
        </section>
      </main>
    </PublicOnly>
  );
}
