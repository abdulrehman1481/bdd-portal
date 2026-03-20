"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { PublicOnly } from "@/components/AuthGuards";
import { MedicalCenter, RegisterPayload, getPublicMedicalCenters, registerUser } from "@/lib/api";

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

  async function loadNearbyCenters() {
    if (!navigator.geolocation) {
      setMessage("Geolocation is not supported in this browser.");
      return;
    }

    setCentersLoading(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const payload = await getPublicMedicalCenters({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            centerType: "HOSPITAL",
            limit: 50,
          });
          setNearbyCenters(payload.items);
          setDetectedCity(payload.city || "");
          if (!payload.items.length) {
            setMessage("No nearby hospitals found for your city yet.");
          }
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Failed to load nearby hospitals.");
        } finally {
          setCentersLoading(false);
        }
      },
      () => {
        setCentersLoading(false);
        setMessage("Unable to detect location. Please allow location access.");
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

    if (form.role === "HOSPITAL" && !selectedCenterId) {
      setMessage("Please detect location and select your hospital from nearby list.");
      setLoading(false);
      return;
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
                  <select
                    className="select"
                    value={selectedCenterId}
                    onChange={(e) => setSelectedCenterId(e.target.value)}
                    required={form.role === "HOSPITAL"}
                  >
                    <option value="">Select hospital from nearby city (optional)</option>
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
