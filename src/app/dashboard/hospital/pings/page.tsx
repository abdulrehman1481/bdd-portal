"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getHospitalSentPings,
  deleteHospitalPing,
  HospitalPingSent,
} from "@/lib/api";
import { RequireRole } from "@/components/AuthGuards";
import ConfirmModal from "@/components/ConfirmModal";
import ToastStack from "@/components/ToastStack";
import ThemeToggle from "@/components/ThemeToggle";
import { getStoredToken } from "@/lib/session";
import { useToastQueue } from "@/lib/useToastQueue";

type FilterType = "ALL" | "PENDING" | "ACCEPTED" | "DECLINED";

export default function HospitalPingsPage() {
  const [token, setToken] = useState("");
  const [pings, setPings] = useState<HospitalPingSent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [confirmState, setConfirmState] = useState<{ pingId: number; donorName: string } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { toasts, pushToast, dismissToast } = useToastQueue();

  const filteredPings = pings.filter((p) => (filter === "ALL" ? true : p.response_status === filter));
  const pendingCount = pings.filter((p) => p.response_status === "PENDING").length;
  const acceptedCount = pings.filter((p) => p.response_status === "ACCEPTED").length;
  const declinedCount = pings.filter((p) => p.response_status === "DECLINED").length;

  useEffect(() => {
    const activeToken = getStoredToken();
    if (!activeToken) return;
    setToken(activeToken);
    void loadPings(activeToken);
  }, []);

  async function loadPings(activeToken: string) {
    setLoading(true);
    try {
      const data = await getHospitalSentPings(activeToken);
      setPings(data);
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Failed to load pings.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePing(pingId: number) {
    if (!token) return;
    setDeletingId(pingId);
    try {
      const result = await deleteHospitalPing(token, pingId);
      pushToast("success", result.detail);
      setPings((prev) => prev.filter((p) => p.id !== pingId));
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Failed to delete ping.");
    } finally {
      setDeletingId(null);
      setConfirmState(null);
    }
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
              <Link href="/dashboard/hospital?tab=requests" className="btn">Back to Requests</Link>
            </div>
          </div>
        </header>

        <section className="container hero dashboard-main">
          <div className="dash-top">
            <div>
              <div className="brand">Hospital Ping Management</div>
              <h1 className="title dashboard-title">
                Donor <span className="accent">Pings</span>
              </h1>
              <p className="subtitle">View all pings sent to donors, tracking their responses in real time. Delete pending pings before donors respond.</p>
            </div>
            <div className="actions">
              <button className="btn btn-primary" onClick={() => void loadPings(token)} disabled={loading}>Refresh</button>
            </div>
          </div>

          <div className="grid kpis section">
            <div className="card"><div className="label">Total Pings</div><div className="value">{pings.length}</div></div>
            <div className="card"><div className="label">Pending</div><div className="value amber">{pendingCount}</div></div>
            <div className="card"><div className="label">Accepted</div><div className="value green">{acceptedCount}</div></div>
            <div className="card"><div className="label">Declined</div><div className="value red">{declinedCount}</div></div>
          </div>

          <div className="panel section dashboard-spacious">
            <div className="panel-head"><div className="panel-title">All Pings</div></div>
            <div style={{ padding: "10px 12px 0" }} className="notice">
              Manage all pings sent to donors. Click a ping to see details, or delete pending pings before recipients respond.
            </div>
            <div className="filter-row" style={{ padding: "10px 12px" }}>
              <button className={`chip ${filter === "ALL" ? "active" : ""}`} onClick={() => setFilter("ALL")}>
                All ({pings.length})
              </button>
              <button className={`chip ${filter === "PENDING" ? "active" : ""}`} onClick={() => setFilter("PENDING")}>
                Pending ({pendingCount})
              </button>
              <button className={`chip ${filter === "ACCEPTED" ? "active" : ""}`} onClick={() => setFilter("ACCEPTED")}>
                Accepted ({acceptedCount})
              </button>
              <button className={`chip ${filter === "DECLINED" ? "active" : ""}`} onClick={() => setFilter("DECLINED")}>
                Declined ({declinedCount})
              </button>
            </div>

            <div className="request-list-cards" style={{ padding: "12px" }}>
              {filteredPings.length ? (
                filteredPings.map((ping) => (
                  <div
                    key={ping.id}
                    className={`request-item-card ${
                      ping.urgency === "CRITICAL" ? "critical" : ping.urgency === "URGENT" ? "high" : "normal"
                    }`}
                  >
                    <div className={`req-blood-chip ${ping.urgency === "CRITICAL" ? "critical" : ping.urgency === "URGENT" ? "high" : "normal"}`}>
                      {ping.blood_group_needed}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="req-card-top">
                        <div className="req-name">{ping.donor_name}</div>
                        <span className={`req-urg-tag ${ping.urgency === "CRITICAL" ? "critical" : ping.urgency === "URGENT" ? "high" : "normal"}`}>
                          {ping.urgency}
                        </span>
                      </div>
                      <div className="req-meta-line">
                        Patient: {ping.patient_name} • Request #{ping.request_id}
                      </div>
                      <div className="req-meta-line">
                        Donor: {ping.donor_name} ({ping.donor_blood_group})
                      </div>
                      <div className="req-meta-line">
                        Pinged: {new Date(ping.pinged_at).toLocaleString()}
                      </div>
                      {ping.responded_at && (
                        <div className="req-meta-line">
                          Response: {ping.response_status} at {new Date(ping.responded_at).toLocaleString()}
                        </div>
                      )}
                      {ping.response_note && (
                        <div className="req-meta-line">
                          <strong>Donor Note:</strong> {ping.response_note}
                        </div>
                      )}
                      <div className="section">
                        <div className={`badge ${ping.response_status === "PENDING" ? "pending" : ping.response_status === "ACCEPTED" ? "accepted" : "declined"}`}>
                          Status: {ping.response_status}
                        </div>
                        <div className="actions compact-actions">
                          <Link href={`/dashboard/requests/${ping.request_id}`} className="btn btn-subtle btn-action">
                            View Request
                          </Link>
                          {ping.response_status === "PENDING" && (
                            <button
                              className="btn btn-subtle btn-action"
                              disabled={deletingId === ping.id}
                              onClick={() => setConfirmState({ pingId: ping.id, donorName: ping.donor_name })}
                            >
                              {deletingId === ping.id ? "Deleting..." : "Delete Ping"}
                            </button>
                          )}
                          {ping.response_status !== "PENDING" && (
                            <div className="notice">Ping already responded. Cannot delete.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="notice">No pings match the selected filter.</div>
              )}
            </div>
          </div>
        </section>
      </main>

      <ConfirmModal
        isOpen={confirmState !== null}
        title="Delete Ping"
        description={`Are you sure you want to delete the ping to ${confirmState?.donorName}? This action cannot be undone.`}
        confirmLabel="Delete"
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          if (confirmState) {
            void handleDeletePing(confirmState.pingId);
          }
        }}
      />
    </RequireRole>
  );
}
