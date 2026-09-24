import React, { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { listSales, getMySales, getSaleItems, voidSale, createReturn } from "../lib/api";
import ReceiptModal from "../components/ReceiptModal";

export default function Sales() {
  const { currentBusinessId, hasModule, role } = useAuth();
  const canManage = role === "owner" || hasModule("sales");
  const [sales, setSales] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [receiptSaleId, setReceiptSaleId] = useState(null);

  const load = async () => {
    if (!currentBusinessId) return;
    try {
      const data = canManage ? await listSales(currentBusinessId) : await getMySales(currentBusinessId);
      setSales(data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, [currentBusinessId, canManage]);

  const toggleExpand = async (sale) => {
    const id = sale.id || sale.sale_id;
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    const rows = await getSaleItems(id).catch(() => []);
    setItems(rows || []);
  };

  const handleVoid = async (saleId) => {
    setBusy(true);
    setError("");
    try {
      await voidSale(saleId, "Voided by staff");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReturn = async (saleId) => {
    setBusy(true);
    setError("");
    try {
      const saleItems = await getSaleItems(saleId);
      const returnItems = saleItems.map(si => ({
        sale_item_id: si.id, quantity: si.quantity, refund_amount: si.subtotal
      }));
      await createReturn(saleId, returnItems, "Full return");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page">
      <div className="page-heading"><div><h1>Sales</h1><p>{canManage ? "All completed sales." : "Your sales."}</p></div></div>
      {error && <div className="form-error">{error}</div>}
      <div className="card">
        <table className="data-table">
          <thead><tr><th>Date</th>{canManage && <th>Customer</th>}<th>Total</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {sales.map(s => {
              const id = s.id || s.sale_id;
              return (
                <React.Fragment key={id}>
                  <tr>
                    <td>{new Date(s.created_at).toLocaleString()}</td>
                    {canManage && <td>{s.customers?.name || "Walk-in"}</td>}
                    <td>GMD {Number(s.total).toFixed(2)}</td>
                    <td><span className={`status-pill ${s.status}`}>{s.status}</span></td>
                    <td className="row-actions">
                      <button className="link-btn" onClick={() => toggleExpand(s)}>{expanded === id ? "Hide" : "View"}</button>
                      <button className="link-btn" onClick={() => setReceiptSaleId(id)}><Printer size={13} /> Receipt</button>
                      {canManage && s.status === "completed" && (
                        <>
                          <button className="link-btn" disabled={busy} onClick={() => handleVoid(id)}>Void</button>
                          <button className="link-btn" disabled={busy} onClick={() => handleReturn(id)}>Full Return</button>
                        </>
                      )}
                    </td>
                  </tr>
                  {expanded === id && (
                    <tr><td colSpan={canManage ? 5 : 4}>
                      <div className="sub-table">
                        {items.map(it => (
                          <div className="list-row" key={it.id}>
                            <span>{it.products?.name} × {it.quantity}</span>
                            <b>GMD {Number(it.subtotal).toFixed(2)}</b>
                          </div>
                        ))}
                        {items.length === 0 && <p>No items.</p>}
                      </div>
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
            {sales.length === 0 && <tr><td colSpan={canManage ? 5 : 4}>No sales yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {receiptSaleId && <ReceiptModal saleId={receiptSaleId} onClose={() => setReceiptSaleId(null)} />}
    </section>
  );
}
