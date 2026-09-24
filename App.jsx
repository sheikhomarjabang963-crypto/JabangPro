import React, { useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Inventory from "./pages/Inventory";
import Customers from "./pages/Customers";
import Sales from "./pages/Sales";
import Purchases from "./pages/Purchases";
import Expenses from "./pages/Expenses";
import Settings from "./pages/Settings";
import AuthPage from "./pages/Auth/AuthPage";
import ApplyBusiness from "./pages/Onboarding/ApplyBusiness";
import SuperAdminDashboard from "./pages/SuperAdmin/SuperAdminDashboard";
import { useAuth } from "./context/AuthContext";
import "./styles/app.css";

function BusinessApp() {
  const [page, setPage] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const { hasModule, role } = useAuth();

  const canSeePage = {
    dashboard: true,
    pos: true,
    products: hasModule("products"),
    inventory: hasModule("inventory"),
    customers: true,
    sales: true,
    purchases: hasModule("purchases"),
    expenses: hasModule("expenses"),
    settings: role === "owner" || hasModule("settings")
  };

  const render = () => {
    if (!canSeePage[page]) return <Dashboard />;
    if (page === "dashboard") return <Dashboard />;
    if (page === "pos") return <POS />;
    if (page === "products") return <Products />;
    if (page === "inventory") return <Inventory />;
    if (page === "customers") return <Customers />;
    if (page === "sales") return <Sales />;
    if (page === "purchases") return <Purchases />;
    if (page === "expenses") return <Expenses />;
    if (page === "settings") return <Settings />;
    return <Dashboard />;
  };

  return (
    <div className="app">
      <Sidebar page={page} setPage={setPage} open={menuOpen} setOpen={setMenuOpen} />
      <main className="main">
        <Topbar />
        {render()}
      </main>
    </div>
  );
}

export default function App() {
  const { loading, session, isSuperAdmin, memberships } = useAuth();

  if (loading) {
    return (
      <div className="auth-page">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session) return <AuthPage />;
  if (isSuperAdmin) return <SuperAdminDashboard />;
  if (memberships.length === 0) return <ApplyBusiness />;
  return <BusinessApp />;
}
