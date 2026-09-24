import React, { useEffect, useState } from "react";
import { X, Printer } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getSaleForReceipt, getSaleItems, getSalePayments, getBusinessSettings } from "../lib/api";

const METHOD_LABELS = {
  cash: "Cash", card: "Card", qcell: "QCell", africell_money: "Africell Money",
  wave: "Wave", credit: "Credit"
};

export default function ReceiptModal({ saleId, onClose }) {
  const { currentBusinessId, currentBusiness } = useAuth();
  const [sale, setSale] = useState(null);
  const [items, setItems] = useState([]);
  const [payments, setPayments] = useState([]);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [s, it, pay, set] = await Promise.all([
          getSaleForReceipt(saleId),
          getSaleItems(saleId),
          getSalePayments(saleId),
          getBusinessSettings(currentBusinessId).catch(() => null)
        ]);
        if (cancelled) return;
        setSale(s);
        setItems(it || []);
        setPayments(pay || []);
        setSettings(set);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load receipt.");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [saleId, currentBusinessId]);

  const gmd = (n) => `GMD ${Number(n || 0).toFixed(2)}`;

  return (
    <div className="modal-overlay no-print">
      <div className="modal-box receipt-modal">
        <div className="modal-header no-print">
          <h3>Receipt</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {error && <div className="form-error">{error}</div>}

        {sale && (
          <div className="receipt-print">
            <div className="receipt-head">
              <b>{settings?.receipt_header || currentBusiness?.name || "JabangPro"}</b>
              <small>{new Date(sale.created_at).toLocaleString()}</small>
              <small>Receipt #{sale.id.slice(0, 8).toUpperCase()}</small>
              {sale.customers?.name && <small>Customer: {sale.customers.name}</small>}
              {sale.status === "void" && <small className="receipt-void">VOID</small>}
            </div>

            <div className="receipt-items">
              {items.map((it) => (
                <div className="receipt-line" key={it.id}>
                  <span>{it.products?.name} × {it.quantity}</span>
                  <span>{gmd(it.subtotal)}</span>
                </div>
              ))}
            </div>

            <div className="receipt-totals">
              <div className="receipt-line"><span>Subtotal</span><span>{gmd(sale.subtotal)}</span></div>
              {Number(sale.discount_value) > 0 && (
                <div className="receipt-line">
                  <span>Discount {sale.discount_type === "percent" ? `(${sale.discount_value}%)` : ""}</span>
                  <span>-{gmd(sale.subtotal - sale.total)}</span>
                </div>
              )}
              <div className="receipt-line receipt-grand"><span>Total</span><span>{gmd(sale.total)}</span></div>
            </div>

            <div className="receipt-payments">
              {payments.map((p) => (
                <div className="receipt-line" key={p.id}>
                  <span>{METHOD_LABELS[p.method] || p.method}</span>
                  <span>{gmd(p.amount)}</span>
                </div>
              ))}
            </div>

            {settings?.receipt_footer && <div className="receipt-footer">{settings.receipt_footer}</div>}
            <div className="receipt-footer muted">Thank you for your business.</div>
          </div>
        )}

        <div className="modal-actions no-print">
          <button className="complete-btn" disabled={!sale} onClick={() => window.print()}>
            <Printer size={15} /> Print
          </button>
          <button className="link-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
