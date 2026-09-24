import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { listExpenses, createExpense } from "../lib/api";

const empty = { category: "", amount: "", description: "", date: new Date().toISOString().slice(0, 10) };

export default function Expenses() {
  const { currentBusinessId, currentBranch } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!currentBusinessId) return;
    const data = await listExpenses(currentBusinessId);
    setExpenses(data || []);
  };

  useEffect(() => { load(); }, [currentBusinessId]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createExpense(currentBusinessId, currentBranch.id, {
        category: form.category, amount: Number(form.amount), description: form.description, date: form.date
      });
      setForm(empty);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message || "Could not record expense.");
    } finally {
      setBusy(false);
    }
  };

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <section className="page">
      <div className="page-heading">
        <div><h1>Expenses</h1><p>Track business expenses.</p></div>
        <button className="complete-btn small" onClick={() => setShowForm(!showForm)}>
          <Plus size={15} /> {showForm ? "Close" : "Add Expense"}
        </button>
      </div>
      {error && <div className="form-error">{error}</div>}
      {showForm && (
        <form className="card form-grid" onSubmit={submit}>
          <label>Category<input required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></label>
          <label>Amount<input type="number" step="0.01" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label>
          <label>Date<input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
          <label className="span-2">Description<input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
          <button className="complete-btn" disabled={busy} type="submit">{busy ? "Saving..." : "Record Expense"}</button>
        </form>
      )}
      <div className="card">
        <h3>Total: GMD {total.toFixed(2)}</h3>
        <table className="data-table">
          <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead>
          <tbody>
            {expenses.map(e => (
              <tr key={e.id}>
                <td>{e.expense_date}</td>
                <td>{e.category}</td>
                <td>{e.description || "—"}</td>
                <td>GMD {Number(e.amount).toFixed(2)}</td>
              </tr>
            ))}
            {expenses.length === 0 && <tr><td colSpan={4}>No expenses recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
