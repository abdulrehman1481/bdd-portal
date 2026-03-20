import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="page">
      <section className="hero container">
        <div className="brand">BloodLink Real-Time Network</div>
        <h1 className="title">
          Every <span className="accent">drop</span> saves a life
        </h1>
        <p className="subtitle">
          BloodLink connects hospitals and donors in real-time with urgency ranking, geo-radius matching,
          and instant donor radar for critical blood requests.
        </p>
        <div className="actions">
          <Link href="/auth/signup" className="btn btn-primary">
            Sign Up
          </Link>
          <Link href="/auth/signin" className="btn">
            Sign In
          </Link>
          <a href="http://127.0.0.1:8000/api/docs/" className="btn" target="_blank" rel="noreferrer">
            Open API Docs
          </a>
        </div>

        <div className="grid kpis">
          <div className="card">
            <div className="label">Avg Match Time</div>
            <div className="value red">99s</div>
          </div>
          <div className="card">
            <div className="label">Active Donors</div>
            <div className="value">4.7K</div>
          </div>
          <div className="card">
            <div className="label">Hospitals</div>
            <div className="value amber">38</div>
          </div>
          <div className="card">
            <div className="label">Lives Saved</div>
            <div className="value green">12,940</div>
          </div>
        </div>

        <div className="split section">
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">For Hospitals</div>
            </div>
            <div style={{ padding: 16 }}>
              <p className="subtitle" style={{ fontSize: 14 }}>
                Create emergency requests, run donor radar, and dispatch matching in one command center.
              </p>
              <div className="actions">
                <Link href="/dashboard/hospital" className="btn btn-primary">
                  Open Hospital Dashboard
                </Link>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">For Donors</div>
            </div>
            <div style={{ padding: 16 }}>
              <p className="subtitle" style={{ fontSize: 14 }}>
                Keep profile and location updated, view nearby requests, and track 90-day eligibility.
              </p>
              <div className="actions">
                <Link href="/dashboard/donor" className="btn">
                  Open Donor Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
