import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import ReviewsPage from './pages/ReviewsPage';
import AlertsPage from './pages/AlertsPage';
import IngestPage from './pages/IngestPage';

function Sidebar() {
  const linkStyle = ({ isActive }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 16px',
    borderRadius: '8px',
    color: isActive ? '#fff' : 'var(--text-muted)',
    background: isActive ? 'var(--primary)' : 'transparent',
    fontWeight: isActive ? 600 : 400,
    fontSize: '13px',
    transition: 'all 0.15s',
    marginBottom: '2px',
  });

  return (
    <nav style={{
      width: 240,
      minHeight: '100vh',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      padding: '24px 12px',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '0 8px 28px', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 16, color: '#fff',
          }}>S</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '0.08em', color: 'var(--text)' }}>SYNAPSE</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>REVIEW INTELLIGENCE</div>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.1em', padding: '0 8px 8px', textTransform: 'uppercase' }}>Navigation</div>
        <NavLink to="/" end style={linkStyle}>
          <HomeIcon /> Dashboard
        </NavLink>
        <NavLink to="/reviews" style={linkStyle}>
          <ListIcon /> Reviews
        </NavLink>
        <NavLink to="/alerts" style={linkStyle}>
          <BellIcon /> Alerts
        </NavLink>
        <NavLink to="/ingest" style={linkStyle}>
          <UploadIcon /> Ingest
        </NavLink>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, fontSize: 11, color: 'var(--text-muted)', padding: '12px 8px 0' }}>
        Synapse v1.0
      </div>
    </nav>
  );
}

/* Inline SVG icons */
function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <main style={{ marginLeft: 240, flex: 1, minHeight: '100vh', padding: '28px 32px', background: 'var(--bg)' }}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/reviews" element={<ReviewsPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/ingest" element={<IngestPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
