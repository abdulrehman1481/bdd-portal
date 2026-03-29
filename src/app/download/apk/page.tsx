"use client";

import Link from "next/link";

const apkMeta = {
  name: "BloodLink Android",
  fileName: "bloodlink.apk",
  size: "68.25 MB",
  updated: "29 Mar 2026",
  android: "Android 8.0+",
};

export default function ApkDownloadPage() {
  return (
    <main className="apk-page">
      <section className="apk-shell">
        <p className="apk-tag">Official Release</p>
        <h1>Download BloodLink APK</h1>
        <p className="apk-subtitle">
          Install the latest BloodLink mobile app directly on Android. The file is served from private cloud
          storage using a secure temporary link.
        </p>

        <div className="apk-card" role="region" aria-label="APK details">
          <div className="apk-row">
            <span>App</span>
            <strong>{apkMeta.name}</strong>
          </div>
          <div className="apk-row">
            <span>File</span>
            <strong>{apkMeta.fileName}</strong>
          </div>
          <div className="apk-row">
            <span>Size</span>
            <strong>{apkMeta.size}</strong>
          </div>
          <div className="apk-row">
            <span>Updated</span>
            <strong>{apkMeta.updated}</strong>
          </div>
          <div className="apk-row">
            <span>Min Android</span>
            <strong>{apkMeta.android}</strong>
          </div>
        </div>

        <div className="apk-actions">
          <a href="/api/apk/download" className="apk-btn apk-btn-primary">
            Download APK
          </a>
          <Link href="/" className="apk-btn apk-btn-ghost">
            Back to Home
          </Link>
        </div>

        <p className="apk-note">
          If download does not start, refresh this page and click again. Download links expire automatically for
          security.
        </p>
      </section>

      <style jsx>{`
        .apk-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 28px 16px;
          background:
            radial-gradient(circle at 15% 15%, rgba(200, 16, 46, 0.12), transparent 42%),
            radial-gradient(circle at 85% 80%, rgba(139, 0, 0, 0.16), transparent 45%),
            #0b0c0e;
          color: #f4f5f7;
        }

        .apk-shell {
          width: min(720px, 100%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 18px;
          background: rgba(20, 22, 27, 0.88);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
          padding: 30px;
          backdrop-filter: blur(6px);
        }

        .apk-tag {
          display: inline-flex;
          border: 1px solid rgba(232, 25, 42, 0.38);
          color: #ffb2bc;
          background: rgba(200, 16, 46, 0.18);
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          margin: 14px 0 10px;
          font-size: clamp(30px, 5vw, 44px);
          line-height: 1.1;
        }

        .apk-subtitle {
          color: rgba(244, 245, 247, 0.76);
          margin-bottom: 20px;
          max-width: 60ch;
        }

        .apk-card {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          background: rgba(8, 10, 13, 0.6);
          padding: 16px;
          display: grid;
          gap: 10px;
        }

        .apk-row {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.11);
          padding-bottom: 9px;
        }

        .apk-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .apk-row span {
          color: rgba(244, 245, 247, 0.68);
          font-size: 14px;
        }

        .apk-row strong {
          font-weight: 600;
          text-align: right;
        }

        .apk-actions {
          margin-top: 20px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .apk-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 18px;
          border-radius: 10px;
          font-weight: 600;
          border: 1px solid transparent;
          text-decoration: none;
        }

        .apk-btn-primary {
          color: #ffffff;
          background: linear-gradient(135deg, #c8102e, #8b0000);
          box-shadow: 0 8px 25px rgba(200, 16, 46, 0.35);
        }

        .apk-btn-primary:hover {
          filter: brightness(1.05);
        }

        .apk-btn-ghost {
          color: #f4f5f7;
          border-color: rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.04);
        }

        .apk-note {
          margin-top: 14px;
          color: rgba(244, 245, 247, 0.65);
          font-size: 13px;
        }

        @media (max-width: 640px) {
          .apk-shell {
            padding: 20px;
          }

          .apk-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }

          .apk-row strong {
            text-align: left;
          }

          .apk-btn {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
