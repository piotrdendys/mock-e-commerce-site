---
description: "Use when writing, reading, or modifying React components, hooks, API calls, TypeScript types, or frontend tests. Covers component barrel export pattern, API layer, hook pattern, Vitest test setup, and vi.mock conventions."
applyTo: ["src/frontend/**", "test/frontend/**"]
---

# Frontend — React 19 + TypeScript + Vite

## Key File Map

| File | Purpose |
|---|---|
| `src/frontend/src/main.tsx` | React root mount (`ReactDOM.createRoot`) |
| `src/frontend/src/App.tsx` | Root component; owns `cartItemCount` state, `cartMessage` state, calls `addToCart()`, renders Header + HeroBanner + ProductList |
| `src/frontend/src/api/index.ts` | **All** `fetch` calls; exports `fetchProducts()`, `fetchProductById(id)`, `addToCart(request)` |
| `src/frontend/src/types/index.ts` | Shared interfaces: `Product`, `AddToCartRequest` |
| `src/frontend/src/hooks/useProducts.ts` | `useProducts()` → `{ products, loading, error }` |
| `src/frontend/src/test-setup.ts` | Imports `@testing-library/jest-dom` |
| `src/frontend/vite.config.ts` | Proxies `/api/*` → `http://localhost:5063` |
| `vitest.config.ts` (**repo root**) | Vitest config; `include: ['test/frontend/**']`; `setupFiles: ['src/frontend/src/test-setup.ts']`; `environment: 'jsdom'` |

## TypeScript Interfaces (src/frontend/src/types/index.ts)

```ts
export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  imageUrl: string;
}

export interface AddToCartRequest {
  productId: number;
  quantity: number;
}
```

## API Layer (src/frontend/src/api/index.ts)

```ts
const BASE_URL = '/api';

fetchProducts(): Promise<Product[]>        // GET /api/products
fetchProductById(id): Promise<Product>     // GET /api/products/{id}
addToCart(request): Promise<CartItem>      // POST /api/cart — ❌ backend not implemented
```

> `addToCart` always throws at runtime because the backend `POST /api/cart` handler is stubbed (`throw new NotImplementedException()`).

Components must **never** call `fetch` directly — always go through `src/frontend/src/api/index.ts`.

## Hook Pattern

```ts
// src/frontend/src/hooks/useProducts.ts
export function useProducts(): { products: Product[]; loading: boolean; error: string | null }
```

- Hooks live in `src/frontend/src/hooks/`.
- Each hook calls the API module and manages `loading` / `error` state.
- The `error` field is set from `err.message` if `err instanceof Error`, else `'Unknown error'`.

## Component Conventions

Every component lives in its own folder with a barrel export:

```
src/frontend/src/components/
├── Header/
│   ├── Header.tsx        ← accepts: cartItemCount: number
│   └── index.ts          ← re-exports Header
├── HeroBanner/
│   ├── HeroBanner.tsx    ← static; no props
│   └── index.ts
├── ProductCard/
│   ├── ProductCard.tsx   ← accepts: product: Product, onAddToCart: (product: Product) => void
│   └── index.ts
└── ProductList/
    ├── ProductList.tsx   ← accepts: products: Product[], onAddToCart: (product: Product) => void; renders "No products available" when empty
    └── index.ts
```

**Always** import from the folder (barrel), not the file:
```ts
// ✅ correct
import { Header } from './components/Header';
// ❌ wrong
import { Header } from './components/Header/Header';
```

New component pattern: create `components/<Name>/<Name>.tsx` + `components/<Name>/index.ts`.

## Frontend Tests

### Location & Config

- Test files: `test/frontend/**/*.test.{ts,tsx}` (NOT inside `src/frontend/`)
- Vitest config: `vitest.config.ts` at **repo root** (not inside `src/frontend/`)
- Imports inside test files use relative paths: `'../../../src/frontend/src/...'`

### Run Commands

```bash
# From repo root (preferred)
npm test
npm run test:frontend

# With coverage
cd src/frontend && npx vitest run --coverage
```

Both `npm test` and `npm run test:frontend` in root `package.json` run `vitest run`.

### Mocking Pattern

Tests mock the entire API module so no real HTTP calls are made:

```ts
vi.mock('../../../src/frontend/src/api');
// or for hooks that call the api:
vi.mock('../../../src/frontend/src/hooks/useProducts');

import { fetchProducts } from '../../../src/frontend/src/api';
const mockedFetchProducts = vi.mocked(fetchProducts);

mockedFetchProducts.mockResolvedValue(mockProducts);
mockedFetchProducts.mockRejectedValue(new Error('Network error'));
mockedFetchProducts.mockReturnValue(new Promise(() => {})); // never resolves → loading state
```

`afterEach(() => { vi.restoreAllMocks(); })` is used in every describe block.

### Test Example for a Hook

```ts
import { renderHook, waitFor } from '@testing-library/react';
const { result } = renderHook(() => useProducts());
await waitFor(() => expect(result.current.loading).toBe(false));
```

### Test Example for a Component

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
render(<ProductList products={mockProducts} onAddToCart={() => {}} />);
expect(screen.getByRole('list', { name: /product list/i })).toBeInTheDocument();
```

## Running the Frontend Dev Server

```bash
cd src/frontend
npm install   # first time
npm run dev   # http://localhost:5173
```

All `/api/*` requests are proxied to `http://localhost:5063` (backend). Both servers must be running for the app to work end-to-end.

## Dependency Versions

| Package | Version |
|---|---|
| react | ^19.2.4 |
| typescript | ~6.0.2 |
| vite | ^8.0.4 |
| vitest | ^4.1.4 |
| @testing-library/react | ^16.3.2 |
| @testing-library/user-event | ^14.6.1 |
| jsdom | ^29.0.2 |
