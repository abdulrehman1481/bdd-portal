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
            <div className="topbar-search-wrap"><input className="topbar-search-input" placeholder="Search request actions..." /></div>
            <div className="topbar-right">
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
              <div className="split section">
                <div className="panel">
                  <div className="panel-head"><div className="panel-title">Request Info</div></div>
                  <div style={{ padding: 14 }}>
                    <div className="notice"><strong>Patient:</strong> {requestItem.patient_name}</div>
                    <div className="notice"><strong>Blood Group:</strong> {requestItem.blood_group_needed}</div>
                    {requestItem.description ? <div className="notice"><strong>Description:</strong> {requestItem.description}</div> : null}
                    <div className="notice"><strong>Urgency:</strong> {requestItem.urgency}</div>
                    <div className="notice"><strong>Status:</strong> {requestItem.status}</div>
                    <div className="notice"><strong>Units:</strong> {requestItem.units_fulfilled}/{requestItem.units_required}</div>
                    <div className="notice"><strong>Required By:</strong> {new Date(requestItem.required_by_datetime).toLocaleString()}</div>
                    <div className="notice"><strong>Center:</strong> {requestItem.hospital_name}</div>
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-head"><div className="panel-title">Actions</div></div>
                  <div style={{ padding: 14 }}>
                    {isActionable ? (
                      isOwner ? (
                        <div className="actions compact-actions">
                          <button className="btn btn-primary" onClick={() => void handleStatusUpdate("FULFILLED")} disabled={loading}>Mark as Fulfilled</button>
                          <button className="btn" onClick={() => void handleStatusUpdate("CLOSED")} disabled={loading}>No Longer Needed / Close</button>
                        </div>
                      ) : (
                        <div className="actions compact-actions">
                          <button
                            className="btn btn-primary"
                            onClick={() => void handleAction("VOLUNTEER")}
                            disabled={loading}
                          >
                            {myActionTypes.has("VOLUNTEER") ? "Volunteer Sent" : "Volunteer to Donate"}
                          </button>
                          <button
                            className="btn"
                            onClick={() => void handleAction("SUPPORT")}
                            disabled={loading}
                          >
                            {myActionTypes.has("SUPPORT") ? "Support Sent" : "Support/Share"}
                          </button>
                          <button
                            className="btn btn-subtle"
                            onClick={() => void handleAction("FLAG")}
                            disabled={loading}
                          >
                            {myActionTypes.has("FLAG") ? "Flagged" : "Flag"}
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="badge resolved">Resolved • {requestItem.status}</div>
                    )}
                    <div className="actions compact-actions" style={{ marginTop: 10 }}>
                      <button className="btn" onClick={() => void loadData(token)} disabled={loading}>Refresh Activity</button>
                      <Link href={role === "HOSPITAL" ? "/dashboard/hospital?tab=requests" : "/dashboard/donor?tab=requests"} className="btn btn-primary">
                        Back to Requests
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

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

              <div className="panel section">
                <div className="panel-head"><div className="panel-title">Activity Timeline</div></div>
                <table className="table">
                  <thead>
                    <tr><th>When</th><th>User</th><th>Role</th><th>Action</th><th>Note</th></tr>
                  </thead>
                  <tbody>
                    {actions.length ? (
                      actions.map((item) => (
                        <tr key={item.id}>
                          <td>{new Date(item.created_at).toLocaleString()}</td>
                          <td>{item.actor_email}</td>
                          <td>{item.actor_role}</td>
                          <td>{item.action_type}</td>
                          <td>{item.note || "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={5}>No actions yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="panel section">
                <div className="panel-head"><div className="panel-title">Comments</div></div>
                <div style={{ padding: 14 }}>
                  <div style={{ marginBottom: 12 }}>
                    <textarea
                      className="input"
                      placeholder="Add a comment..."
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      rows={3}
                      disabled={postingComment}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={() => void handlePostComment()}
                      disabled={postingComment || !commentInput.trim()}
                      style={{ marginTop: 8 }}
                    >
                      {postingComment ? "Posting..." : "Post Comment"}
                    </button>
                  </div>

                  {comments.length ? (
                    <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
                      {comments.map((comment) => (
                        <div key={comment.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #f3f4f6" }}>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>
                            {comment.author_first_name} ({comment.author_role})
                          </div>
                          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                            {new Date(comment.created_at).toLocaleString()}
                          </div>
                          <div style={{ marginBottom: 8 }}>{comment.message}</div>
                          {comment.author === userId && (
                            <button
                              className="btn btn-subtle"
                              style={{ fontSize: 12 }}
                              onClick={() => void handleDeleteComment(comment.id)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="notice">No comments yet. Be the first to comment!</div>
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
