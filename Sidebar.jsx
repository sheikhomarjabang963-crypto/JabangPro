import React from "react";
import {
  LayoutDashboard, ShoppingCart, Package, Boxes, Users, ReceiptText,
  ShoppingBag, Wallet, Settings, Menu, LogOut
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const items = [
  ["dashboard", "Dashboard", LayoutDashboard, null],
  ["pos", "POS / Checkout", ShoppingCart, null],
  ["products", "Products", Package, "products"],
  ["inventory", "Inventory", Boxes, "inventory"],
  ["customers", "Customers", Users, null],
  ["sales", "Sales", ReceiptText, null],
  ["purchases", "Purchases", ShoppingBag, "purchases"],
  ["expenses", "Expenses", Wallet, "expenses"],
  ["settings", "Settings", Settings, null]
];

export default function Sidebar({ page, setPage, open, setOpen }) {
  const { hasModule, currentBusiness, role, signOut } = useAuth();

  const visible = items.filter(([id, , , module]) => {
    if (id === "settings") return role === "owner" || hasModule("settings");
    if (!module) return true; // always visible to any business member
    return hasModule(module);
  });

  return (
    <>
      <button className="mobile-menu" onClick={() => setOpen(!open)} aria-label="Open menu">
        <Menu size={22} />
      </button>
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">J</span>
          <div>
            <b>JabangPro</b>
            <small>{currentBusiness?.name || "Business Management"}</small>
          </div>
        </div>
        <nav>
          {visible.map(([id, label, Icon]) => (
            <button key={id} className={page === id ? "nav-item active" : "nav-item"} onClick={() => { setPage(id); setOpen(false); }}>
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
          <button className="nav-item" onClick={signOut}>
            <LogOut size={18} /><span>Sign out</span>
          </button>
        </nav>
      </aside>
    </>
  );
}
