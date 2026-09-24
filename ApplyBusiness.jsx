import React, { useState } from "react";
import { submitApplication } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function ApplyBusiness() {
  const { application, profile, user, refresh, signOut } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (application && application.status === "pending") {
    return (
      <StatusScreen
        title="Application submitted"
        message={`Your request for "${application.business_name}" is awaiting Super Admin approval. You'll be able to sign in to your business as soon as it's approved.`}
        onSignOut={signOut}
      />
    );
  }

  if (application && application.status === "rejected") {
    return (
      <StatusScreen
        title="Application not approved"
        message={`Your previous request for "${application.business_name}" was not approved. You can submit a new request below.`}
        onSignOut={signOut}
      >
        <ApplicationForm
          businessName={businessName}
          setBusinessName={setBusinessName}
          contactName={contactName}
          setContactName={setContactName}
          phone={phone}
          setPhone={setPhone}
          error={error}
          busy={busy}
          onSubmit={handleSubmit}
        />
      </StatusScreen>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await submitApplication({ businessName, contactName, phone, email: user.email });
      await refresh();
    } catch (err) {
      setError(err.message || "Could not submit application.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand auth-brand">
          <span className="brand-mark">J</span>
          <div>
            <b>JabangPro</b>
            <small>Business Management</small>
          </div>
        </div>
        <h1>Set up your business</h1>
        <p className="auth-sub">Tell us about your business and a Super Admin will review your request.</p>
        <ApplicationForm
          businessName={businessName}
          setBusinessName={setBusinessName}
          contactName={contactName}
          setContactName={setContactName}
          phone={phone}
          setPhone={setPhone}
          error={error}
          busy={busy}
          onSubmit={handleSubmit}
        />
        <button type="button" className="link-btn auth-toggle" onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}

function ApplicationForm({ businessName, setBusinessName, contactName, setContactName, phone, setPhone, error, busy, onSubmit }) {
  return (
    <form onSubmit={onSubmit}>
      <label>
        Business name
        <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
      </label>
      <label>
        Contact name
        <input value={contactName} onChange={(e) => setContactName(e.target.value)} required />
      </label>
      <label>
        Phone
        <input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button className="complete-btn auth-submit" disabled={busy} type="submit">
        {busy ? "Submitting..." : "Submit request"}
      </button>
    </form>
  );
}

function StatusScreen({ title, message, children, onSignOut }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand auth-brand">
          <span className="brand-mark">J</span>
          <div>
            <b>JabangPro</b>
            <small>Business Management</small>
          </div>
        </div>
        <h1>{title}</h1>
        <p className="auth-sub">{message}</p>
        {children}
        <button type="button" className="link-btn auth-toggle" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
