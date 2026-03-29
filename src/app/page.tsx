"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

const TICKER_ITEMS = [
  "CRITICAL: O- Needed - Jinnah Hospital, Lahore",
  "4 Donors Matched - PIMS, Islamabad",
  "URGENT: AB+ Needed - Civil Hospital, Karachi",
  "132 Lives Saved This Week Across Pakistan",
  "HIGH: B- Request - Lady Reading Hospital, Peshawar",
  "New Hospital Joined - Nishtar Hospital, Multan",
];

function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const totalTrend = 92;
  const active = 44;
  const partial = 27;
  const fulfilled = 21;

  return (
    <main className="pk-landing">
      <nav className="pk-nav">
        <Link href="/" className="pk-logo" aria-label="BloodLink Pakistan Home">
          <div className="pk-logo-icon">
            <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 4C18 4 6 14 6 22C6 28.627 11.373 34 18 34C24.627 34 30 28.627 30 22C30 14 18 4 18 4Z" fill="#C8102E" />
              <path d="M18 10C18 10 11 17 11 22C11 25.866 14.134 29 18 29C21.866 29 25 25.866 25 22C25 17 18 10 18 10Z" fill="rgba(255,255,255,0.15)" />
              <line x1="18" y1="16" x2="18" y2="28" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
              <line x1="12" y1="22" x2="24" y2="22" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
            </svg>
          </div>
          <span className="pk-logo-text">BLOOD<span>LINK PK</span></span>
        </Link>

        <ul className="pk-nav-links">
          <li className="pk-nav-link-item"><a href="#how">How It Works</a></li>
          <li className="pk-nav-link-item"><a href="#donors">For Donors</a></li>
          <li className="pk-nav-link-item"><a href="#hospitals">For Hospitals</a></li>
          <li className="pk-nav-auth"><Link href="/auth/signup" className="pk-nav-cta">Sign Up</Link></li>
          <li className="pk-nav-auth"><Link href="/auth/signin" className="pk-nav-cta pk-nav-cta-secondary">Sign In</Link></li>
          <li className="pk-nav-theme">{mounted ? <ThemeToggle /> : null}</li>
        </ul>
      </nav>

      <section className="pk-hero">
        <div className="pk-hero-bg" />
        <div className="pk-hero-left">
          <div className="pk-hero-eyebrow">
            <div className="pk-eyebrow-line" />
            <span className="pk-eyebrow-text">Pakistan Real-Time Blood Matching Platform</span>
          </div>

          <h1 className="pk-hero-title">
            EVERY
            <span className="pk-line-accent">drop saves</span>
            A LIFE
          </h1>

          <p className="pk-hero-sub">
            BloodLink Pakistan connects critical patients with eligible donors in real-time using geolocation,
            blood group matching, and hospital coordination across Lahore, Karachi, Islamabad, Multan, and beyond.
          </p>

          <div className="pk-hero-actions">
            <Link href="/auth/signup" className="pk-btn-primary">Register As Donor</Link>
            <Link href="/download/apk" className="pk-btn-secondary">Download Android APK</Link>
            <Link href="/auth/signin" className="pk-btn-secondary">Hospital Portal</Link>
          </div>

          <div className="pk-hero-stats">
            <div className="pk-stat-item">
              <span className="pk-stat-num">7.9K</span>
              <span className="pk-stat-label">Active Donors</span>
            </div>
            <div className="pk-stat-item">
              <span className="pk-stat-num">64</span>
              <span className="pk-stat-label">Partner Hospitals</span>
            </div>
            <div className="pk-stat-item">
              <span className="pk-stat-num">88s</span>
              <span className="pk-stat-label">Avg Match Time</span>
            </div>
          </div>
        </div>

        <div className="pk-hero-right">
          <div className="pk-hero-visual">
            <div className="pk-blood-drop-container">
              <svg className="pk-blood-drop-svg" viewBox="0 0 120 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M60 8C60 8 18 43 18 75C18 98.196 36.804 117 60 117C83.196 117 102 98.196 102 75C102 43 60 8 60 8Z" fill="#C8102E" />
                <path d="M60 28C60 28 35 52 35 75C35 88.807 46.193 100 60 100C73.807 100 85 88.807 85 75C85 52 60 28 60 28Z" fill="rgba(255,255,255,0.16)" />
              </svg>
            </div>

            <div className="pk-map-overlay">
              <div className="pk-map-header">
                <span className="pk-map-label">Live Donor Matches</span>
                <span className="pk-map-badge">Lahore Radius 8km</span>
              </div>
              <div className="pk-donor-list">
                <div className="pk-donor-item">
                  <div className="pk-donor-avatar">AA</div>
                  <div className="pk-donor-info">
                    <div className="pk-donor-name">Ali Ahmed</div>
                    <div className="pk-donor-dist">1.3 km away</div>
                  </div>
                  <div className="pk-donor-type">O+</div>
                </div>
                <div className="pk-donor-item">
                  <div className="pk-donor-avatar">SZ</div>
                  <div className="pk-donor-info">
                    <div className="pk-donor-name">Sara Zain</div>
                    <div className="pk-donor-dist">2.1 km away</div>
                  </div>
                  <div className="pk-donor-type">A-</div>
                </div>
                <div className="pk-donor-item">
                  <div className="pk-donor-avatar">UF</div>
                  <div className="pk-donor-info">
                    <div className="pk-donor-name">Usman Farooq</div>
                    <div className="pk-donor-dist">2.9 km away</div>
                  </div>
                  <div className="pk-donor-type">B+</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="pk-ticker-bar">
        <div className="pk-ticker-inner">
          {TICKER_ITEMS.map((item, idx) => (
            <div key={`${item}-${idx}`} className="pk-ticker-item">
              <div className="pk-ticker-dot" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <section className="pk-section" id="how">
        <div className="pk-section-header pk-reveal">
          <div>
            <div className="pk-section-eyebrow">The System</div>
            <h2 className="pk-section-title">HOW IT<br /><em>Actually Works</em></h2>
          </div>
          <p className="pk-section-desc">
            From a critical request to a matched donor in under two minutes. This is the matching engine powering emergency response across Pakistan.
          </p>
        </div>

        <div className="pk-steps-grid pk-reveal">
          <article className="pk-step-card">
            <div className="pk-step-num">01</div>
            <h3 className="pk-step-title">Register And Verify</h3>
            <p className="pk-step-body">Donors verify through phone and profile details. Hospitals complete facility verification before accessing donor radar.</p>
          </article>
          <article className="pk-step-card">
            <div className="pk-step-num">02</div>
            <h3 className="pk-step-title">Request Created</h3>
            <p className="pk-step-body">Hospital teams add patient blood group, urgency, and required-by timing to trigger nearby matching.</p>
          </article>
          <article className="pk-step-card">
            <div className="pk-step-num">03</div>
            <h3 className="pk-step-title">Geo-Match Engine</h3>
            <p className="pk-step-body">Eligible donors are ranked by compatibility, distance, and readiness across configured city radii.</p>
          </article>
          <article className="pk-step-card">
            <div className="pk-step-num">04</div>
            <h3 className="pk-step-title">Instant SOS Pings</h3>
            <p className="pk-step-body">Top matches receive instant notifications. Accepted donors are routed directly to the requesting hospital.</p>
          </article>
        </div>
      </section>

      <section className="pk-roles-section" id="donors">
        <article className="pk-role-panel pk-reveal">
          <div className="pk-role-tag">For Donors</div>
          <h3 className="pk-role-title">BE THE HERO.</h3>
          <p className="pk-role-body">Register once and save lives when matched. BloodLink tracks your eligibility and notifies you when urgent requests appear nearby.</p>
          <ul className="pk-feature-list">
            <li className="pk-feature-item">Real-time proximity alerts for critical blood requests</li>
            <li className="pk-feature-item">Donation history and 90-day eligibility countdown</li>
            <li className="pk-feature-item">Request creation for family emergencies</li>
            <li className="pk-feature-item">Private and secure profile controls</li>
          </ul>
        </article>

        <article className="pk-role-panel pk-reveal" id="hospitals">
          <div className="pk-role-tag">For Hospitals</div>
          <h3 className="pk-role-title">COMMAND THE ROOM.</h3>
          <p className="pk-role-body">Operations dashboard for emergency teams. Manage active requests, run donor radar, and dispatch pings in one workspace.</p>
          <ul className="pk-feature-list">
            <li className="pk-feature-item">Create and prioritize high/critical requests</li>
            <li className="pk-feature-item">Radar search by city radius and blood group</li>
            <li className="pk-feature-item">Live request status from active to fulfilled</li>
            <li className="pk-feature-item">Centralized response coordination and analytics</li>
          </ul>
        </article>
      </section>

      <section className="pk-map-section pk-reveal">
        <div className="pk-section-header">
          <div>
            <div className="pk-section-eyebrow">Donor Radar</div>
            <h2 className="pk-section-title">FIND.<br /><em>MATCH.</em><br />SAVE.</h2>
          </div>
          <p className="pk-section-desc">Set geo-fence and blood group filters. The matching engine returns eligible donors ranked by distance.</p>
        </div>

        <div className="pk-trend-box">
          <div className="pk-trend-row">
            <span>Active</span>
            <div className="pk-trend-track"><div style={{ width: `${pct(active, totalTrend)}%` }} className="pk-trend-fill active" /></div>
            <strong>{active}</strong>
          </div>
          <div className="pk-trend-row">
            <span>Partial</span>
            <div className="pk-trend-track"><div style={{ width: `${pct(partial, totalTrend)}%` }} className="pk-trend-fill partial" /></div>
            <strong>{partial}</strong>
          </div>
          <div className="pk-trend-row">
            <span>Fulfilled</span>
            <div className="pk-trend-track"><div style={{ width: `${pct(fulfilled, totalTrend)}%` }} className="pk-trend-fill fulfilled" /></div>
            <strong>{fulfilled}</strong>
          </div>
        </div>
      </section>

      <section className="pk-cta-section">
        <h2 className="pk-cta-title pk-reveal">START<br /><span>SAVING</span><br />TODAY</h2>
        <p className="pk-cta-sub pk-reveal">Join BloodLink Pakistan as a donor or register your hospital and coordinate emergency blood response faster.</p>
        <div className="pk-btn-group pk-reveal">
          <Link href="/auth/signup" className="pk-btn-primary pk-btn-large">Register As Donor</Link>
          <Link href="/download/apk" className="pk-btn-outline">Get Android APK</Link>
          <Link href="/auth/signin" className="pk-btn-outline">Sign In</Link>
        </div>
      </section>

      <footer className="pk-footer">
        <div className="pk-footer-main">
          <div className="pk-logo-text">BLOOD<span>LINK PK</span></div>
          <p className="pk-footer-copy">© 2026 BloodLink Pakistan. Built for speed, built to save lives.</p>
        </div>
        <div className="pk-footer-contact">
          <a href="https://github.com/abdulrehman1481" target="_blank" rel="noreferrer">GitHub: abdulrehman1481</a>
          <a href="https://www.linkedin.com/in/abdul-rehman1481" target="_blank" rel="noreferrer">LinkedIn: abdul-rehman1481</a>
          <a href="mailto:abdulrehman10abd@gmail.com">Email: abdulrehman10abd@gmail.com</a>
          <a href="tel:+923059601481">Phone: 03059601481</a>
        </div>
      </footer>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        .pk-landing, .pk-landing * { box-sizing: border-box; }
        .pk-landing {
          --blood: #C8102E;
          --blood-deep: #8B0000;
          --blood-light: #E8314A;
          --obsidian: #0A0A0B;
          --charcoal: #141416;
          --slate: #1E1E22;
          --mist: #F5F2EE;
          --cream: #FAF8F5;
          --text-primary: #F5F2EE;
          --text-muted: rgba(245,242,238,0.58);
          background: var(--obsidian);
          color: var(--text-primary);
          font-family: 'DM Sans', sans-serif;
          overflow-x: hidden;
        }

        [data-theme='light'] .pk-landing {
          --obsidian: #F7F3ED;
          --charcoal: #FFFFFF;
          --slate: #EFE9E0;
          --mist: #17120E;
          --text-primary: #17120E;
          --text-muted: rgba(23,18,14,0.62);
          background: var(--obsidian);
        }

        .pk-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          padding: 24px 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: linear-gradient(to bottom, rgba(10,10,11,0.95), transparent);
        }

        [data-theme='light'] .pk-nav {
          background: linear-gradient(to bottom, rgba(247,243,237,0.97), transparent);
        }

        .pk-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }

        .pk-logo-icon {
          width: 36px;
          height: 36px;
        }

        .pk-logo-text {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 26px;
          letter-spacing: 3px;
          color: var(--mist);
        }

        .pk-logo-text span { color: var(--blood); }

        .pk-nav-links {
          list-style: none;
          display: flex;
          align-items: center;
          gap: 24px;
          margin: 0;
          padding: 0;
        }

        .pk-nav-links a {
          text-decoration: none;
          color: var(--text-muted);
          font-size: 12px;
          letter-spacing: 1.4px;
          text-transform: uppercase;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 36px;
        }

        .pk-nav-links a:hover { color: var(--mist); }

        .pk-nav-cta {
          background: var(--blood);
          color: #fff !important;
          padding: 10px 18px;
          border-radius: 2px;
          border: 1px solid transparent;
        }

        .pk-nav-cta-secondary {
          background: transparent;
          border: 1px solid rgba(245,242,238,0.22);
        }

        [data-theme='light'] .pk-nav-cta-secondary {
          border-color: rgba(23,18,14,0.22);
          color: var(--text-primary) !important;
        }

        .pk-nav .theme-toggle {
          width: 36px;
          height: 36px;
          border: 1px solid rgba(245,242,238,0.18);
          background: rgba(255,255,255,0.04);
          color: var(--text-primary);
        }

        .pk-hero {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          position: relative;
          overflow: hidden;
        }

        .pk-hero-bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 80% 60% at 65% 50%, rgba(139,0,0,0.15) 0%, transparent 70%);
          pointer-events: none;
        }

        .pk-hero-left {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 140px 60px 80px;
          position: relative;
          z-index: 2;
        }

        .pk-hero-eyebrow {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 32px;
        }

        .pk-eyebrow-line {
          width: 40px;
          height: 1px;
          background: var(--blood);
        }

        .pk-eyebrow-text {
          font-size: 11px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: var(--blood-light);
        }

        .pk-hero-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(72px, 8vw, 120px);
          line-height: 0.92;
          letter-spacing: 2px;
          margin-bottom: 32px;
        }

        .pk-line-accent {
          color: var(--blood);
          display: block;
          font-style: italic;
          font-family: 'Playfair Display', serif;
          font-size: 0.7em;
          letter-spacing: 4px;
        }

        .pk-hero-sub {
          font-size: 16px;
          line-height: 1.7;
          color: var(--text-muted);
          max-width: 520px;
          margin-bottom: 48px;
        }

        .pk-hero-actions {
          display: flex;
          gap: 16px;
          align-items: center;
        }

        .pk-btn-primary, .pk-btn-outline {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          text-transform: uppercase;
          letter-spacing: 2px;
          border-radius: 2px;
          font-size: 13px;
          padding: 16px 32px;
        }

        .pk-btn-primary {
          background: var(--blood);
          color: #fff;
        }

        .pk-btn-primary:hover { background: var(--blood-light); }

        .pk-btn-secondary {
          color: var(--text-muted);
          border-bottom: 1px solid rgba(245,242,238,0.15);
          padding: 12px 8px;
          text-decoration: none;
          font-size: 13px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }

        .pk-hero-stats {
          display: flex;
          gap: 48px;
          margin-top: 64px;
          padding-top: 48px;
          border-top: 1px solid rgba(245,242,238,0.08);
        }

        .pk-stat-item { display: flex; flex-direction: column; gap: 4px; }

        .pk-stat-num {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 42px;
          color: var(--blood-light);
          line-height: 1;
        }

        .pk-stat-label {
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .pk-hero-right {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          z-index: 2;
        }

        .pk-hero-visual {
          position: relative;
          width: 420px;
          height: 420px;
        }

        .pk-blood-drop-container {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -55%);
        }

        .pk-blood-drop-svg {
          width: 180px;
          filter: drop-shadow(0 20px 60px rgba(200,16,46,0.5));
        }

        .pk-map-overlay {
          position: absolute;
          bottom: 10px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(20,20,22,0.9);
          border: 1px solid rgba(200,16,46,0.2);
          border-radius: 12px;
          padding: 16px 24px;
          width: 320px;
          backdrop-filter: blur(20px);
        }

        [data-theme='light'] .pk-map-overlay {
          background: rgba(255,255,255,0.94);
        }

        .pk-map-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .pk-map-label {
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .pk-map-badge {
          background: rgba(200,16,46,0.2);
          border: 1px solid rgba(200,16,46,0.4);
          color: var(--blood-light);
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 10px;
        }

        .pk-donor-list { display: flex; flex-direction: column; gap: 8px; }
        .pk-donor-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          border-radius: 6px;
          background: rgba(245,242,238,0.03);
        }
        .pk-donor-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--blood-deep), var(--blood));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 500;
        }
        .pk-donor-info { flex: 1; }
        .pk-donor-name { font-size: 12px; font-weight: 500; }
        .pk-donor-dist { font-size: 10px; color: var(--text-muted); }
        .pk-donor-type {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 16px;
          color: var(--blood-light);
        }

        .pk-ticker-bar {
          background: var(--blood);
          padding: 12px 0;
          overflow: hidden;
          position: relative;
          z-index: 3;
        }

        .pk-ticker-inner {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          white-space: nowrap;
        }

        .pk-ticker-item {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 12px;
          letter-spacing: 2px;
          text-transform: uppercase;
          padding: 0 32px;
          flex-shrink: 0;
          color: rgba(255,255,255,0.92);
        }

        .pk-ticker-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: rgba(255,255,255,0.5);
        }

        .pk-section {
          padding: 110px 60px;
          position: relative;
          z-index: 2;
        }

        .pk-section-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 60px;
        }

        .pk-section-eyebrow {
          font-size: 10px;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: var(--blood-light);
          margin-bottom: 16px;
        }

        .pk-section-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(48px, 5vw, 72px);
          letter-spacing: 2px;
          line-height: 0.95;
        }

        .pk-section-title em {
          font-family: 'Playfair Display', serif;
          font-style: italic;
          color: var(--text-muted);
          font-size: 0.85em;
        }

        .pk-section-desc {
          font-size: 15px;
          color: var(--text-muted);
          max-width: 360px;
          line-height: 1.7;
        }

        .pk-steps-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: rgba(245,242,238,0.06);
          border: 1px solid rgba(245,242,238,0.06);
        }

        .pk-step-card {
          background: var(--charcoal);
          padding: 44px 30px;
          min-height: 260px;
        }

        .pk-step-num {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 74px;
          color: rgba(200,16,46,0.15);
          margin-bottom: 14px;
          line-height: 1;
        }

        .pk-step-title {
          font-size: 18px;
          margin-bottom: 10px;
        }

        .pk-step-body {
          color: var(--text-muted);
          line-height: 1.7;
          font-size: 14px;
        }

        .pk-roles-section {
          padding: 0 60px 110px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2px;
          background: rgba(245,242,238,0.04);
        }

        .pk-role-panel {
          padding: 70px 54px;
          background: var(--charcoal);
        }

        .pk-role-tag {
          display: inline-flex;
          background: rgba(200,16,46,0.12);
          border: 1px solid rgba(200,16,46,0.25);
          color: var(--blood-light);
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
          padding: 6px 14px;
          margin-bottom: 24px;
        }

        .pk-role-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 52px;
          line-height: 1;
          margin-bottom: 20px;
        }

        .pk-role-body {
          color: var(--text-muted);
          line-height: 1.7;
          margin-bottom: 30px;
          max-width: 420px;
        }

        .pk-feature-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 10px;
        }

        .pk-feature-item {
          color: var(--text-primary);
          font-size: 14px;
          padding-left: 20px;
          position: relative;
        }

        .pk-feature-item::before {
          content: '';
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--blood-light);
          position: absolute;
          left: 0;
          top: 8px;
        }

        .pk-map-section {
          padding: 100px 60px;
          background: var(--slate);
        }

        .pk-trend-box {
          background: var(--charcoal);
          border: 1px solid rgba(245,242,238,0.08);
          border-radius: 12px;
          padding: 24px;
          display: grid;
          gap: 16px;
        }

        .pk-trend-row {
          display: grid;
          grid-template-columns: 80px 1fr 40px;
          gap: 12px;
          align-items: center;
          font-size: 13px;
        }

        .pk-trend-track {
          width: 100%;
          height: 10px;
          background: rgba(255,255,255,0.08);
          border-radius: 999px;
          overflow: hidden;
        }

        .pk-trend-fill {
          height: 100%;
          border-radius: 999px;
        }

        .pk-trend-fill.active { background: #f97316; }
        .pk-trend-fill.partial { background: #facc15; }
        .pk-trend-fill.fulfilled { background: #22c55e; }

        .pk-cta-section {
          padding: 110px 60px;
          text-align: center;
          position: relative;
        }

        .pk-cta-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(60px, 7vw, 100px);
          letter-spacing: 3px;
          line-height: 0.92;
          margin-bottom: 24px;
        }

        .pk-cta-title span { color: var(--blood); }

        .pk-cta-sub {
          color: var(--text-muted);
          max-width: 560px;
          margin: 0 auto 38px;
          line-height: 1.7;
        }

        .pk-btn-group {
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .pk-btn-large { padding: 20px 52px; }

        .pk-btn-outline {
          border: 1px solid rgba(245,242,238,0.2);
          color: var(--mist);
          padding: 20px 52px;
        }

        .pk-footer {
          padding: 48px 60px;
          border-top: 1px solid rgba(245,242,238,0.08);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .pk-footer-main {
          display: grid;
          gap: 8px;
        }

        .pk-footer-copy {
          font-size: 13px;
          color: var(--text-muted);
        }

        .pk-footer-contact {
          display: grid;
          gap: 6px;
          text-align: right;
          font-size: 12px;
          letter-spacing: 0.04em;
        }

        .pk-footer-contact a {
          color: var(--text-muted);
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .pk-footer-contact a:hover {
          color: var(--blood-light);
        }

        .pk-reveal {
          opacity: 1;
          transform: none;
        }

        @media (max-width: 980px) {
          .pk-hero {
            grid-template-columns: 1fr;
          }

          .pk-hero-right {
            display: none;
          }

          .pk-nav {
            padding: 16px 18px;
          }

          .pk-logo-text {
            font-size: 22px;
            letter-spacing: 2px;
          }

          .pk-nav-links {
            gap: 8px;
          }

          .pk-nav-link-item,
          .pk-nav-theme {
            display: none;
          }

          .pk-nav-cta {
            padding: 9px 12px;
            font-size: 11px;
            letter-spacing: 1px;
            min-height: 34px;
          }

          .pk-hero-left,
          .pk-section,
          .pk-map-section,
          .pk-cta-section {
            padding-left: 24px;
            padding-right: 24px;
          }

          .pk-hero-actions {
            flex-wrap: wrap;
          }

          .pk-steps-grid {
            grid-template-columns: 1fr 1fr;
          }

          .pk-roles-section {
            grid-template-columns: 1fr;
            padding: 0 24px 80px;
          }

          .pk-footer {
            flex-direction: column;
            text-align: center;
            padding: 36px 24px;
          }

          .pk-footer-contact {
            text-align: center;
          }
        }

        @media (max-width: 640px) {
          .pk-nav {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
            padding: 12px;
            background: rgba(10,10,11,0.94);
          }

          [data-theme='light'] .pk-nav {
            background: rgba(247,243,237,0.98);
          }

          .pk-logo {
            width: 100%;
          }

          .pk-nav-links {
            width: 100%;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 8px;
          }

          .pk-nav-auth {
            flex: 1 1 calc(50% - 4px);
          }

          .pk-nav-auth .pk-nav-cta {
            width: 100%;
            text-align: center;
          }

          .pk-hero-left {
            padding-top: 170px;
          }

          .pk-hero-actions {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }

          .pk-hero-actions .pk-btn-primary,
          .pk-hero-actions .pk-btn-secondary {
            width: 100%;
            justify-content: center;
            text-align: center;
          }

          .pk-hero-actions .pk-btn-secondary {
            border: 1px solid rgba(245,242,238,0.22);
            border-radius: 2px;
          }

          [data-theme='light'] .pk-hero-actions .pk-btn-secondary {
            border-color: rgba(23,18,14,0.22);
          }

          .pk-hero-stats {
            gap: 18px;
            flex-wrap: wrap;
            margin-top: 36px;
            padding-top: 28px;
          }

          .pk-steps-grid {
            grid-template-columns: 1fr;
          }

          .pk-btn-group {
            width: 100%;
          }

          .pk-btn-group .pk-btn-primary,
          .pk-btn-group .pk-btn-outline {
            width: 100%;
            padding: 16px 18px;
          }
        }
      `}</style>
    </main>
  );
}
