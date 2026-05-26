# Cart Feature Specification

## 1. Overview

The cart is a server-side, in-memory, **shared single-user cart** (no authentication, no per-session isolation). It is managed entirely by `InMemoryCartService` on the backend and surfaced in the frontend via a `CartPanel` overlay triggered from the `Header` icon. This document defines all behaviors, contracts, and edge cases precisely.

---

## 2. Data Models

### 2.1 `CartItem` — `src/backend/MockEcommerce.Api/Models/CartItem.cs` (no changes required)

| Property | Type | Notes |
|---|---|---|
| `ProductId` | `int` | Must match an `Id` in `MockProductService` |
| `ProductName` | `string` | Snapshot of product name at time of adding |
| `UnitPrice` | `decimal` | Snapshot of `Product.Price` at time of adding |
| `Quantity` | `int` | Valid range: 1–5 inclusive |
| `TotalPrice` | `decimal` | **Computed**: `UnitPrice × Quantity`. Not persisted. |

### 2.2 `AddToCartRequest` — bottom of `CartEndpoints.cs` (no changes required)

```csharp
public record AddToCartRequest(int ProductId, int Quantity);
```

### 2.3 `UpdateCartItemRequest` — add to bottom of `CartEndpoints.cs` (new)

```csharp
public record UpdateCartItemRequest(int Quantity);
```

Used exclusively by `PUT /api/cart/{productId}`.

### 2.4 Frontend `CartItem` type — `src/frontend/src/types/index.ts` (new interface)

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

## 3. Business Rules

### 3.1 Quantity Constraints (hard limits)

- **Minimum quantity per line item:** 1 — a request with `Quantity < 1` is invalid.
- **Maximum quantity per line item:** 5 — a request that would result in a quantity > 5 is rejected.
- These limits are enforced at the **endpoint layer** before calling the service.

### 3.2 `POST /api/cart` — Additive Semantics

`POST` **adds** the requested quantity on top of whatever is already in the cart.

| Condition | Result |
|---|---|
| `Quantity < 1` | 422 ValidationProblem |
| `Quantity > 5` | 422 ValidationProblem |
| Product ID not in catalog | 404 |
| Product not yet in cart, `Quantity` is 1–5 | Add new item → **201 Created** with `CartItem` |
| Product already in cart, `existing + Quantity ≤ 5` | Update quantity → **200 OK** with updated `CartItem` |
| Product already in cart, `existing + Quantity > 5` | **400 Bad Request** — cart not modified |

### 3.3 `PUT /api/cart/{productId}` — Upsert/Set Semantics

`PUT` **sets** the quantity to the exact value provided, regardless of current quantity.

| Condition | Result |
|---|---|
| `Quantity < 1` | 422 ValidationProblem |
| `Quantity > 5` | 422 ValidationProblem |
| Product ID not in catalog | 404 |
| Product not yet in cart, `Quantity` is 1–5 | Create item → **201 Created** with `CartItem` |
| Product already in cart, `Quantity` is 1–5 | Replace quantity → **200 OK** with updated `CartItem` |

> **Key distinction from POST:** PUT with `Quantity=5` on a cart item that already has `Quantity=4` succeeds (sets to 5). POST with `Quantity=5` on a cart item with `Quantity=4` would fail (4 + 5 = 9 > 5).

### 3.4 `DELETE /api/cart/{productId}` — Item Removal

| Condition | Result |
|---|---|
| `productId` found in cart | Remove item → **204 No Content** |
| `productId` not found in cart | **404 Not Found** (empty body) |

### 3.5 `DELETE /api/cart` — Clear Cart

- Always returns **204 No Content**, even if the cart was already empty (idempotent).

### 3.6 `GET /api/cart` — Read Cart

- Always returns **200 OK** with `CartItem[]`.
- Returns `[]` (empty JSON array) when the cart is empty — never 204.

---

## 4. HTTP Endpoint Contracts

### `GET /api/cart`

**Request:** No body, no parameters.

**Success Response — 200 OK:**
```json
[
  {
    "productId": 1,
    "productName": "Wireless Headphones",
    "unitPrice": 79.99,
    "quantity": 2,
    "totalPrice": 159.98
  }
]
```

**Empty Cart Response — 200 OK:**
```json
[]
```

---

### `POST /api/cart`

**Request body:**
```json
{ "productId": 1, "quantity": 2 }
```

**Success (new item) — 201 Created:**
```
Location: /api/cart
```
```json
{ "productId": 1, "productName": "Wireless Headphones", "unitPrice": 79.99, "quantity": 2, "totalPrice": 159.98 }
```

**Success (existing item incremented) — 200 OK:**
```json
{ "productId": 1, "productName": "Wireless Headphones", "unitPrice": 79.99, "quantity": 4, "totalPrice": 319.96 }
```

**Error — 400 Bad Request** (quantity would exceed 5):
```json
{
  "type": "https://tools.ietf.org/html/rfc7807",
  "title": "Quantity limit exceeded",
  "status": 400,
  "detail": "Adding 2 to the existing quantity of 4 would exceed the maximum of 5."
}
```

**Error — 404 Not Found** (product not in catalog):
```
"Product with ID 99 does not exist in the catalog."
```
*(Plain quoted JSON string — this is `NotFound<string>` serialization in ASP.NET Core Minimal APIs.)*

**Error — 422 Unprocessable Entity** (invalid `Quantity`):
```json
{
  "type": "https://tools.ietf.org/html/rfc7807",
  "title": "One or more validation errors occurred.",
  "status": 422,
  "errors": {
    "Quantity": ["Quantity must be between 1 and 5."]
  }
}
```

---

### `PUT /api/cart/{productId}`

**Route parameter:** `productId` — integer, must match a product in the catalog.

**Request body:**
```json
{ "quantity": 3 }
```

**Success (item created by upsert) — 201 Created:**
```json
{ "productId": 4, "productName": "Mechanical Keyboard", "unitPrice": 109.99, "quantity": 3, "totalPrice": 329.97 }
```

**Success (existing item updated) — 200 OK:**
```json
{ "productId": 4, "productName": "Mechanical Keyboard", "unitPrice": 109.99, "quantity": 3, "totalPrice": 329.97 }
```

**Error — 400 Bad Request:** Not applicable to PUT (PUT sets an absolute value; values 1–5 are always valid).

**Error — 404 Not Found** (product not in catalog):
```
"Product with ID 99 does not exist in the catalog."
```

**Error — 422 Unprocessable Entity** (`Quantity < 1` or `Quantity > 5`):
```json
{
  "type": "https://tools.ietf.org/html/rfc7807",
  "title": "One or more validation errors occurred.",
  "status": 422,
  "errors": {
    "Quantity": ["Quantity must be between 1 and 5."]
  }
}
```

---

### `DELETE /api/cart/{productId}`

**Success — 204 No Content** (no body)

**Error — 404 Not Found** (no body)

---

### `DELETE /api/cart`

**Success — 204 No Content** (no body, always — even if cart was empty)

---

## 5. Error Response Formats — Summary

| Status | Trigger | Body type | Produced by |
|---|---|---|---|
| 400 | POST would push quantity above 5 | `ProblemHttpResult` (RFC 7807) | `TypedResults.Problem(detail, statusCode: 400)` |
| 404 | Product ID not in catalog | `NotFound<string>` | `TypedResults.NotFound("Product with ID X does not exist...")` |
| 404 | DELETE by productId not in cart | `NotFound` | `TypedResults.NotFound()` (no body) |
| 422 | `Quantity < 1` or `Quantity > 5` in request | `ValidationProblem` | `TypedResults.ValidationProblem(errors)` |

The 422 `errors` dictionary key is always `"Quantity"` and value is always `["Quantity must be between 1 and 5."]`.

---

## 6. Frontend UI Specification

### 6.1 Header Integration

The `Header` component (at `src/frontend/src/components/Header/Header.tsx`) already renders a cart icon button and accepts `cartItemCount: number`.

**Change required:** Add `onCartClick: () => void` to `HeaderProps` and wire it to the cart button's `onClick`. The `aria-label` on the button already reads `"Shopping cart with N items"` — this remains unchanged.

```ts
// updated HeaderProps
interface HeaderProps {
  cartItemCount: number;
  onCartClick: () => void;
}
```

### 6.2 Cart Panel Component

A new `CartPanel` component (`src/frontend/src/components/CartPanel/CartPanel.tsx`) renders as a **full-screen overlay with a side-drawer panel** anchored to the right edge of the viewport. It is controlled (open/closed) by `App.tsx`.

**Props:**
```ts
interface CartPanelProps {
  items: CartItem[];
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onRemove: (productId: number) => void;
  onClear: () => void;
  onClose: () => void;
}
```

**Panel layout (top to bottom):**

1. **Header row:** Title "Your Cart" (left) + close button (`aria-label="Close cart"`) (right).
2. **Item list** — one row per `CartItem`:
   - Product name (`productName`)
   - Unit price formatted as `$X.XX`
   - Quantity selector: `<select>` element with options 1–5, current `quantity` pre-selected. On `change`, calls `onUpdateQuantity(productId, Number(e.target.value))`.
   - Row total formatted as `$X.XX` (`totalPrice` from the API — do not recalculate client-side)
   - Remove button (`aria-label="Remove {productName} from cart"`), calls `onRemove(productId)`.
3. **Summary row** (only shown when `items.length > 0`):
   - Label "Total" and grand total formatted as `$X.XX` — computed client-side as `items.reduce((sum, i) => sum + i.totalPrice, 0)`.
   - "Clear cart" button (`aria-label="Clear cart"`), calls `onClear()`.
4. **Empty state** (only shown when `items.length === 0`):
   - Paragraph: `"Your cart is empty."` — no total, no clear button.

### 6.3 App.tsx Wiring

`App.tsx` must manage:
- `isCartOpen: boolean` state (default `false`)
- `cartItems: CartItem[]` state (populated by `useCart()` hook)

On cart icon click → `setIsCartOpen(true)`.
On panel close → `setIsCartOpen(false)`.
On `onUpdateQuantity(productId, qty)` → call `updateCartItem(productId, qty)` from API layer, then refresh cart.
On `onRemove(productId)` → call `removeFromCart(productId)` from API layer, then refresh cart.
On `onClear()` → call `clearCart()` from API layer, then refresh cart.

`cartItemCount` passed to `Header` must be derived from `cartItems.reduce((sum, i) => sum + i.quantity, 0)` (total units across all line items) — **not** `cartItems.length`.

### 6.4 New API Functions — `src/frontend/src/api/index.ts`

Add to the existing file:

```ts
export async function fetchCart(): Promise<CartItem[]>      // GET /api/cart
export async function updateCartItem(productId: number, quantity: number): Promise<CartItem>  // PUT /api/cart/{productId}
export async function removeFromCart(productId: number): Promise<void>  // DELETE /api/cart/{productId}
export async function clearCart(): Promise<void>            // DELETE /api/cart
```

All functions throw an `Error` with a descriptive message on non-OK HTTP responses.

### 6.5 `useCart` Hook — `src/frontend/src/hooks/useCart.ts`

```ts
export function useCart(): {
  items: CartItem[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}
```

- Calls `fetchCart()` on mount and on each `refresh()` call.
- `error` is set from `err.message` if `err instanceof Error`, else `'Unknown error'`.

---

## 7. Edge Cases Reference Table

| Scenario | Endpoint | Result |
|---|---|---|
| POST: quantity = 0 | `POST /api/cart` | 422 — `Quantity must be between 1 and 5.` |
| POST: quantity = 6 | `POST /api/cart` | 422 — `Quantity must be between 1 and 5.` |
| POST: quantity = -1 | `POST /api/cart` | 422 — `Quantity must be between 1 and 5.` |
| POST: item has qty 4, add qty 1 → total 5 | `POST /api/cart` | 200 OK — quantity updated to 5 |
| POST: item has qty 4, add qty 2 → total 6 | `POST /api/cart` | 400 — "Adding 2 to the existing quantity of 4 would exceed the maximum of 5." |
| POST: item has qty 5, add qty 1 → total 6 | `POST /api/cart` | 400 — "Adding 1 to the existing quantity of 5 would exceed the maximum of 5." |
| POST: productId = 99 (not in catalog) | `POST /api/cart` | 404 — "Product with ID 99 does not exist in the catalog." |
| PUT: quantity = 5 (any existing qty) | `PUT /api/cart/{id}` | 200 OK — quantity set to 5 |
| PUT: quantity = 1 (any existing qty) | `PUT /api/cart/{id}` | 200 OK — quantity set to 1 |
| PUT: quantity = 0 | `PUT /api/cart/{id}` | 422 — `Quantity must be between 1 and 5.` |
| PUT: quantity = 6 | `PUT /api/cart/{id}` | 422 — `Quantity must be between 1 and 5.` |
| PUT: productId not in catalog | `PUT /api/cart/{id}` | 404 |
| PUT: productId in catalog, not in cart | `PUT /api/cart/{id}` | 201 Created (upsert) |
| DELETE: productId not in cart | `DELETE /api/cart/{id}` | 404 (no body) |
| DELETE: productId in cart | `DELETE /api/cart/{id}` | 204 No Content |
| DELETE all: cart has items | `DELETE /api/cart` | 204 No Content, cart now empty |
| DELETE all: cart already empty | `DELETE /api/cart` | 204 No Content (idempotent) |
| GET: cart empty | `GET /api/cart` | 200 OK, body: `[]` |
| GET: cart has items | `GET /api/cart` | 200 OK, body: `CartItem[]` |
| CartPanel: zero items | Frontend | Shows "Your cart is empty." — no total, no clear button |
| CartPanel: quantity selector | Frontend | Calls `onUpdateQuantity` on change — does NOT call `onRemove` |
| cartItemCount in Header | Frontend | Sum of `quantity` across all cart items, not count of line items |
