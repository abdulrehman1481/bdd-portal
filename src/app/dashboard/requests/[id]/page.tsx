"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BloodRequest,
  createRequestAction,
  createRequestComment,
  deleteRequestComment,
  getMe,
  getRequestActions,
  getRequestById,
  getRequestComments,
  RequestAction,
  RequestActionPayload,
  RequestComment,
  updateRequestStatus,
  UserRole,
} from "@/lib/api";
import { RequireRole } from "@/components/AuthGuards";
import ConfirmModal from "@/components/ConfirmModal";
import ToastStack from "@/components/ToastStack";
import ThemeToggle from "@/components/ThemeToggle";
import { getStoredToken } from "@/lib/session";
import { useToastQueue } from "@/lib/useToastQueue";

const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false });

type ConfirmState = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
} | null;

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const requestId = Number(params.id);

  const [token, setToken] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [requestItem, setRequestItem] = useState<BloodRequest | null>(null);
  const [actions, setActions] = useState<RequestAction[]>([]);
  const [comments, setComments] = useState<RequestComment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const { toasts, pushToast, dismissToast } = useToastQueue();

  const isOwner = useMemo(() => (requestItem ? requestItem.requester === userId : false), [requestItem, userId]);
  const isActionable = useMemo(
    () => (requestItem ? requestItem.status === "ACTIVE" || requestItem.status === "PARTIAL" : false),
    [requestItem]
  );
  const myActionTypes = useMemo(() => {
    if (!userId) return new Set<RequestActionPayload["action_type"]>();
    const taken = actions
      .filter((item) => item.actor === userId)
      .map((item) => item.action_type as RequestActionPayload["action_type"]);
    return new Set<RequestActionPayload["action_type"]>(taken);
  }, [actions, userId]);

  useEffect(() => {
    const activeToken = getStoredToken();
    if (!activeToken) return;
    setToken(activeToken);
    void loadData(activeToken);
  }, []);

  async function loadData(activeToken: string) {
    if (!requestId || Number.isNaN(requestId)) return;

    setLoading(true);
    setMessage("");
    try {
      const [me, detail, actionList, commentList] = await Promise.all([
        getMe(activeToken),
        getRequestById(activeToken, requestId),
        getRequestActions(activeToken, requestId),
        getRequestComments(activeToken, requestId),
      ]);
      setUserId(me.id);
      setRole(me.role);
      setRequestItem(detail);
      setActions(actionList);
      setComments(commentList);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to load request details.";
      setMessage(text);
      pushToast("error", text);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusUpdate(status: "ACTIVE" | "PARTIAL" | "FULFILLED" | "CLOSED") {
    if (!token || !requestItem) return;
    setConfirmState({
      title: "Confirm Status Update",
      description: `Are you sure you want to mark this request as ${status}?`,
      confirmLabel: `Mark ${status}`,
      onConfirm: async () => {
        setLoading(true);
        try {
          await updateRequestStatus(token, requestItem.id, { status });
          await loadData(token);
          pushToast("success", `Request updated to ${status}.`);
        } catch (error) {
          pushToast("error", error instanceof Error ? error.message : "Failed to update status.");
        } finally {
          setLoading(false);
        }
      },
    });
  }

  async function handleAction(actionType: RequestActionPayload["action_type"]) {
    if (!token || !requestItem) return;
    if (myActionTypes.has(actionType)) {
      pushToast("info", `You already sent ${actionType.toLowerCase()} for this request.`);
      return;
    }

    setConfirmState({
      title: `Confirm ${actionType}`,
      description: `Proceed with ${actionType.toLowerCase()} for this request?`,
      confirmLabel: actionType,
      onConfirm: async () => {
        setLoading(true);
        try {
          await createRequestAction(token, requestItem.id, {
            action_type: actionType,
            note: actionType === "FLAG" ? "Flagged during detail review" : "Responded from detail page",
          });
          await loadData(token);
          pushToast("success", `Action submitted: ${actionType}.`);
        } catch (error) {
          pushToast("error", error instanceof Error ? error.message : "Failed to submit action.");
        } finally {
          setLoading(false);
        }
      },
    });
  }

  async function handleConfirmProceed() {
    if (!confirmState) return;
    setConfirmLoading(true);
    await confirmState.onConfirm();
    setConfirmLoading(false);
    setConfirmState(null);
  }

  async function handlePostComment() {
    if (!token || !commentInput.trim() || !requestItem) return;
    setPostingComment(true);
    try {
      const newComment = await createRequestComment(token, requestItem.id, {
        message: commentInput.trim(),
      });
      setComments((prev) => [newComment, ...prev]);
      setCommentInput("");
      pushToast("success", "Comment posted successfully.");
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Failed to post comment.");
    } finally {
      setPostingComment(false);
    }
  }

  async function handleDeleteComment(commentId: number) {
    if (!token) return;
    try {
      await deleteRequestComment(token, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      pushToast("success", "Comment deleted successfully.");
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : "Failed to delete comment.");
    }
  }
    return (
    <RequireRole roles={["DONOR", "HOSPITAL", "ADMIN"]}>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <main className="page">
        <section className="container hero">
          <div className="dashboard-topbar section">
            <div className="topbar-logo">BloodLink</div>
            <div style={{ flex: 1 }}></div>
            <div className="topbar-right">
              <ThemeToggle />
              <button className="btn" onClick={() => router.back()}>Back</button>
            </div>
          </div>
          <div className="dash-top">
            <div>
              <div className="brand">Request Detail</div>
              <h1 className="title dashboard-title">
                Request <span className="accent">Overview</span>
              </h1>
              <p className="subtitle">Track status, monitor user actions, and respond quickly from one dedicated detail page.</p>
            </div>
            <div className="actions">
              <button className="btn" onClick={() => router.back()}>Back</button>
              <Link href={role === "HOSPITAL" ? "/dashboard/hospital?tab=requests" : "/dashboard/donor?tab=requests"} className="btn btn-primary">
                Open Request Tab
              </Link>
            </div>
          </div>

          {message ? <div className="notice section">{message}</div> : null}

          {!requestItem ? (
            <div className="panel section">
              <div style={{ padding: 16 }} className="notice">{loading ? "Loading request details..." : message || "Request not found."}</div>
            </div>
          ) : (
            <>
              {/* REQUEST HEADER WITH KEY INFO */}
              <div className="request-header section">
                <div className="request-header-top">
                  <div className="request-title-group">
                    <div className="request-patient">{requestItem.patient_name}</div>
                    <div className="request-meta-top">
                      <div className="request-hospital">{requestItem.hospital_name}</div>
                      <div className="request-datetime">{new Date(requestItem.required_by_datetime).toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                <div className="request-header-bottom">
                  <div className="request-stat">
                    <div className="request-stat-label">Blood Group</div>
                    <div className="request-stat-value">{requestItem.blood_group_needed}</div>
                  </div>

                  <div className="request-stat">
                    <div className="request-stat-label">Urgency Level</div>
                    <div className="request-stat-value" className={requestItem.urgency === "CRITICAL" ? "critical" : requestItem.urgency === "URGENT" ? "urgent" : "fulfilled"}>
                      {requestItem.urgency}
                    </div>
                  </div>

                  <div className="request-stat">
                    <div className="request-stat-label">Current Status</div>
                    <div>
                      <span className={`request-stat-badge ${requestItem.status === "FULFILLED" || requestItem.status === "CLOSED" ? "fulfilled" : requestItem.status === "ACTIVE" ? "urgent" : "critical"}`}>
                        {requestItem.status}
                      </span>
                    </div>
                  </div>

                  <div className="request-stat">
                    <div className="request-stat-label">Units Fulfilled</div>
                    <div className="request-stat-value">{requestItem.units_fulfilled}/{requestItem.units_required}</div>
                    <div className="request-progress-section" style={{ marginTop: 8 }}>
                      <div className="request-progress-bar">
                        <div className="request-progress-fill" style={{ width: `${Math.min((requestItem.units_fulfilled / requestItem.units_required) * 100, 100)}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="section">
                <div className="actions" style={{ gap: 10 }}>
                  {isActionable ? (
                    isOwner ? (
                      <>
                        <button className="btn btn-success" onClick={() => void handleStatusUpdate("FULFILLED")} disabled={loading}>Mark as Fulfilled</button>
                        <button className="btn btn-danger-soft" onClick={() => void handleStatusUpdate("CLOSED")} disabled={loading}>Close Request</button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn btn-primary"
                          onClick={() => void handleAction("VOLUNTEER")}
                          disabled={loading}
                        >
                          {myActionTypes.has("VOLUNTEER") ? "✓ Volunteer Sent" : "Volunteer to Donate"}
                        </button>
                        <button
                          className="btn"
                          onClick={() => void handleAction("SUPPORT")}
                          disabled={loading}
                        >
                          {myActionTypes.has("SUPPORT") ? "✓ Support Sent" : "Support/Share"}
                        </button>
                        <button
                          className="btn btn-subtle"
                          onClick={() => void handleAction("FLAG")}
                          disabled={loading}
                        >
                          {myActionTypes.has("FLAG") ? "🚩 Flagged" : "Flag Issue"}
                        </button>
                      </>
                    )
                  ) : (
                    <div className="badge resolved">✓ Request {requestItem.status}</div>
                  )}
                  <button className="btn" onClick={() => void loadData(token)} disabled={loading} style={{ marginLeft: "auto" }}>Refresh</button>
                </div>
              </div>

              {/* INFO CARDS GRID */}
              {requestItem.description && (
                <div className="request-info-grid section">
                  <div className="request-info-card">
                    <div className="request-info-card-title">📝 Description</div>
                    <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6 }}>{requestItem.description}</div>
                  </div>
                </div>
              )}

              <div className="panel section">
                <div className="panel-head"><div className="panel-title">Map</div></div>
                <div style={{ padding: 12 }}>
                  <LiveMap
                    center={requestItem.location}
                    points={[
                      {
                        id: requestItem.id,
                        label: `${requestItem.patient_name} (${requestItem.blood_group_needed})`,
                        lat: requestItem.location.lat,
                        lng: requestItem.location.lng,
                        color: requestItem.urgency === "CRITICAL" ? "#e83b55" : requestItem.urgency === "URGENT" ? "#f59e0b" : "#3b82f6",
                      },
                    ]}
                    height={520}
                    selectedPointId={requestItem.id}
                    buffers={[
                      {
                        id: `request-buffer-${requestItem.id}`,
                        lat: requestItem.location.lat,
                        lng: requestItem.location.lng,
                        radiusMeters: 2000,
                        color: "#ef4444",
                        fillOpacity: 0.1,
                        label: "Request response zone: 2 km",
                      },
                    ]}
                  />
                </div>
              </div>

              {/* ACTIVITY TIMELINE */}
              <div className="section">
                <div style={{ marginBottom: 16 }}>
                  <div className="brand">📋 Activity Log</div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: "var(--text)" }}>Request Timeline</h2>
                </div>
                <div className="activity-timeline-wrapper">
                  {actions.length ? (
                    actions.map((item) => (
                      <div key={item.id} className="timeline-item">
                        <div className="timeline-dot"></div>
                        <div className="timeline-content">
                          <div className="timeline-timestamp">{new Date(item.created_at).toLocaleString()}</div>
                          <div className="timeline-action">
                            <span className="request-stat-badge critical" style={{ margin: 0 }}>{item.action_type}</span>
                            <span className="timeline-actor">by {item.actor_email}</span>
                          </div>
                          {item.note && <div className="timeline-note">{item.note}</div>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>No activity yet</div>
                  )}
                </div>
              </div>

              {/* COMMENTS SECTION */}
              <div className="section">
                <div style={{ marginBottom: 16 }}>
                  <div className="brand">💬 Comments</div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: "var(--text)" }}>Discussion</h2>
                </div>
                <div className="comments-section">
                  <div className="comment-input-wrapper">
                    <textarea
                      className="comment-textarea"
                      placeholder="Add a comment or note about this request..."
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      disabled={postingComment}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={() => void handlePostComment()}
                      disabled={postingComment || !commentInput.trim()}
                      style={{ marginTop: 12 }}
                    >
                      {postingComment ? "Posting..." : "Post Comment"}
                    </button>
                  </div>

                  {comments.length > 0 && (
                    <>
                      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", fontWeight: 600, marginBottom: 12, fontFamily: "var(--font-head)" }}>Comments ({comments.length})</div>
                        <div className="comments-list">
                          {comments.map((comment) => (
                            <div key={comment.id} className="comment-item">
                              <div className="comment-header">
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span className="comment-author">{comment.author_first_name}</span>
                                  <span className="comment-role">{comment.author_role}</span>
                                </div>
                                <span className="comment-time">{new Date(comment.created_at).toLocaleString()}</span>
                              </div>
                              <div className="comment-text">{comment.message}</div>
                              {comment.author === userId && (
                                <button
                                  className="comment-delete-btn"
                                  onClick={() => void handleDeleteComment(comment.id)}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {comments.length === 0 && commentInput.trim() === "" && (
                    <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: 13 }}>
                      No comments yet. Be the first to comment!
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
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
