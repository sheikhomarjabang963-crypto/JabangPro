import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getBusinessSettings, updateBusinessSettings, listMembers, addMember,
  updateManagerPermissions, updateMemberRole, removeMember, MODULES
} from "../lib/api";

const MODULE_LABELS = {
  products: "Products", inventory: "Inventory", customers: "Customers", sales: "Sales",
  purchases: "Purchases", expenses: "Expenses", reports: "Reports (Dashboard)", settings: "Settings"
};

export default function Settings() {
  const { currentBusinessId, role, hasModule } = useAuth();
  const isOwner = role === "owner";
  const canSeeSettings = isOwner || hasModule("settings");

  const [settings, setSettings] = useState(null);
  const [header, setHeader] = useState("");
  const [footer, setFooter] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [members, setMembers] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("cashier");
  const [newPerms, setNewPerms] = useState({});

  const load = async () => {
    if (!currentBusinessId) return;
    if (canSeeSettings) {
      const s = await getBusinessSettings(currentBusinessId).catch(() => null);
      setSettings(s);
      setHeader(s?.receipt_header || "");
      setFooter(s?.receipt_footer || "");
    }
    if (isOwner) {
      const m = await listMembers(currentBusinessId).catch(() => []);
      setMembers(m || []);
    }
  };

  useEffect(() => { load(); }, [currentBusinessId, isOwner, canSeeSettings]);

  const saveSettings = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await updateBusinessSettings(currentBusinessId, { receipt_header: header, receipt_footer: footer });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitNewMember = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await addMember(currentBusinessId, newEmail, newRole, newRole === "manager" ? newPerms : {});
      setNewEmail(""); setNewRole("cashier"); setNewPerms({});
      await load();
    } catch (err) {
      setError(err.message || "Could not add staff member.");
    } finally {
      setBusy(false);
    }
  };

  const togglePermission = (member, module) => {
    const updated = { ...member.permissions, [module]: !member.permissions[module] };
    setMembers(members.map(m => m.id === member.id ? { ...m, permissions: updated } : m));
  };

  const savePermissions = async (member) => {
    setBusy(true);
    setError("");
    try {
      await updateManagerPermissions(member.id, member.permissions);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (member, role) => {
    setBusy(true);
    setError("");
    try {
      await updateMemberRole(member.id, role);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (member) => {
    setBusy(true);
    setError("");
    try {
      await removeMember(member.id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!canSeeSettings) {
    return (
      <section className="page">
        <div className="page-heading"><div><h1>Settings</h1></div></div>
        <p>You don't have access to Settings.</p>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-heading"><div><h1>Settings</h1><p>Business profile, receipts and staff.</p></div></div>
      {error && <div className="form-error">{error}</div>}

      <form className="card form-grid" onSubmit={saveSettings}>
        <h3 className="span-2">Receipt Settings</h3>
        <label className="span-2">Receipt Header<input value={header} onChange={e => setHeader(e.target.value)} /></label>
        <label className="span-2">Receipt Footer<input value={footer} onChange={e => setFooter(e.target.value)} /></label>
        <div className="span-2"><small className="muted">Currency: {settings?.currency || "GMD"}</small></div>
        <button className="complete-btn small span-2" disabled={busy} type="submit">Save</button>
      </form>

      {isOwner && (
        <>
          <form className="card" onSubmit={submitNewMember}>
            <h3>Add Staff Member</h3>
            <p className="muted">The person must already have a JabangPro account (sign up first).</p>
            <div className="form-grid">
              <label>Email<input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} /></label>
              <label>Role
                <select value={newRole} onChange={e => setNewRole(e.target.value)}>
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                </select>
              </label>
            </div>
            {newRole === "manager" && (
              <div className="chip-row">
                {MODULES.map(m => (
                  <label key={m} className="checkbox-chip">
                    <input type="checkbox" checked={Boolean(newPerms[m])} onChange={e => setNewPerms({ ...newPerms, [m]: e.target.checked })} />
                    {MODULE_LABELS[m]}
                  </label>
                ))}
              </div>
            )}
            <button className="complete-btn small" disabled={busy} type="submit">Add Member</button>
          </form>

          <div className="card">
            <h3>Staff ({members.length})</h3>
            {members.map(m => (
              <div className="staff-row" key={m.id}>
                <div className="staff-head">
                  <b>{m.profiles?.full_name || m.profiles?.email}</b>
                  <small className="muted">{m.profiles?.email}</small>
                  <select value={m.role} onChange={e => changeRole(m, e.target.value)} disabled={m.role === "owner"}>
                    {m.role === "owner" ? <option value="owner">Owner</option> : (
                      <>
                        <option value="manager">Manager</option>
                        <option value="cashier">Cashier</option>
                      </>
                    )}
                  </select>
                  {m.role !== "owner" && <button className="link-btn" onClick={() => handleRemove(m)}>Remove</button>}
                </div>
                {m.role === "manager" && (
                  <div className="chip-row">
                    {MODULES.map(mod => (
                      <label key={mod} className="checkbox-chip">
                        <input type="checkbox" checked={Boolean(m.permissions?.[mod])} onChange={() => togglePermission(m, mod)} />
                        {MODULE_LABELS[mod]}
                      </label>
                    ))}
                    <button className="complete-btn small" disabled={busy} onClick={() => savePermissions(m)}>Save Permissions</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
