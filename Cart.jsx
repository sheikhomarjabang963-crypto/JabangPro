import React from "react";
import { Trash2, Minus, Plus, UserRound } from "lucide-react";

const METHODS = [
  ["cash", "Cash"], ["card", "Card"], ["qcell", "QCell"],
  ["africell_money", "Africell Money"], ["wave", "Wave"]
];

export default function Cart({
  cart, setCart, discount, setDiscount, customers, customerId, setCustomerId,
  payment, setPayment, onComplete, busy, message
}) {
  const subtotal = cart.reduce((s, x) => s + x.price * x.qty, 0);
  const discountAmount = Math.max(0, Math.min(subtotal, discount.type === "percent" ? subtotal * (discount.value / 100) : discount.value));
  const total = subtotal - discountAmount;
  const needsCustomer = payment === "credit" && !customerId;

  const changeQty = (id, delta) => setCart(cart.map(x => x.id === id ? { ...x, qty: Math.max(1, x.qty + delta) } : x));
  const remove = id => setCart(cart.filter(x => x.id !== id));

  const selectedCustomer = customers.find(c => c.id === customerId);

  return (
    <section className="cart-panel">
      <div className="panel-title">Cart <span>({cart.length} items)</span><button className="link-btn" onClick={() => setCart([])}>Clear Cart</button></div>
      {message && <div className="success">{message}</div>}
      <div className="cart-items">
        {cart.length === 0 ? <div className="empty-cart">Your cart is empty.<br /><small>Select or scan a product to begin.</small></div> :
          cart.map(item => (
            <div className="cart-item" key={item.id}>
              <div className="cart-main">
                <b>{item.name}</b><small>GMD {item.price.toFixed(2)}</small>
                <div className="qty">
                  <button onClick={() => changeQty(item.id, -1)}><Minus size={13} /></button>
                  <span>{item.qty}</span>
                  <button onClick={() => changeQty(item.id, 1)} disabled={item.qty >= item.stock}><Plus size={13} /></button>
                </div>
              </div>
              <div className="cart-line">
                <b>GMD {(item.price * item.qty).toFixed(2)}</b>
                <button onClick={() => remove(item.id)} className="icon-btn"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
      </div>

      <div className="totals">
        <div><span>Subtotal</span><b>GMD {subtotal.toFixed(2)}</b></div>
        <div className="discount-row"><span>Discount</span>
          <div className="discount-input">
            <input type="number" min="0" value={discount.value} onChange={e => setDiscount({ ...discount, value: Number(e.target.value) })} />
            <select value={discount.type} onChange={e => setDiscount({ ...discount, type: e.target.value })}><option value="percent">%</option><option value="fixed">GMD</option></select>
          </div>
        </div>
        <div className="grand"><span>Total</span><b>GMD {total.toFixed(2)}</b></div>
      </div>

      <select className="customer-select" value={customerId || ""} onChange={e => setCustomerId(e.target.value || null)}>
        <option value="">Walk-in Customer</option>
        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      <div className="payment-title">Payment Method</div>
      <div className="payments">
        {METHODS.map(([id, label]) => (
          <button key={id} className={payment === id ? "pay active" : "pay"} onClick={() => setPayment(id)}>{label}</button>
        ))}
      </div>
      <button
        className={payment === "credit" ? "credit-btn active" : "credit-btn"}
        onClick={() => setPayment("credit")}
      >
        <UserRound size={14} /> Sell on Credit
      </button>
      {needsCustomer && <p className="form-hint">Select a customer to sell on credit.</p>}
      <button className="complete-btn" disabled={!cart.length || busy || needsCustomer} onClick={() => onComplete(total)}>
        {busy ? "Processing..." : "Complete Sale"}
      </button>
    </section>
  );
}
