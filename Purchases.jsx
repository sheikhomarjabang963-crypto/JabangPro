import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { listPurchases, createPurchase, listProducts } from "../lib/api";

export default function Purchases() {
  const { currentBusinessId, currentBranch } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [lines, setLines] = useState([{ product_id: "", quantity: "", cost_price: "" }]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!currentBusinessId) return;
    const [p, prod] = await Promise.all([listPurchases(currentBusinessId), listProducts(currentBusinessId)]);
    setPurchases(p || []);
    setProducts(prod || []);
  };

  useEffect(() => { load(); }, [currentBusinessId]);

  const updateLine = (i, patch) => setLines(lines.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const addLine = () => setLines([...lines, { product_id: "", quantity: "", cost_price: "" }]);
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const items = lines
        .filter(l => l.product_id && l.quantity)
        .map(l => ({ product_id: l.product_id, quantity: Number(l.quantity), cost_price: Number(l.cost_price) || 0 }));
      if (items.length === 0) throw new Error("Add at least one product line.");
      await createPurchase(currentBusinessId, currentBranch.id, items, date);
      setLines([{ product_id: "", quantity: "", cost_price: "" }]);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message || "Could not record purchase.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page">
      <div className="page-heading">
        <div><h1>Purchases</h1><p>Record stock purchases. No supplier tracking.</p></div>
        <button className="complete-btn small" onClick={() => setShowForm(!showForm)}>
          <Plus size={15} /> {showForm ? "Close" : "New Purchase"}
        </button>
      </div>
      {error && <div className="form-error">{error}</div>}

      {showForm && (
        <form className="card" onSubmit={submit}>
          <label className="block">Date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          {lines.map((l, i) => (
            <div className="purchase-line" key={i}>
              <select value={l.product_id} onChange={e => updateLine(i, { product_id: e.target.value })} required>
                <option value="">Select product</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" placeholder="Qty" value={l.quantity} onChange={e => updateLine(i, { quantity: e.target.value })} required />
              <input type="number" step="0.01" placeholder="Cost price" value={l.cost_price} onChange={e => updateLine(i, { cost_price: e.target.value })} required />
              {lines.length > 1 && <button type="button" className="icon-btn" onClick={() => removeLine(i)}><Trash2 size={14} /></button>}
            </div>
          ))}
          <button type="button" className="link-btn" onClick={addLine}>+ Add another product</button>
          <button className="complete-btn" disabled={busy} type="submit">{busy ? "Saving..." : "Record Purchase"}</button>
        </form>
      )}

      <div className="card">
        <h3>Purchase History</h3>
        {purchases.map(p => (
          <div key={p.id} className="sub-table">
            <div className="list-row"><span><b>{p.purchase_date}</b></span><b>GMD {Number(p.total).toFixed(2)}</b></div>
            {(p.purchase_items || []).map((it, idx) => (
              <div className="list-row" key={idx}><span>{it.products?.name} × {it.quantity}</span><small>GMD {Number(it.subtotal).toFixed(2)}</small></div>
            ))}
          </div>
        ))}
        {purchases.length === 0 && <p>No purchases yet.</p>}
      </div>
    </section>
  );
}
