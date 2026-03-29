"use client";

import { FormEvent, useState } from "react";

type UploadState = {
  type: "idle" | "loading" | "success" | "error";
  message: string;
};

export default function ApkUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>({ type: "idle", message: "" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setState({ type: "error", message: "Please choose an APK file first." });
      return;
    }

    setState({ type: "loading", message: "Preparing secure upload URL..." });

    try {
      const metaResponse = await fetch("/api/apk/upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/vnd.android.package-archive",
          size: file.size,
        }),
      });

      const metaPayload = (await metaResponse.json()) as {
        detail?: string;
        uploadUrl?: string;
        uploadMethod?: string;
        requiredContentType?: string;
      };

      if (!metaResponse.ok || !metaPayload.uploadUrl) {
        throw new Error(metaPayload.detail || "Failed to create upload URL.");
      }

      setState({ type: "loading", message: "Uploading file directly to R2..." });

      const uploadResponse = await fetch(metaPayload.uploadUrl, {
        method: metaPayload.uploadMethod || "PUT",
        headers: {
          "Content-Type": metaPayload.requiredContentType || "application/vnd.android.package-archive",
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload to R2 failed. Check bucket CORS and credentials.");
      }

      setState({
        type: "success",
        message: "Upload complete. Your public download page now serves the latest APK.",
      });
      setFile(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setState({ type: "error", message });
    }
  }

  return (
    <main className="upload-page">
      <section className="upload-card">
        <p className="upload-tag">Secure Route Only</p>
        <h1>APK Upload Console</h1>
        <p className="upload-subtitle">
          This route is protected with HTTP Basic Auth. Uploading replaces the object configured in
          R2_APK_OBJECT_KEY and sends the file directly to R2 using a short-lived signed URL.
        </p>

        <form onSubmit={onSubmit} className="upload-form">
          <label htmlFor="apk-file">Choose APK file</label>
          <input
            id="apk-file"
            name="apk-file"
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            required
          />
          <button type="submit" disabled={state.type === "loading"}>
            {state.type === "loading" ? "Uploading..." : "Upload APK"}
          </button>
        </form>

        <div className={`upload-status ${state.type}`} aria-live="polite">
          {state.message || "Ready."}
        </div>

        <a href="/download/apk" className="upload-link">
          Open public download page
        </a>
      </section>

      <style jsx>{`
        .upload-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 20px;
          background: radial-gradient(circle at 20% 20%, rgba(200, 16, 46, 0.16), transparent 45%), #08090b;
          color: #f3f4f6;
        }

        .upload-card {
          width: min(640px, 100%);
          background: rgba(16, 18, 22, 0.92);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 16px 46px rgba(0, 0, 0, 0.45);
        }

        .upload-tag {
          display: inline-block;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 6px 10px;
          border-radius: 999px;
          color: #ffb3be;
          border: 1px solid rgba(255, 87, 110, 0.4);
          background: rgba(200, 16, 46, 0.2);
        }

        h1 {
          margin: 12px 0 8px;
          font-size: clamp(28px, 4vw, 36px);
        }

        .upload-subtitle {
          color: rgba(243, 244, 246, 0.75);
          margin-bottom: 18px;
        }

        .upload-form {
          display: grid;
          gap: 10px;
        }

        label {
          font-weight: 600;
        }

        input[type="file"] {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.14);
          color: #f3f4f6;
          border-radius: 10px;
          padding: 12px;
        }

        button {
          margin-top: 8px;
          border: none;
          border-radius: 10px;
          padding: 12px 16px;
          font-weight: 700;
          color: #fff;
          background: linear-gradient(135deg, #c8102e, #8b0000);
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .upload-status {
          margin-top: 12px;
          border-radius: 10px;
          padding: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
        }

        .upload-status.success {
          border-color: rgba(46, 204, 113, 0.5);
          background: rgba(46, 204, 113, 0.15);
        }

        .upload-status.error {
          border-color: rgba(255, 99, 99, 0.5);
          background: rgba(255, 99, 99, 0.15);
        }

        .upload-link {
          margin-top: 12px;
          display: inline-flex;
          color: #ffd1d8;
          text-decoration: underline;
        }
      `}</style>
    </main>
  );
}
