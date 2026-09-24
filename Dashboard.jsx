import React, { useEffect, useState } from "react";
import { AlertTriangle, ShoppingCart, Wallet, Users, TrendingUp } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getDashboardSummary, getMySales } from "../lib/api";

export default function Dashboard() {
  const { currentBusinessId, currentBranch, hasModule, role } = useAuth();
  const [summary, setSummary] = useState(null);
  const [mySales, setMySales] = useState(null);
  const [error, setError] = useState("");
  const canSeeReports = role === "owner" || hasModule("reports");

  useEffect(() => {
    if (!currentBusinessId || !currentBranch) return;
    setError("");
    if (canSeeReports) {
      getDashboardSummary(currentBusinessId, currentBranch.id)
        .then(setSummary)
        .catch((err) => setError(err.message));
    } else {
      getMySales(currentBusinessId)
        .then(setMySales)
        .catch((err) => setError(err.message));
    }
  }, [currentBusinessId, currentBranch, canSeeReports]);

  const gmd = (n) => `GMD ${Number(n || 0).toFixed(2)}`;

  if (error) {
    return (
      <section className="page">
        <div className="page-heading"><div><h1>Dashboard</h1></div></div>
        <div className="form-error">{error}</div>
      </section>
    );
  }

  if (!canSeeReports) {
    const total = (mySales || []).reduce((s, x) => s + Number(x.total), 0);
    return (
      <section className="page">
        <div className="page-heading"><div><h1>Dashboard</h1><p>Your sales summary.</p></div></div>
        <div className="stats">
          <div className="stat"><ShoppingCart /><span>Your Total Sales</span><b>{gmd(total)}</b></div>
          <div className="stat"><ShoppingCart /><span>Sales Count</span><b>{(mySales || []).length}</b></div>
        </div>
        <div className="card mt">
          <h3>Your Recent Sales</h3>
          {(mySales || []).length === 0 && <p>No sales yet.</p>}
          {(mySales || []).slice(0, 10).map((s) => (
            <div className="list-row" key={s.sale_id}>
              <span>{new Date(s.created_at).toLocaleString()}<small>{s.status}</small></span>
              <b>{gmd(s.total)}</b>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="page">
        <div className="page-heading"><div><h1>Dashboard</h1></div></div>
        <p>Loading...</p>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-heading"><div><h1>Dashboard</h1><p>Business overview and performance.</p></div></div>
      <div className="stats">
        <div className="stat"><ShoppingCart /><span>Sales Today</span><b>{gmd(summary.sales_today)}</b></div>
        <div className="stat"><TrendingUp /><span>Sales This Week</span><b>{gmd(summary.sales_week)}</b></div>
        <div className="stat"><TrendingUp /><span>Sales This Month</span><b>{gmd(summary.sales_month)}</b></div>
        <div className="stat"><Wallet /><span>Expenses This Month</span><b>{gmd(summary.expenses_month)}</b></div>
        <div className="stat"><Users /><span>Outstanding Credit</span><b>{gmd(summary.outstanding_credit)}</b></div>
        <div className="stat"><AlertTriangle /><span>Low Stock Items</span><b>{(summary.low_stock || []).length}</b></div>
      </div>
      <div className="dashboard-grid">
        <div className="card">
          <h3><AlertTriangle size={17} /> Low Stock</h3>
          {(summary.low_stock || []).length === 0 && <p>Everything is above its low-stock threshold.</p>}
          {(summary.low_stock || []).map((p) => (
            <div className="list-row" key={p.product_id}>
              <span>{p.name}</span>
              <b>{p.quantity}</b>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Summary</h3>
          <div className="list-row"><span>Sales this month</span><b>{gmd(summary.sales_month)}</b></div>
          <div className="list-row"><span>Expenses this month</span><b>{gmd(summary.expenses_month)}</b></div>
          <div className="list-row"><span>Estimated profit</span><b>{gmd(summary.sales_month - summary.expenses_month)}</b></div>
        </div>
      </div>
    </section>
  );
}
