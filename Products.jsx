import React, { useEffect, useState } from "react";
import { Plus, Package, Upload } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { listProducts, createProduct, updateProduct, listCategories, createCategory, uploadProductImage } from "../lib/api";

const empty = { name: "", sku: "", barcode: "", category_id: "", cost_price: "", selling_price: "", low_stock_threshold: "", image_url: "" };

export default function Products() {
  const { currentBusinessId } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    if (!currentBusinessId) return;
    const [p, c] = await Promise.all([listProducts(currentBusinessId), listCategories(currentBusinessId)]);
    setProducts(p || []);
    setCategories(c || []);
  };

  useEffect(() => { load(); }, [currentBusinessId]);

  const startEdit = (p) => {
    setEditingId(p.id);
    setForm({
      name: p.name, sku: p.sku || "", barcode: p.barcode || "",
      category_id: p.category_id || "", cost_price: p.cost_price, selling_price: p.selling_price,
      low_stock_threshold: p.low_stock_threshold, image_url: p.image_url || ""
    });
    setShowForm(true);
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const url = await uploadProductImage(currentBusinessId, file);
      setForm((f) => ({ ...f, image_url: url }));
    } catch (err) {
      setError(err.message || "Could not upload image.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        sku: form.sku || null,
        barcode: form.barcode || null,
        category_id: form.category_id || null,
        cost_price: Number(form.cost_price) || 0,
        selling_price: Number(form.selling_price) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 0,
        image_url: form.image_url || null
      };
      if (editingId) {
        await updateProduct(editingId, payload);
      } else {
        await createProduct(currentBusinessId, payload);
      }
      setForm(empty);
      setEditingId(null);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message || "Could not save product.");
    } finally {
      setBusy(false);
    }
  };

  const addCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    try {
      await createCategory(currentBusinessId, newCategory.trim());
      setNewCategory("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleStatus = async (p) => {
    await updateProduct(p.id, { status: p.status === "active" ? "inactive" : "active" });
    await load();
  };

  return (
    <section className="page">
      <div className="page-heading">
        <div><h1>Products</h1><p>Manage products, prices, photos and categories.</p></div>
        <button className="complete-btn small" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(empty); }}>
          <Plus size={15} /> {showForm ? "Close" : "Add Product"}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="card">
        <h3>Categories</h3>
        <div className="chip-row">
          {categories.map(c => <span key={c.id} className="chip">{c.name}</span>)}
        </div>
        <form className="inline-form" onSubmit={addCategory}>
          <input placeholder="New category name" value={newCategory} onChange={e => setNewCategory(e.target.value)} />
          <button className="complete-btn small" type="submit">Add</button>
        </form>
      </div>

      {showForm && (
        <form className="card form-grid" onSubmit={submit}>
          <div className="span-2 image-upload-row">
            <div className="image-preview">
              {form.image_url ? <img src={form.image_url} alt="Product" /> : <Package size={28} color="var(--muted)" />}
            </div>
            <label className="upload-btn">
              <Upload size={14} /> {uploading ? "Uploading..." : "Upload photo"}
              <input type="file" accept="image/*" hidden onChange={handleImageChange} disabled={uploading} />
            </label>
          </div>
          <label>Name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label>SKU<input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></label>
          <label>Barcode<input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder="Scan or type" /></label>
          <label>Category
            <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
              <option value="">None</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Cost price<input type="number" step="0.01" required value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} /></label>
          <label>Selling price<input type="number" step="0.01" required value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} /></label>
          <label>Low stock threshold<input type="number" value={form.low_stock_threshold} onChange={e => setForm({ ...form, low_stock_threshold: e.target.value })} /></label>
          <button className="complete-btn" disabled={busy || uploading} type="submit">{busy ? "Saving..." : editingId ? "Update Product" : "Create Product"}</button>
        </form>
      )}

      <div className="card">
        <h3>All Products ({products.length})</h3>
        <table className="data-table">
          <thead><tr><th></th><th>Name</th><th>Category</th><th>Cost</th><th>Price</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                <td>
                  <div className="thumb">
                    {p.image_url ? <img src={p.image_url} alt={p.name} /> : <Package size={16} color="var(--muted)" />}
                  </div>
                </td>
                <td>{p.name}<br /><small className="muted">{p.sku}</small></td>
                <td>{p.categories?.name || "—"}</td>
                <td>GMD {Number(p.cost_price).toFixed(2)}</td>
                <td>GMD {Number(p.selling_price).toFixed(2)}</td>
                <td><span className={`status-pill ${p.status}`}>{p.status}</span></td>
                <td className="row-actions">
                  <button className="link-btn" onClick={() => startEdit(p)}>Edit</button>
                  <button className="link-btn" onClick={() => toggleStatus(p)}>{p.status === "active" ? "Deactivate" : "Activate"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
