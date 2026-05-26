# Mock E-Commerce Site — Codebase Reference

## Overview

This is an educational mock e-commerce site with a React/TypeScript frontend (Vite) and an ASP.NET Core 10 backend. The two halves are developed separately but deployed together. **The cart feature is entirely stubbed out and not yet implemented.**

---

## Tech Stack — Exact Versions

| Layer | Technology | Version |
|---|---|---|
| Frontend framework | React | ^19.2.4 |
| Frontend language | TypeScript | ~6.0.2 |
| Frontend build tool | Vite | ^8.0.4 |
| Frontend test runner | Vitest | ^4.1.4 |
| Frontend test utils | @testing-library/react | ^16.3.2 |
| Backend framework | ASP.NET Core / .NET | 10.0 (net10.0) |
| Backend test framework | xUnit (via WebApplicationFactory) | — |
| JSDOM (test env) | jsdom | ^29.0.2 |

---

## Monorepo Layout

```
/
├── package.json                          ← root workspace; scripts: "test" and "test:frontend" (both run vitest run)
├── vitest.config.ts                      ← root Vitest config; setupFiles: src/frontend/src/test-setup.ts; includes test/frontend/**
├── tsconfig.json                         ← root TS config
├── src/
│   ├── backend/
│   │   ├── MockEcommerce.slnx            ← .NET solution (references Api + Tests projects)
│   │   └── MockEcommerce.Api/
│   │       ├── MockEcommerce.Api.csproj  ← TargetFramework: net10.0
│   │       ├── Program.cs                ← App entry point; registers services, CORS, OpenAPI, routes
│   │       ├── Endpoints/
│   │       │   ├── ProductEndpoints.cs   ← FULLY IMPLEMENTED: GET /api/products, GET /api/products/{id:int}
│   │       │   └── CartEndpoints.cs      ← STUBBED: all 4 handlers throw NotImplementedException
│   │       ├── Models/
│   │       │   ├── Product.cs            ← Id, Name, Description, Price, Category, Stock, ImageUrl
│   │       │   └── CartItem.cs           ← ProductId, ProductName, UnitPrice, Quantity; TotalPrice (computed)
│   │       └── Services/
│   │           ├── IProductService.cs    ← interface: GetAll(), GetById(int)
│   │           ├── MockProductService.cs ← FULLY IMPLEMENTED; hardcoded list of 5 products (see below)
│   │           ├── ICartService.cs       ← interface: GetAll(), Add(), GetByProductId(), Remove(), Clear()
│   │           └── InMemoryCartService.cs← STUBBED: all 5 methods throw NotImplementedException
│   └── frontend/
│       ├── package.json                  ← private workspace package
│       ├── vite.config.ts                ← proxies /api → http://localhost:5063
│       ├── index.html
│       └── src/
│           ├── main.tsx                  ← React root mount
│           ├── App.tsx                   ← Root component; orchestrates products, cart message, cart count
│           ├── App.css
│           ├── index.css
│           ├── test-setup.ts             ← imports @testing-library/jest-dom
│           ├── api/
│           │   └── index.ts              ← fetchProducts(), fetchProductById(id), addToCart(request)
│           ├── types/
│           │   └── index.ts              ← Product interface, AddToCartRequest interface
│           ├── hooks/
│           │   └── useProducts.ts        ← useProducts() → { products, loading, error }
│           └── components/
│               ├── Header/               ← Header.tsx + index.ts; accepts cartItemCount prop
│               ├── HeroBanner/           ← HeroBanner.tsx + index.ts; static banner
│               ├── ProductCard/          ← ProductCard.tsx + index.ts; displays one product + "Add to Cart" button
│               └── ProductList/          ← ProductList.tsx + index.ts; renders list of ProductCard; shows "No products available" when empty
└── test/
    ├── frontend/
    │   ├── App.test.tsx
    │   ├── components/
    │   │   ├── Header/Header.test.tsx
    │   │   ├── HeroBanner/HeroBanner.test.tsx
    │   │   ├── ProductCard/ProductCard.test.tsx
    │   │   └── ProductList/ProductList.test.tsx
    │   └── hooks/
    │       └── useProducts.test.ts
    └── backend/
        └── MockEcommerce.Api.Tests/
            ├── MockEcommerce.Api.Tests.csproj
            ├── Endpoints/
            │   └── ProductEndpointTests.cs   ← integration tests via WebApplicationFactory<Program>
            └── Services/
                └── MockProductServiceTests.cs
```

---

## Implementation State (Implemented vs Stubbed)

### ✅ Fully Implemented

| Component | File | Notes |
|---|---|---|
| Product catalog endpoints | `src/backend/.../Endpoints/ProductEndpoints.cs` | `GET /api/products` → 200 + `Product[]`; `GET /api/products/{id}` → 200 or 404 |
| Product service | `src/backend/.../Services/MockProductService.cs` | Returns 5 hardcoded products; no DB |
| Frontend product display | `src/frontend/src/App.tsx` + ProductList + ProductCard | Fetches products, renders list, shows loading/error states |
| Frontend API client | `src/frontend/src/api/index.ts` | `fetchProducts`, `fetchProductById`, `addToCart` all wired to `/api/*` |
| useProducts hook | `src/frontend/src/hooks/useProducts.ts` | Calls `fetchProducts()`, manages loading/error state |
| Frontend cart count UI | `src/frontend/src/App.tsx` | Increments local `cartItemCount` state; passes to `Header` |

### ❌ Stubbed — throws `NotImplementedException`

| Component | File | Stubbed Methods |
|---|---|---|
| Cart endpoints | `src/backend/.../Endpoints/CartEndpoints.cs` | `GetCart`, `AddToCart`, `RemoveFromCart`, `ClearCart` |
| InMemoryCartService | `src/backend/.../Services/InMemoryCartService.cs` | `GetAll`, `Add`, `GetByProductId`, `Remove`, `Clear` |

> **Note:** `CartEndpoints.cs` has route registrations wired up (`GET /api/cart`, `POST /api/cart`, `DELETE /api/cart/{productId}`, `DELETE /api/cart`), but every handler body is `throw new NotImplementedException()`. The frontend `addToCart()` call will fail at runtime because of this.

---

## Product Catalog (Hardcoded in MockProductService.cs)

| Id | Name | Price | Category | Stock |
|---|---|---|---|---|
| 1 | Wireless Headphones | $79.99 | Electronics | 25 |
| 2 | Running Shoes | $59.99 | Footwear | 40 |
| 3 | Stainless Steel Water Bottle | $24.99 | Accessories | 100 |
| 4 | Mechanical Keyboard | $109.99 | Electronics | 15 |
| 5 | Yoga Mat | $34.99 | Sports | 60 |

All product images use `https://placehold.co/300x300?text=<Name>`.

---

## API Endpoints

| Method | Path | Status | Response |
|---|---|---|---|
| GET | `/api/products` | ✅ Working | `Product[]` |
| GET | `/api/products/{id}` | ✅ Working | `Product` or 404 |
| GET | `/api/cart` | ❌ NotImplementedException | — |
| POST | `/api/cart` | ❌ NotImplementedException | — |
| DELETE | `/api/cart/{productId}` | ❌ NotImplementedException | — |
| DELETE | `/api/cart` | ❌ NotImplementedException | — |

OpenAPI schema is served at `/openapi/v1.json` (via `app.MapOpenApi()` in `Program.cs`).

---

## Running the Project

### Backend (ASP.NET Core API)

```bash
# From repo root — starts on http://localhost:5063
dotnet run --project src/backend/MockEcommerce.Api/MockEcommerce.Api.csproj --launch-profile http

# Or with HTTPS (http://localhost:5063 + https://localhost:7296)
dotnet run --project src/backend/MockEcommerce.Api/MockEcommerce.Api.csproj --launch-profile https
```

Requires **.NET 10 SDK**.

### Frontend (Vite dev server)

```bash
cd src/frontend
npm install   # first time only
npm run dev   # starts on http://localhost:5173
```

Vite proxies all `/api/*` requests to `http://localhost:5063` (configured in `src/frontend/vite.config.ts`).

---

## Running Tests

### Frontend Tests (Vitest)

```bash
# From repo root — preferred
npm test
# or equivalently
npm run test:frontend

# With coverage
cd src/frontend && npx vitest run --coverage
```

Test files live in `test/frontend/**/*.test.{ts,tsx}` (resolved by `vitest.config.ts` at the repo root). The setup file is `src/frontend/src/test-setup.ts` (imports `@testing-library/jest-dom`). Tests use `vi.mock(...)` to mock the API module.

### Backend Tests (xUnit)

```bash
# From repo root
dotnet test test/backend/MockEcommerce.Api.Tests/MockEcommerce.Api.Tests.csproj

# Or from backend directory
cd src/backend && dotnet test
```

Backend tests use `WebApplicationFactory<Program>` for integration-style HTTP testing (no separate test server needed). `Program` class is declared `public partial` in `Program.cs` to enable this.

---

## Key Patterns & Conventions

### Backend

- **Minimal API style** — all routes registered in static extension classes (`MapProductEndpoints`, `MapCartEndpoints`) called from `Program.cs`. No controllers.
- **Typed results** — handlers return `TypedResults.Ok(...)`, `TypedResults.NotFound()`, etc. not raw `IResult`.
- **Service registration** — both services registered as `Singleton` in `Program.cs`.
- **CORS** — default policy allows `http://localhost:5173` (frontend dev server), all headers and methods.
- **New service pattern**: create interface in `Services/I<Name>.cs`, implement in `Services/<Name>.cs`, register in `Program.cs`, map routes in `Endpoints/<Name>Endpoints.cs`.

### Frontend

- **Component barrel exports** — every component folder has an `index.ts` re-exporting the component. Import from the folder, not the file: `import { Header } from './components/Header'`.
- **API layer** — all `fetch` calls go through `src/frontend/src/api/index.ts`. Components never call `fetch` directly.
- **Hook pattern** — data fetching hooks live in `src/frontend/src/hooks/`. They call the API module and manage `loading`/`error` state.
- **Types** — shared TypeScript interfaces are in `src/frontend/src/types/index.ts`.
- **New component pattern**: create `components/<Name>/<Name>.tsx` + `components/<Name>/index.ts` barrel export.

---

## CORS & Ports

| Service | Port | Notes |
|---|---|---|
| Backend (HTTP) | 5063 | Default dev profile |
| Backend (HTTPS) | 7296 | HTTPS dev profile |
| Frontend dev | 5173 | Vite default; CORS origin in `Program.cs` |

---

## Notable Quirks

- `InMemoryCartService` holds a single shared cart (no per-user state). The `_cart` list and `_lock` field exist but all methods are unimplemented.
- The `AddToCartRequest` record is defined at the bottom of `CartEndpoints.cs` (not in `Models/`).
- Vitest config lives at the **repo root** (`vitest.config.ts`), not inside `src/frontend/`.
- Frontend package is in `src/frontend/` but tests are in `test/frontend/` — imports in test files use relative paths like `../../../src/frontend/src/...`.
- The root `package.json` declares `src/frontend` as a workspace and has `"test"` and `"test:frontend"` scripts (both run `vitest run`).
