import { useState, useRef, useEffect } from 'react';
import type { Product } from './types';
import { Header } from './components/Header';
import { HeroBanner } from './components/HeroBanner';
import { ProductList } from './components/ProductList';
import { CartPanel } from './components/CartPanel';
import { useProducts } from './hooks/useProducts';
import { useCart } from './hooks/useCart';
import { addToCart, updateCartItem, removeFromCart, clearCart } from './api';
import './App.css';

export function App() {
  const { products, loading, error } = useProducts();
  const { items: cartItems, refresh: refreshCart } = useCart();
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const cartItemCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  async function handleAddToCart(product: Product) {
    try {
      await addToCart({ productId: product.id, quantity: 1 });
      refreshCart();
      setCartMessage(`"${product.name}" added to cart!`);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCartMessage(null), 3000);
    } catch {
      setCartMessage('Failed to add item to cart.');
    }
  }

  async function handleUpdateQuantity(productId: number, quantity: number) {
    try {
      await updateCartItem(productId, quantity);
      refreshCart();
    } catch {
      setCartMessage('Failed to update item quantity.');
    }
  }

  async function handleRemove(productId: number) {
    try {
      await removeFromCart(productId);
      refreshCart();
    } catch {
      setCartMessage('Failed to remove item from cart.');
    }
  }

  async function handleClear() {
    try {
      await clearCart();
      refreshCart();
    } catch {
      setCartMessage('Failed to clear cart.');
    }
  }

  return (
    <div className="app">
      <Header cartItemCount={cartItemCount} onCartClick={() => setIsCartOpen(true)} />
      <HeroBanner />

      <main className="app__main">
        <h1 className="app__section-heading">Our products</h1>

        {cartMessage && (
          <div className="app__notification" role="status">
            {cartMessage}
          </div>
        )}

        {loading && <p className="app__loading">Loading products…</p>}
        {error && <p className="app__error">Error: {error}</p>}
        {!loading && !error && (
          <ProductList products={products} onAddToCart={handleAddToCart} />
        )}
      </main>

      {isCartOpen && (
        <CartPanel
          items={cartItems}
          onUpdateQuantity={handleUpdateQuantity}
          onRemove={handleRemove}
          onClear={handleClear}
          onClose={() => setIsCartOpen(false)}
        />
      )}
    </div>
  );
}

