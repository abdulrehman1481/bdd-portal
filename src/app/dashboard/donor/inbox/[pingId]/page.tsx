"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DonorInboxPingDetail,
  getDonorInboxPingDetail,
  respondDonorInboxPing,
} from "@/lib/api";
import { RequireRole } from "@/components/AuthGuards";
import ToastStack from "@/components/ToastStack";
import ThemeToggle from "@/components/ThemeToggle";
import { getStoredToken } from "@/lib/session";
import { useToastQueue } from "@/lib/useToastQueue";

export default function DonorInboxPingDetailPage() {
  const params = useParams<{ pingId: string }>();
  const router = useRouter();
  const pingId = Number(params.pingId);

  const [token, setToken] = useState("");
  const [item, setItem] = useState<DonorInboxPingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [responding, setResponding] = useState(false);
  const [responseNote, setResponseNote] = useState("");
  const { toasts, pushToast, dismissToast } = useToastQueue();

  useEffect(() => {
    const activeToken = getStoredToken();
    if (!activeToken) return;
    setToken(activeToken);
    void loadPing(activeToken);
  }, [pingId]);

  async function loadPing(activeToken: string) {
    if (!pingId || Number.isNaN(pingId)) {
      pushToast("error", "Invalid ping id.");
      return;
    }

    setLoading(true);
    try {
      const detail = await getDonorInboxPingDetail(activeToken, pingId);
      setItem(detail);
      setResponseNote(detail.response_note || "");
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Failed to load ping detail.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRespond(responseStatus: "ACCEPTED" | "DECLINED") {
    if (!token || !item || item.response_status !== "PENDING") return;
    setResponding(true);
    try {
      const result = await respondDonorInboxPing(token, item.id, {
        response_status: responseStatus,
      });
      pushToast("success", result.detail);
      await loadPing(token);
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Failed to submit response.");
    } finally {
      setResponding(false);
    }
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
              <button className="btn" onClick={() => router.back()}>Back</button>
            </div>
          </div>
        </header>

        <section className="container hero dashboard-main">
          <div className="dash-top">
            <div>
              <div className="brand">Donor Inbox</div>
              <h1 className="title dashboard-title">
                Ping <span className="accent">Detail</span>
              </h1>
              <p className="subtitle">Review this ping, respond once, and keep the hospital loop updated in real time.</p>
            </div>
            <div className="actions">
              <button className="btn" onClick={() => router.back()}>Back</button>
              <Link href="/dashboard/donor/inbox" className="btn btn-primary">Inbox</Link>
            </div>
          </div>

          {!item ? (
            <div className="panel section">
              <div style={{ padding: 16 }} className="notice">{loading ? "Loading ping detail..." : "Ping not found."}</div>
            </div>
          ) : (
            <>
              <div className="split section">
                <div className="panel">
                  <div className="panel-head"><div className="panel-title">Ping Information</div></div>
                  <div style={{ padding: 14 }}>
                    <div className="notice"><strong>Hospital:</strong> {item.hospital_name}</div>
                    <div className="notice"><strong>Patient:</strong> {item.patient_name}</div>
                    <div className="notice"><strong>Blood Group Needed:</strong> {item.blood_group_needed}</div>
                    <div className="notice"><strong>Urgency:</strong> {item.urgency}</div>
                    <div className="notice"><strong>Request Status:</strong> {item.request_status}</div>
                    <div className="notice"><strong>Pinged At:</strong> {new Date(item.pinged_at).toLocaleString()}</div>
                    <div className="notice"><strong>Need By:</strong> {new Date(item.required_by_datetime).toLocaleString()}</div>
                    <div className="notice"><strong>Your Response:</strong> {item.response_status}</div>
                    {item.responded_at ? <div className="notice"><strong>Responded At:</strong> {new Date(item.responded_at).toLocaleString()}</div> : null}
                    {item.response_note ? <div className="notice"><strong>Response Note:</strong> {item.response_note}</div> : null}
                    {item.description ? <div className="notice"><strong>Description:</strong> {item.description}</div> : null}
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-head"><div className="panel-title">Actions</div></div>
                  <div style={{ padding: 14 }}>
                    <textarea
                      className="input"
                      rows={3}
                      placeholder="Optional note to hospital (ETA, constraints, etc.)"
                      value={responseNote}
                      onChange={(event) => setResponseNote(event.target.value)}
                      disabled={responding || item.response_status !== "PENDING" || item.request_status === "FULFILLED" || item.request_status === "CLOSED"}
                    />
                    <div className="actions compact-actions">
                      <button
                        className="btn btn-primary"
                        disabled={responding || item.response_status !== "PENDING" || item.request_status === "FULFILLED" || item.request_status === "CLOSED"}
                        onClick={() => void handleRespond("ACCEPTED")}
                      >
                        {responding ? "Working..." : item.response_status === "ACCEPTED" ? "Accepted" : "Accept"}
                      </button>
                      <button
                        className="btn"
                        disabled={responding || item.response_status !== "PENDING" || item.request_status === "FULFILLED" || item.request_status === "CLOSED"}
                        onClick={() => void handleRespond("DECLINED")}
                      >
                        {responding ? "Working..." : item.response_status === "DECLINED" ? "Declined" : "Decline"}
                      </button>
                    </div>
                    {!item.can_open_request_detail ? (
                      <div className="notice" style={{ marginTop: 10 }}>
                        Request detail is locked because this request is no longer active.
                      </div>
                    ) : (
                      <div className="actions compact-actions" style={{ marginTop: 10 }}>
                        <Link href={`/dashboard/requests/${item.request_id}`} className="btn btn-subtle">Open Full Request Detail</Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </RequireRole>
  );
}
