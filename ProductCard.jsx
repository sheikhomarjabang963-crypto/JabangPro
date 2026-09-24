import React from "react";
import { Plus, Package } from "lucide-react";

export default function ProductCard({ product, onAdd }) {
  const outOfStock = product.stock <= 0;
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        {product.image ? <img src={product.image} alt={product.name} /> : <Package size={34} color="var(--muted)" />}
      </div>
      <div className="product-name">{product.name}</div>
      <div className="product-price">GMD {Number(product.price).toFixed(2)}</div>
      <div className="product-stock">Stock: {product.stock}</div>
      <button className="add-product" disabled={outOfStock} onClick={() => onAdd(product)}>
        <Plus size={16} />
      </button>
    </article>
  );
}
