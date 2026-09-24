import React, { useEffect, useState } from "react";
import { LogOut, Check, X, Pause, Play } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  listApplications,
  approveApplication,
  rejectApplication,
  listBusinesses,
  suspendBusiness,
  reactivateBusiness
} from "../../lib/api";

export default function SuperAdminDashboard() {
  const { signOut } = useAuth();
  const [tab, setTab] = useState("applications");
  const [applications, setApplications] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setError("");
    try {
      const [apps, biz] = await Promise.all([listApplications(), listBusinesses()]);
      setApplications(apps || []);
      setBusinesses(biz || []);
    } catch (err) {
      setError(err.message || "Failed to load data.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (fn, id) => {
    setBusyId(id);
    setError("");
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message || "Action failed.");
    } finally {
      setBusyId(null);
    }
  };

  const pending = applications.filter((a) => a.status === "pending");
  const reviewed = applications.filter((a) => a.status !== "pending");

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">J</span>
          <div>
            <b>JabangPro</b>
            <small>Super Admin</small>
          </div>
        </div>
        <nav>
          <button className={tab === "applications" ? "nav-item active" : "nav-item"} onClick={() => setTab("applications")}>
            <span>Applications {pending.length ? `(${pending.length})` : ""}</span>
          </button>
          <button className={tab === "businesses" ? "nav-item active" : "nav-item"} onClick={() => setTab("businesses")}>
            <span>Businesses</span>
          </button>
          <button className="nav-item" onClick={signOut}>
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="mobile-title">Super Admin</div>
        </header>
        <section className="page">
          <div className="page-heading">
            <div>
              <h1>{tab === "applications" ? "Business Applications" : "Businesses"}</h1>
              <p>{tab === "applications" ? "Approve or reject new business requests." : "Manage business status."}</p>
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          {tab === "applications" && (
            <div className="card">
              <h3>Pending ({pending.length})</h3>
              {pending.length === 0 && <p>No pending applications.</p>}
              {pending.map((a) => (
                <div className="list-row wide" key={a.id}>
                  <span>
                    <b>{a.business_name}</b>
                    <small>
                      {a.contact_name} · {a.email} {a.phone ? `· ${a.phone}` : ""}
                    </small>
                  </span>
                  <span className="row-actions">
                    <button
                      className="icon-action good"
                      disabled={busyId === a.id}
                      onClick={() => act(() => approveApplication(a.id), a.id)}
                    >
                      <Check size={15} /> Approve
                    </button>
                    <button
                      className="icon-action bad"
                      disabled={busyId === a.id}
                      onClick={() => act(() => rejectApplication(a.id, "Not approved"), a.id)}
                    >
                      <X size={15} /> Reject
                    </button>
                  </span>
                </div>
              ))}

              <h3 className="mt">Reviewed</h3>
              {reviewed.map((a) => (
                <div className="list-row wide" key={a.id}>
                  <span>
                    <b>{a.business_name}</b>
                    <small>{a.contact_name}</small>
                  </span>
                  <span className={`status-pill ${a.status}`}>{a.status}</span>
                </div>
              ))}
            </div>
          )}

          {tab === "businesses" && (
            <div className="card">
              {businesses.length === 0 && <p>No businesses yet.</p>}
              {businesses.map((b) => (
                <div className="list-row wide" key={b.id}>
                  <span>
                    <b>{b.name}</b>
                    <small>
                      Trial ends {b.trial_end ? new Date(b.trial_end).toLocaleDateString() : "—"} · {b.payment_status}
                    </small>
                  </span>
                  <span className="row-actions">
                    <span className={`status-pill ${b.status}`}>{b.status}</span>
                    {b.status === "suspended" ? (
                      <button
                        className="icon-action good"
                        disabled={busyId === b.id}
                        onClick={() => act(() => reactivateBusiness(b.id), b.id)}
                      >
                        <Play size={15} /> Reactivate
                      </button>
                    ) : (
                      <button
                        className="icon-action bad"
                        disabled={busyId === b.id}
                        onClick={() => act(() => suspendBusiness(b.id), b.id)}
                      >
                        <Pause size={15} /> Suspend
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
