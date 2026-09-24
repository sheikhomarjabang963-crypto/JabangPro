import React from "react";
import { useAuth } from "../context/AuthContext";

const roleLabel = { owner: "Owner", manager: "Manager", cashier: "Cashier" };

export default function Topbar() {
  const { profile, role, memberships, currentBusinessId, switchBusiness } = useAuth();
  const initials = (profile?.full_name || profile?.email || "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="topbar">
      <div className="mobile-title">JabangPro</div>
      {memberships.length > 1 && (
        <select
          className="business-switch"
          value={currentBusinessId || ""}
          onChange={(e) => switchBusiness(e.target.value)}
        >
          {memberships.map((m) => (
            <option key={m.business_id} value={m.business_id}>
              {m.businesses?.name}
            </option>
          ))}
        </select>
      )}
      <div className="topbar-user">
        <span className="role-pill">{roleLabel[role] || role}</span>
        <div className="avatar" title={profile?.email}>{initials}</div>
      </div>
    </header>
  );
}
