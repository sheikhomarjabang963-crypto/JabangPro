import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { listCustomers, createCustomer, updateCustomer } from "../lib/api";

export default function Customers() {
  const { currentBusinessId } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!currentBusinessId) return;
    const data = await listCustomers(currentBusinessId);
    setCustomers(data || []);
  };

  useEffect(() => { load(); }, [currentBusinessId]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (editingId) {
        await updateCustomer(editingId, { name, phone });
      } else {
        await createCustomer(currentBusinessId, { name, phone });
      }
      setName(""); setPhone(""); setEditingId(null); setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message || "Could not save customer.");
    } finally {
      setBusy(false);
    }
  };

  const edit = (c) => {
    setEditingId(c.id); setName(c.name); setPhone(c.phone || ""); setShowForm(true);
  };

  return (
    <section className="page">
      <div className="page-heading">
        <div><h1>Customers</h1><p>Manage customer contacts and credit balances.</p></div>
        <button className="complete-btn small" onClick={() => { setShowForm(!showForm); setEditingId(null); setName(""); setPhone(""); }}>
          <Plus size={15} /> {showForm ? "Close" : "Add Customer"}
        </button>
      </div>
      {error && <div className="form-error">{error}</div>}
      {showForm && (
        <form className="card form-grid" onSubmit={submit}>
          <label>Name<input required value={name} onChange={e => setName(e.target.value)} /></label>
          <label>Phone<input value={phone} onChange={e => setPhone(e.target.value)} /></label>
          <button className="complete-btn" disabled={busy} type="submit">{busy ? "Saving..." : editingId ? "Update" : "Create"}</button>
        </form>
      )}
      <div className="card">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Phone</th><th>Credit Balance</th><th></th></tr></thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.phone || "—"}</td>
                <td>GMD {Number(c.credit_balance).toFixed(2)}</td>
                <td><button className="link-btn" onClick={() => edit(c)}>Edit</button></td>
              </tr>
            ))}
            {customers.length === 0 && <tr><td colSpan={4}>No customers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
