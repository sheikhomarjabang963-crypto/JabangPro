import React, { useEffect, useMemo, useState } from "react";
import { Search, ScanLine } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getPosCatalog, listCategories, listCustomers, createSale } from "../lib/api";
import ProductCard from "../components/ProductCard";
import Cart from "../components/Cart";
import BarcodeScanner from "../components/BarcodeScanner";
import ReceiptModal from "../components/ReceiptModal";

export default function POS() {
  const { currentBusinessId, currentBranch } = useAuth();
  const [catalog, setCatalog] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [discount, setDiscount] = useState({ type: "percent", value: 0 });
  const [customerId, setCustomerId] = useState(null);
  const [payment, setPayment] = useState("cash");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanNotice, setScanNotice] = useState("");
  const [receiptSaleId, setReceiptSaleId] = useState(null);

  const load = async () => {
    if (!currentBusinessId || !currentBranch) return;
    setError("");
    try {
      const [cat, cats, custs] = await Promise.all([
        getPosCatalog(currentBusinessId, currentBranch.id),
        listCategories(currentBusinessId),
        listCustomers(currentBusinessId)
      ]);
      setCatalog(cat || []);
      setCategories(cats || []);
      setCustomers(custs || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, [currentBusinessId, currentBranch]);

  const products = catalog.map(p => ({
    id: p.product_id, name: p.name, price: Number(p.selling_price),
    stock: Number(p.quantity), image: p.image_url, categoryId: p.category_id, barcode: p.barcode
  }));

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return products.filter(p =>
      (category === "All" || p.categoryId === category) &&
      (p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.toLowerCase().includes(q)))
    );
  }, [products, query, category]);

  const add = product => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const found = prev.find(x => x.id === product.id);
      if (found) {
        if (found.qty >= product.stock) return prev;
        return prev.map(x => x.id === product.id ? { ...x, qty: x.qty + 1 } : x);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const handleScanned = (code) => {
    setShowScanner(false);
    const match = products.find(p => p.barcode && p.barcode === code);
    if (match) {
      add(match);
      setScanNotice(`Added: ${match.name}`);
    } else {
      setScanNotice(`No product found for barcode ${code}`);
    }
    setTimeout(() => setScanNotice(""), 3000);
  };

  const complete = async (total) => {
    setBusy(true);
    setError("");
    try {
      const items = cart.map(c => ({ product_id: c.id, quantity: c.qty, unit_price: c.price }));
      const payments = [{ method: payment, amount: total }];
      const saleId = await createSale({
        businessId: currentBusinessId,
        branchId: currentBranch.id,
        customerId,
        items,
        payments,
        discountType: discount.type,
        discountValue: discount.value
      });
      setMessage(`Sale completed: GMD ${total.toFixed(2)}`);
      setCart([]);
      setDiscount({ type: "percent", value: 0 });
      setCustomerId(null);
      setPayment("cash");
      await load();
      setTimeout(() => setMessage(""), 3000);
      setReceiptSaleId(saleId);
    } catch (err) {
      setError(err.message || "Could not complete sale.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pos-page">
      <section className="catalog">
        <div className="page-heading"><div><h1>POS / Checkout</h1><p>Search, scan, or select products to add to cart.</p></div></div>
        {error && <div className="form-error">{error}</div>}
        {scanNotice && <div className="success">{scanNotice}</div>}
        <div className="pos-search-row">
          <div className="pos-search"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or barcode..." /></div>
          <button className="complete-btn small" onClick={() => setShowScanner(true)}><ScanLine size={15} /> Scan</button>
        </div>
        <div className="section-label">Categories</div>
        <div className="categories">
          <button className={category === "All" ? "cat active" : "cat"} onClick={() => setCategory("All")}>All</button>
          {categories.map(c => <button key={c.id} className={category === c.id ? "cat active" : "cat"} onClick={() => setCategory(c.id)}>{c.name}</button>)}
        </div>
        <div className="section-label">Products</div>
        {filtered.length === 0 && <p>No products found. Add products first.</p>}
        <div className="product-grid">{filtered.map(p => <ProductCard key={p.id} product={p} onAdd={add} />)}</div>
      </section>
      <Cart {...{ cart, setCart, discount, setDiscount, customers, customerId, setCustomerId, payment, setPayment, onComplete: complete, busy, message }} />

      {showScanner && <BarcodeScanner onDetected={handleScanned} onClose={() => setShowScanner(false)} />}
      {receiptSaleId && <ReceiptModal saleId={receiptSaleId} onClose={() => setReceiptSaleId(null)} />}
    </div>
  );
}
