# Cart Feature Implementation Plan

This document defines the exact, ordered sequence of implementation steps for the cart feature. Follow sections in order: each section depends on the previous one being complete. The grading rubric is covered in full by the five sections below.

---

## Step 1 — Models

### 1.1 `CartItem` model — no changes

`src/backend/MockEcommerce.Api/Models/CartItem.cs` is already correct as-is. `TotalPrice` is already a computed property (`UnitPrice * Quantity`). No file changes needed.

### 1.2 Add `UpdateCartItemRequest` record

In `src/backend/MockEcommerce.Api/Endpoints/CartEndpoints.cs`, append a new record at the bottom of the file, directly below the existing `AddToCartRequest` record:

```csharp
/// <summary>Request body for updating the quantity of an existing cart item.</summary>
public record UpdateCartItemRequest(int Quantity);
```

### 1.3 Add frontend `CartItem` interface

In `src/frontend/src/types/index.ts`, append:

```ts
export interface CartItem {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}
```

---

## Step 2 — Service Layer

### 2.1 Redefine `ICartService.Add` contract

`ICartService.Add(CartItem item)` must behave as an **upsert that sets quantity exactly** — not incrementing. The endpoint layer is responsible for calculating the final quantity before calling `Add`. Update the XML doc comment in `src/backend/MockEcommerce.Api/Services/ICartService.cs`:

```csharp
/// <summary>
/// Upserts a cart item. If an item with the same <see cref="CartItem.ProductId"/>
/// already exists it is replaced in full. If not, the item is added.
/// No quantity validation is performed here — callers must validate before invoking.
/// </summary>
CartItem Add(CartItem item);
```

### 2.2 Implement `InMemoryCartService`

Replace the entire body of `src/backend/MockEcommerce.Api/Services/InMemoryCartService.cs` with:

```csharp
using MockEcommerce.Api.Models;

namespace MockEcommerce.Api.Services;

/// <summary>
/// Thread-safe in-memory cart storage. Registered as Singleton for demo purposes;
/// all users share a single cart. Replace with a per-user scoped implementation
/// when authentication is added.
/// </summary>
public class InMemoryCartService : ICartService
{
    private readonly List<CartItem> _cart = [];
    private readonly Lock _lock = new();

    /// <inheritdoc />
    public IEnumerable<CartItem> GetAll()
    {
        lock (_lock)
        {
            return _cart.ToList();
        }
    }

    /// <inheritdoc />
    public CartItem? GetByProductId(int productId)
    {
        lock (_lock)
        {
            return _cart.FirstOrDefault(i => i.ProductId == productId);
        }
    }

    /// <inheritdoc />
    public CartItem Add(CartItem item)
    {
        lock (_lock)
        {
            var existing = _cart.FirstOrDefault(i => i.ProductId == item.ProductId);
            if (existing is not null)
                _cart.Remove(existing);
            _cart.Add(item);
            return item;
        }
    }

    /// <inheritdoc />
    public bool Remove(int productId)
    {
        lock (_lock)
        {
            var item = _cart.FirstOrDefault(i => i.ProductId == productId);
            if (item is null) return false;
            _cart.Remove(item);
            return true;
        }
    }

    /// <inheritdoc />
    public void Clear()
    {
        lock (_lock)
        {
            _cart.Clear();
        }
    }
}
```

---

## Step 3 — Endpoints

### 3.1 Register `PUT /api/cart/{productId}` route

In `src/backend/MockEcommerce.Api/Endpoints/CartEndpoints.cs`, inside `MapCartEndpoints`, add after the existing `group.MapPost(...)` call:

```csharp
group.MapPut("/{productId:int}", UpdateCartItem)
    .WithName("UpdateCartItem")
    .WithSummary("Sets the quantity of a cart item to an exact value. Creates the item if not already in the cart.");
```

### 3.2 Implement all five handlers

Replace the four stubbed handler bodies and add the new `UpdateCartItem` handler. The complete, final `CartEndpoints.cs` static class body (handlers only — keep the route registrations and records unchanged):

**`GetCart`:**
```csharp
internal static Ok<IEnumerable<CartItem>> GetCart(ICartService cartService)
    => TypedResults.Ok(cartService.GetAll());
```

**`AddToCart`** — update return type to include `ProblemHttpResult`:
```csharp
internal static Results<Created<CartItem>, Ok<CartItem>, NotFound<string>, ValidationProblem, ProblemHttpResult> AddToCart(
    AddToCartRequest request,
    IProductService productService,
    ICartService cartService)
{
    if (request.Quantity < 1 || request.Quantity > 5)
        return TypedResults.ValidationProblem(
            new Dictionary<string, string[]>
            {
                ["Quantity"] = ["Quantity must be between 1 and 5."]
            });

    var product = productService.GetById(request.ProductId);
    if (product is null)
        return TypedResults.NotFound($"Product with ID {request.ProductId} does not exist in the catalog.");

    var existing = cartService.GetByProductId(request.ProductId);
    int newQuantity = (existing?.Quantity ?? 0) + request.Quantity;

    if (newQuantity > 5)
        return TypedResults.Problem(
            detail: $"Adding {request.Quantity} to the existing quantity of {existing!.Quantity} would exceed the maximum of 5.",
            statusCode: StatusCodes.Status400BadRequest,
            title: "Quantity limit exceeded");

    var item = new CartItem
    {
        ProductId = product.Id,
        ProductName = product.Name,
        UnitPrice = product.Price,
        Quantity = newQuantity
    };
    cartService.Add(item);

    return existing is null
        ? TypedResults.Created("/api/cart", item)
        : TypedResults.Ok(item);
}
```

**`UpdateCartItem`** (new handler):
```csharp
internal static Results<Created<CartItem>, Ok<CartItem>, NotFound<string>, ValidationProblem> UpdateCartItem(
    int productId,
    UpdateCartItemRequest request,
    IProductService productService,
    ICartService cartService)
{
    if (request.Quantity < 1 || request.Quantity > 5)
        return TypedResults.ValidationProblem(
            new Dictionary<string, string[]>
            {
                ["Quantity"] = ["Quantity must be between 1 and 5."]
            });

    var product = productService.GetById(productId);
    if (product is null)
        return TypedResults.NotFound($"Product with ID {productId} does not exist in the catalog.");

    var existing = cartService.GetByProductId(productId);

    var item = new CartItem
    {
        ProductId = product.Id,
        ProductName = product.Name,
        UnitPrice = product.Price,
        Quantity = request.Quantity
    };
    cartService.Add(item);

    return existing is null
        ? TypedResults.Created("/api/cart", item)
        : TypedResults.Ok(item);
}
```

**`RemoveFromCart`:**
```csharp
internal static Results<NoContent, NotFound> RemoveFromCart(int productId, ICartService cartService)
{
    var removed = cartService.Remove(productId);
    return removed ? TypedResults.NoContent() : TypedResults.NotFound();
}
```

**`ClearCart`:**
```csharp
internal static NoContent ClearCart(ICartService cartService)
{
    cartService.Clear();
    return TypedResults.NoContent();
}
```

---

## Step 4 — Frontend Cart View

### 4.1 Add new API functions

In `src/frontend/src/api/index.ts`, append after the existing `addToCart` function:

```ts
export async function fetchCart(): Promise<CartItem[]> {
  const response = await fetch(`${BASE_URL}/cart`);
  if (!response.ok) throw new Error('Failed to fetch cart');
  return response.json();
}

export async function updateCartItem(productId: number, quantity: number): Promise<CartItem> {
  const response = await fetch(`${BASE_URL}/cart/${productId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity }),
  });
  if (!response.ok) throw new Error(`Failed to update cart item ${productId}`);
  return response.json();
}

export async function removeFromCart(productId: number): Promise<void> {
  const response = await fetch(`${BASE_URL}/cart/${productId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`Failed to remove product ${productId} from cart`);
}

export async function clearCart(): Promise<void> {
  const response = await fetch(`${BASE_URL}/cart`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to clear cart');
}
```

Add the `CartItem` import at the top of the file:
```ts
import type { Product, AddToCartRequest, CartItem } from '../types';
```

### 4.2 Create `useCart` hook

Create `src/frontend/src/hooks/useCart.ts`:

```ts
import { useState, useEffect, useCallback } from 'react';
import type { CartItem } from '../types';
import { fetchCart } from '../api';

interface UseCartResult {
  items: CartItem[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useCart(): UseCartResult {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchCart()
      .then(setItems)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return { items, loading, error, refresh: load };
}
```

### 4.3 Create `CartPanel` component

Create `src/frontend/src/components/CartPanel/CartPanel.tsx`:

```tsx
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
          <button className="cart-panel__close" onClick={onClose} aria-label="Close cart">×</button>
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
                    onClick={() => onRemove(item.productId)}
                    aria-label={`Remove ${item.productName} from cart`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="cart-panel__summary">
              <span>Total</span>
              <span>${grandTotal.toFixed(2)}</span>
              <button onClick={onClear} aria-label="Clear cart">Clear cart</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

Create `src/frontend/src/components/CartPanel/index.ts`:

```ts
export { CartPanel } from './CartPanel';
```

### 4.4 Update `Header` component

In `src/frontend/src/components/Header/Header.tsx`, add `onCartClick` to props and wire to `onClick`:

```tsx
// Change HeaderProps to:
interface HeaderProps {
  cartItemCount: number;
  onCartClick: () => void;
}

// Change the function signature to:
export function Header({ cartItemCount, onCartClick }: HeaderProps) {
  // ... existing JSX unchanged except the cart button:
  // Add onClick={onCartClick} to the button element:
  <button
    className="header__cart-button"
    onClick={onCartClick}
    aria-label={`Shopping cart with ${cartItemCount} items`}
  >
```

### 4.5 Update `App.tsx`

Replace the full contents of `src/frontend/src/App.tsx` with the following (key additions: `useCart`, `isCartOpen`, `CartPanel`, updated `cartItemCount` derivation, updated `Header` call):

```tsx
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
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
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
    await updateCartItem(productId, quantity);
    refreshCart();
  }

  async function handleRemove(productId: number) {
    await removeFromCart(productId);
    refreshCart();
  }

  async function handleClear() {
    await clearCart();
    refreshCart();
  }

  return (
    <div className="app">
      <Header cartItemCount={cartItemCount} onCartClick={() => setIsCartOpen(true)} />
      <HeroBanner />

      <main className="app__main">
        <h1 className="app__section-heading">Our products</h1>

        {cartMessage && (
          <div className="app__notification" role="status">{cartMessage}</div>
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
```

---

## Step 5 — Tests

### 5.1 Backend Integration Tests

Create `test/backend/MockEcommerce.Api.Tests/Endpoints/CartEndpointTests.cs`.

Use the same `IClassFixture<WebApplicationFactory<Program>>` pattern as `ProductEndpointTests.cs`.

Write one `[Fact]` per row below:

| Test name | Action | Expected |
|---|---|---|
| `GetCart_WhenEmpty_Returns200WithEmptyArray` | `GET /api/cart` on fresh factory | 200, body deserializes to `List<CartItem>` with 0 items |
| `AddToCart_NewItem_Returns201WithCartItem` | `POST /api/cart` `{productId:1, quantity:2}` | 201, body has `productId=1`, `quantity=2`, `unitPrice=79.99`, `totalPrice=159.98` |
| `AddToCart_ExistingItem_Returns200WithUpdatedQuantity` | `POST /api/cart` `{productId:1, quantity:1}` twice | Second call: 200, body has `quantity=2` |
| `AddToCart_WouldExceedMax_Returns400` | `POST /api/cart` `{productId:1, quantity:3}` then `{productId:1, quantity:3}` | Second call: 400, body contains `"Quantity limit exceeded"` |
| `AddToCart_QuantityZero_Returns422` | `POST /api/cart` `{productId:1, quantity:0}` | 422, errors contain key `"Quantity"` |
| `AddToCart_QuantitySix_Returns422` | `POST /api/cart` `{productId:1, quantity:6}` | 422, errors contain key `"Quantity"` |
| `AddToCart_NonexistentProduct_Returns404` | `POST /api/cart` `{productId:9999, quantity:1}` | 404 |
| `AddToCart_ExistingQty4AddQty1_Returns200WithQty5` | Add qty 4 first, then `POST` qty 1 | 200, `quantity=5` |
| `AddToCart_ExistingQty5AddQty1_Returns400` | Add qty 5 first, then `POST` qty 1 | 400 |
| `UpdateCartItem_NewItem_Returns201` | `PUT /api/cart/1` `{quantity:3}` | 201, `quantity=3` |
| `UpdateCartItem_ExistingItem_Returns200WithNewQuantity` | Add item first, then `PUT /api/cart/1` `{quantity:5}` | 200, `quantity=5` |
| `UpdateCartItem_QuantityZero_Returns422` | `PUT /api/cart/1` `{quantity:0}` | 422 |
| `UpdateCartItem_QuantitySix_Returns422` | `PUT /api/cart/1` `{quantity:6}` | 422 |
| `UpdateCartItem_NonexistentProduct_Returns404` | `PUT /api/cart/9999` `{quantity:1}` | 404 |
| `RemoveFromCart_ExistingItem_Returns204` | Add item, then `DELETE /api/cart/1` | 204 |
| `RemoveFromCart_NonexistentItem_Returns404` | `DELETE /api/cart/9999` on empty cart | 404 |
| `ClearCart_WithItems_Returns204AndEmptiesCart` | Add items, then `DELETE /api/cart` | 204; follow-up `GET /api/cart` returns `[]` |
| `ClearCart_WhenAlreadyEmpty_Returns204` | `DELETE /api/cart` on empty cart | 204 (idempotent) |

> **Important:** Each test that adds items must use a **fresh `WebApplicationFactory`** or reset shared state between tests to prevent bleed-through. Use `IClassFixture` with a custom factory that resets `InMemoryCartService` between tests, or use `CreateClient()` on separate factory instances per test class.

### 5.2 Backend Unit Tests — `InMemoryCartService`

Create `test/backend/MockEcommerce.Api.Tests/Services/InMemoryCartServiceTests.cs`.

| Test name | Action | Assertion |
|---|---|---|
| `GetAll_WhenEmpty_ReturnsEmptyEnumerable` | New service, `GetAll()` | Count = 0 |
| `Add_NewItem_AddsToCart` | `Add(item)`, then `GetAll()` | Count = 1, item returned |
| `Add_ExistingItem_ReplacesIt` | Add item with qty 2, then add same productId with qty 4 | `GetAll()` count = 1, qty = 4 |
| `GetByProductId_ExistingItem_ReturnsIt` | Add item, `GetByProductId(productId)` | Not null, correct productId |
| `GetByProductId_NonexistentItem_ReturnsNull` | `GetByProductId(9999)` on empty service | Returns null |
| `Remove_ExistingItem_ReturnsTrueAndRemoves` | Add item, `Remove(productId)` | Returns `true`; `GetAll()` empty |
| `Remove_NonexistentItem_ReturnsFalse` | `Remove(9999)` on empty service | Returns `false` |
| `Clear_RemovesAllItems` | Add 3 items, `Clear()`, `GetAll()` | Count = 0 |

### 5.3 Frontend Tests — `CartPanel`

Create `test/frontend/components/CartPanel/CartPanel.test.tsx`.

Mock setup: no API mocking needed — `CartPanel` is a pure presentational component taking `items` as a prop.

| Test name | Setup | Assertion |
|---|---|---|
| `renders empty state message when items is empty` | `items={[]}` | `screen.getByText('Your cart is empty.')` in document |
| `does not render total or clear button when items is empty` | `items={[]}` | No element with text `/total/i`; no button with `aria-label="Clear cart"` |
| `renders each item name, unit price, quantity, and row total` | `items=[{productId:1, productName:'Headphones', unitPrice:79.99, quantity:2, totalPrice:159.98}]` | All four values visible |
| `renders grand total as sum of all row totals` | Two items with totalPrice 159.98 and 34.99 | Element containing `$194.97` |
| `calls onRemove with productId when remove button clicked` | Click `aria-label="Remove Headphones from cart"` | `onRemove` called with `1` |
| `calls onUpdateQuantity with productId and new value when quantity changed` | Change select to value 4 | `onUpdateQuantity` called with `(1, 4)` |
| `calls onClear when clear cart button clicked` | Click `aria-label="Clear cart"` | `onClear` called once |
| `calls onClose when close button clicked` | Click `aria-label="Close cart"` | `onClose` called once |

### 5.4 Frontend Tests — `Header` (additions to existing `Header.test.tsx`)

Add to `test/frontend/components/Header/Header.test.tsx`:

| Test name | Setup | Assertion |
|---|---|---|
| `calls onCartClick when cart button is clicked` | Render with `cartItemCount=0, onCartClick=vi.fn()`, click cart button | `onCartClick` called once |

### 5.5 Frontend Tests — `useCart` hook

Create `test/frontend/hooks/useCart.test.ts`. Mock `src/frontend/src/api` module with `vi.mock`.

| Test name | Mock setup | Assertion |
|---|---|---|
| `returns loading true initially` | `fetchCart` returns never-resolving promise | `result.current.loading === true`, `items = []`, `error = null` |
| `returns items after successful fetch` | `fetchCart` resolves with one CartItem | After `waitFor`: `loading = false`, `items.length = 1` |
| `returns error message on fetch failure` | `fetchCart` rejects with `Error('Network error')` | After `waitFor`: `error = 'Network error'`, `items = []` |
| `returns generic error for non-Error rejections` | `fetchCart` rejects with a string | After `waitFor`: `error = 'Unknown error'` |
| `refresh re-fetches the cart` | `fetchCart` called once on mount, call `result.current.refresh()` | `fetchCart` called twice total |

### 5.6 Frontend Tests — `App.tsx` (additions to existing `App.test.tsx`)

Add to `test/frontend/App.test.tsx`. Keep existing `vi.mock` for `useProducts` and `api`; add `vi.mock` for `useCart`:

```ts
vi.mock('../../src/frontend/src/hooks/useCart');
import { useCart } from '../../src/frontend/src/hooks/useCart';
const mockedUseCart = vi.mocked(useCart);
// Default setup: mockedUseCart.mockReturnValue({ items: [], loading: false, error: null, refresh: vi.fn() });
```

| Test name | Setup | Assertion |
|---|---|---|
| `does not render CartPanel initially` | Default mocks | No `role="dialog"` in document |
| `renders CartPanel when cart icon clicked` | Click cart button | `screen.getByRole('dialog')` present |
| `hides CartPanel when close is triggered` | Open cart, click close | No `role="dialog"` in document |
| `cartItemCount passed to Header is sum of item quantities` | `useCart` returns 2 items with qty 3 and qty 2 | Cart button aria-label contains `"5 items"` |
