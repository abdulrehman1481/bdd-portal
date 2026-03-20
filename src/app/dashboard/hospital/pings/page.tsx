"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getHospitalSentPings,
  deleteHospitalPing,
  HospitalPingSent,
} from "@/lib/api";
import { RequireRole } from "@/components/AuthGuards";
import ConfirmModal from "@/components/ConfirmModal";
import ToastStack from "@/components/ToastStack";
import { getStoredToken } from "@/lib/session";
import { useToastQueue } from "@/lib/useToastQueue";

type FilterType = "ALL" | "PENDING" | "ACCEPTED" | "DECLINED";

export default function HospitalPingsPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [pings, setPings] = useState<HospitalPingSent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [confirmState, setConfirmState] = useState<{ pingId: number; donorName: string } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { toasts, pushToast, dismissToast } = useToastQueue();

  const filteredPings = pings.filter((p) => (filter === "ALL" ? true : p.response_status === filter));

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
      <main className="page">
        <section className="container hero">
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
              <Link href="/dashboard/hospital?tab=requests" className="btn">Back to Requests</Link>
            </div>
          </div>

          <div className="panel section">
            <div className="panel-head"><div className="panel-title">All Pings</div></div>
            <div style={{ padding: "10px 12px 0" }} className="notice">
              Manage all pings sent to donors. Click a ping to see details, or delete pending pings before recipients respond.
            </div>
            <div className="filter-row" style={{ padding: "10px 12px" }}>
              <button className={`chip ${filter === "ALL" ? "active" : ""}`} onClick={() => setFilter("ALL")}>
                All ({pings.length})
              </button>
              <button className={`chip ${filter === "PENDING" ? "active" : ""}`} onClick={() => setFilter("PENDING")}>
                Pending ({pings.filter((p) => p.response_status === "PENDING").length})
              </button>
              <button className={`chip ${filter === "ACCEPTED" ? "active" : ""}`} onClick={() => setFilter("ACCEPTED")}>
                Accepted ({pings.filter((p) => p.response_status === "ACCEPTED").length})
              </button>
              <button className={`chip ${filter === "DECLINED" ? "active" : ""}`} onClick={() => setFilter("DECLINED")}>
                Declined ({pings.filter((p) => p.response_status === "DECLINED").length})
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
                        <div className={`badge ${ping.response_status === "PENDING" ? "" : ping.response_status === "ACCEPTED" ? "accepted" : "declined"}`}>
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
