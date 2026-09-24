import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { listInventory, adjustInventory } from "../lib/api";

export default function Inventory() {
  const { currentBusinessId, currentBranch } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [adjusting, setAdjusting] = useState(null); // product_id
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!currentBusinessId || !currentBranch) return;
    try {
      const data = await listInventory(currentBusinessId, currentBranch.id);
      setRows(data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, [currentBusinessId, currentBranch]);

  const submitAdjust = async (productId) => {
    if (!amount) return;
    setBusy(true);
    setError("");
    try {
      await adjustInventory(currentBusinessId, currentBranch.id, productId, Number(amount), reason || "manual adjustment");
      setAdjusting(null);
      setAmount("");
      setReason("");
      await load();
    } catch (err) {
      setError(err.message || "Could not adjust inventory.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page">
      <div className="page-heading"><div><h1>Inventory</h1><p>Current stock by product. Stock moves automatically from purchases, sales and returns.</p></div></div>
      {error && <div className="form-error">{error}</div>}
      <div className="card">
        <table className="data-table">
          <thead><tr><th>Product</th><th>SKU</th><th>Quantity</th><th>Low Stock At</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.products?.name}</td>
                <td>{r.products?.sku || "—"}</td>
                <td className={Number(r.quantity) <= Number(r.products?.low_stock_threshold || 0) ? "low-stock" : ""}>{r.quantity}</td>
                <td>{r.products?.low_stock_threshold}</td>
                <td>
                  {adjusting === r.product_id ? (
                    <span className="inline-form">
                      <input type="number" placeholder="+/- qty" style={{ width: 80 }} value={amount} onChange={e => setAmount(e.target.value)} />
                      <input placeholder="Reason" style={{ width: 120 }} value={reason} onChange={e => setReason(e.target.value)} />
                      <button className="complete-btn small" disabled={busy} onClick={() => submitAdjust(r.product_id)}>Save</button>
                      <button className="link-btn" onClick={() => setAdjusting(null)}>Cancel</button>
                    </span>
                  ) : (
                    <button className="link-btn" onClick={() => setAdjusting(r.product_id)}>Adjust</button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5}>No inventory yet — record a purchase to stock products.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
