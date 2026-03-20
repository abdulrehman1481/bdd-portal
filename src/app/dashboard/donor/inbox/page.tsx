"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DonorInboxPing, getDonorInbox, getDonorInboxHistory, getMe, respondDonorInboxPing } from "@/lib/api";
import { RequireRole } from "@/components/AuthGuards";
import ConfirmModal from "@/components/ConfirmModal";
import ToastStack from "@/components/ToastStack";
import { getStoredToken } from "@/lib/session";
import { useToastQueue } from "@/lib/useToastQueue";

type ConfirmState = {
  pingId: number;
  responseStatus: "ACCEPTED" | "DECLINED";
  title: string;
  description: string;
  confirmLabel: string;
} | null;

export default function DonorInboxPage() {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<DonorInboxPing[]>([]);
  const [loading, setLoading] = useState(false);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [noteByPingId, setNoteByPingId] = useState<Record<number, string>>({});
  const [apiUserId, setApiUserId] = useState<number | null>(null);
  const [apiTotalCount, setApiTotalCount] = useState(0);
  const [apiUserEmail, setApiUserEmail] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const { toasts, pushToast, dismissToast } = useToastQueue();

  useEffect(() => {
    const activeToken = getStoredToken();
    if (!activeToken) return;
    setToken(activeToken);
    void loadInbox(activeToken);

    const interval = window.setInterval(() => {
      void loadInbox(activeToken);
    }, 12000);

    return () => window.clearInterval(interval);
  }, []);

  async function loadInbox(activeToken: string) {
    setLoading(true);
    try {
      const [historyResult, meResult] = await Promise.allSettled([getDonorInboxHistory(activeToken), getMe(activeToken)]);

      if (historyResult.status === "fulfilled") {
        const sortedRows = [...historyResult.value.items].sort((a, b) => +new Date(b.pinged_at) - +new Date(a.pinged_at));
        setItems(sortedRows);
        setApiUserId(historyResult.value.user_id);
        setApiTotalCount(historyResult.value.total_count);
      } else {
        // Fallback path keeps inbox functional even if history endpoint is temporarily unavailable.
        const fallbackRows = await getDonorInbox(activeToken);
        const sortedRows = [...fallbackRows].sort((a, b) => +new Date(b.pinged_at) - +new Date(a.pinged_at));
        setItems(sortedRows);
        setApiTotalCount(sortedRows.length);
        pushToast("info", "Loaded inbox via fallback endpoint.");
      }

      if (meResult.status === "fulfilled") {
        setApiUserEmail(meResult.value.email);
      }
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Failed to load donor inbox.");
    } finally {
      setLoading(false);
    }
  }

  async function respond(pingId: number, responseStatus: "ACCEPTED" | "DECLINED") {
    if (!token) {
      pushToast("error", "Session token missing. Please sign in again.");
      return;
    }
    setRespondingId(pingId);
    try {
      const result = await respondDonorInboxPing(token, pingId, {
        response_status: responseStatus,
        response_note: noteByPingId[pingId]?.trim() || "",
      });
      pushToast("success", result.detail);
      await loadInbox(token);
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Failed to submit response.");
    } finally {
      setRespondingId(null);
    }
  }

  async function handleConfirmResponse() {
    if (!confirmState) return;
    setConfirmLoading(true);
    await respond(confirmState.pingId, confirmState.responseStatus);
    setConfirmLoading(false);
    setConfirmState(null);
  }

  return (
    <RequireRole roles={["DONOR"]}>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <main className="page">
        <section className="container hero">
          <div className="dash-top">
            <div>
              <div className="brand">Donor Inbox</div>
              <h1 className="title dashboard-title">
                Ping <span className="accent">Inbox</span>
              </h1>
              <p className="subtitle">Review hospital pings and explicitly accept or decline requests in-app.</p>
            </div>
            <div className="actions">
              <button className="btn btn-primary" onClick={() => void loadInbox(token)} disabled={loading}>Refresh</button>
              <Link href="/dashboard/donor?tab=requests" className="btn">Back to Requests</Link>
            </div>
          </div>

          <div className="panel section">
            <div className="panel-head"><div className="panel-title">Incoming Pings</div></div>
            <div style={{ padding: 14 }}>
              <div className="notice" style={{ marginBottom: 10 }}>
                Total pings received: <strong>{apiTotalCount}</strong>
                {apiUserId ? <span> • Donor user #{apiUserId}</span> : null}
                {apiUserEmail ? <span> • {apiUserEmail}</span> : null}
              </div>
              {items.length ? (
                <div className="request-list-cards">
                  {items.map((item, index) => (
                    <div key={`${item.id}-${item.pinged_at}`} className={`request-item-card ${item.urgency === "CRITICAL" ? "critical" : item.urgency === "URGENT" ? "high" : "normal"}`}>
                      <div className={`req-blood-chip ${item.urgency === "CRITICAL" ? "critical" : item.urgency === "URGENT" ? "high" : "normal"}`}>
                        {item.blood_group_needed}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="req-card-top">
                          <div className="req-name">{item.patient_name} • Ping #{item.id}</div>
                          <span className={`req-urg-tag ${item.urgency === "CRITICAL" ? "critical" : item.urgency === "URGENT" ? "high" : "normal"}`}>
                            {item.urgency}
                          </span>
                        </div>
                        <div className="req-meta-line">#{index + 1} • {item.hospital_name} • Request #{item.request_id}</div>
                        {item.description ? <div className="req-meta-line">{item.description}</div> : null}
                        <div className="req-meta-line">Need by: {new Date(item.required_by_datetime).toLocaleString()}</div>
                        <div className="req-meta-line">Pinged at: {new Date(item.pinged_at).toLocaleString()}</div>
                        <div className="req-meta-line">Ping Status: {item.response_status}</div>
                        <textarea
                          className="input"
                          rows={2}
                          placeholder="Optional note to hospital (for example: arriving in 30 min)"
                          value={noteByPingId[item.id] ?? item.response_note ?? ""}
                          onChange={(event) =>
                            setNoteByPingId((prev) => ({ ...prev, [item.id]: event.target.value }))
                          }
                          disabled={item.response_status !== "PENDING" || respondingId === item.id}
                        />
                        <div className="actions compact-actions">
                          <button
                            className="btn btn-primary btn-action"
                            disabled={item.response_status !== "PENDING" || respondingId === item.id}
                            onClick={() =>
                              setConfirmState({
                                pingId: item.id,
                                responseStatus: "ACCEPTED",
                                title: "Confirm Acceptance",
                                description: `Accept ping #${item.id} for ${item.patient_name}? Hospital will be notified immediately.`,
                                confirmLabel: "Accept",
                              })
                            }
                          >
                            {respondingId === item.id ? "Working..." : item.response_status === "ACCEPTED" ? "Accepted" : "Accept"}
                          </button>
                          <button
                            className="btn btn-action"
                            disabled={item.response_status !== "PENDING" || respondingId === item.id}
                            onClick={() =>
                              setConfirmState({
                                pingId: item.id,
                                responseStatus: "DECLINED",
                                title: "Confirm Decline",
                                description: `Decline ping #${item.id} for ${item.patient_name}? Hospital will be notified immediately.`,
                                confirmLabel: "Decline",
                              })
                            }
                          >
                            {respondingId === item.id ? "Working..." : item.response_status === "DECLINED" ? "Declined" : "Decline"}
                          </button>
                          <Link href={`/dashboard/donor/inbox/${item.id}`} className="btn btn-subtle btn-action">Ping Detail</Link>
                          {item.can_open_request_detail ? (
                            <Link href={`/dashboard/requests/${item.request_id}`} className="btn btn-subtle btn-action">Open Request</Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="notice">No pings received yet.</div>
              )}
            </div>
          </div>
        </section>
      </main>
      <ConfirmModal
        isOpen={Boolean(confirmState)}
        title={confirmState?.title || "Confirm Response"}
        description={confirmState?.description || "Please confirm this action."}
        confirmLabel={confirmState?.confirmLabel || "Confirm"}
        loading={confirmLoading}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => void handleConfirmResponse()}
      />
    </RequireRole>
  );
}
