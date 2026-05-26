import type { CartItem } from '../../types';

interface CartPanelProps {
  items: CartItem[];
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onRemove: (productId: number) => void;
  onClear: () => void;
  onClose: () => void;
}

export function CartPanel({ items, onUpdateQuantity, onRemove, onClear, onClose }: CartPanelProps) {
  const grandTotal = items.reduce((sum, item) => sum + item.totalPrice, 0);

  return (
    <div className="cart-panel-overlay" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <div className="cart-panel">
        <div className="cart-panel__header">
          <h2 className="cart-panel__title">Your Cart</h2>
          <button className="cart-panel__close" onClick={onClose} aria-label="Close cart">
            ×
          </button>
        </div>

        {items.length === 0 ? (
          <p className="cart-panel__empty">Your cart is empty.</p>
        ) : (
          <>
            <ul className="cart-panel__items" aria-label="Cart items">
              {items.map((item) => (
                <li key={item.productId} className="cart-panel__item">
                  <span className="cart-panel__item-name">{item.productName}</span>
                  <span className="cart-panel__item-unit-price">${item.unitPrice.toFixed(2)}</span>
                  <select
                    value={item.quantity}
                    onChange={(e) => onUpdateQuantity(item.productId, Number(e.target.value))}
                    aria-label={`Quantity for ${item.productName}`}
                  >
                    {[1, 2, 3, 4, 5].map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                  <span className="cart-panel__item-total">${item.totalPrice.toFixed(2)}</span>
                  <button
                    className="cart-panel__item-remove"
                    onClick={() => onRemove(item.productId)}
                    aria-label={`Remove ${item.productName} from cart`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>

            <div className="cart-panel__summary">
              <span className="cart-panel__summary-label">Total</span>
              <span className="cart-panel__summary-total">${grandTotal.toFixed(2)}</span>
              <button
                className="cart-panel__clear"
                onClick={onClear}
                aria-label="Clear cart"
              >
                Clear cart
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
