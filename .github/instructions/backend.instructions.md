---
description: "Use when writing, reading, or modifying any C# backend code, ASP.NET Core endpoints, services, models, or backend tests. Covers Minimal API patterns, service layer, cart stub, and xUnit integration tests."
applyTo: ["src/backend/**", "test/backend/**"]
---

# Backend — ASP.NET Core 10 (net10.0)

## Project Structure

```
src/backend/
├── MockEcommerce.slnx                    ← .NET solution
└── MockEcommerce.Api/
    ├── MockEcommerce.Api.csproj          ← TargetFramework: net10.0; only NuGet dep: Microsoft.AspNetCore.OpenApi 10.0.5
    ├── Program.cs                        ← entry point; all service/CORS/route wiring
    ├── Endpoints/
    │   ├── ProductEndpoints.cs           ← IMPLEMENTED: GET /api/products, GET /api/products/{id:int}
    │   └── CartEndpoints.cs              ← STUBBED: 4 handlers all throw NotImplementedException
    ├── Models/
    │   ├── Product.cs                    ← Id(int), Name, Description, Price(decimal), Category, Stock(int), ImageUrl
    │   └── CartItem.cs                   ← ProductId(int), ProductName, UnitPrice(decimal), Quantity(int), TotalPrice (computed: UnitPrice×Quantity)
    └── Services/
        ├── IProductService.cs            ← GetAll() → IEnumerable<Product>; GetById(int) → Product?
        ├── MockProductService.cs         ← IMPLEMENTED; returns 5 hardcoded products (see product table below)
        ├── ICartService.cs               ← GetAll(), Add(CartItem), GetByProductId(int), Remove(int)→bool, Clear()
        └── InMemoryCartService.cs        ← STUBBED: _cart (List<CartItem>) + _lock (Lock) exist but all 5 methods throw NotImplementedException

test/backend/MockEcommerce.Api.Tests/
├── MockEcommerce.Api.Tests.csproj
├── Endpoints/ProductEndpointTests.cs     ← integration tests for GET /api/products and GET /api/products/{id}
└── Services/MockProductServiceTests.cs  ← unit tests for MockProductService
```

## Program.cs Wiring (exact order)

```csharp
builder.Services.AddOpenApi();
builder.Services.AddSingleton<IProductService, MockProductService>();
builder.Services.AddSingleton<ICartService, InMemoryCartService>();
// CORS: allows http://localhost:5173, AllowAnyHeader, AllowAnyMethod
app.UseCors();
app.MapOpenApi();             // → /openapi/v1.json
app.MapProductEndpoints();
app.MapCartEndpoints();
```

`Program` is `public partial class` to support `WebApplicationFactory<Program>` in tests.

## Minimal API Pattern

All routes live in static extension classes. Follow this exact pattern when adding endpoints:

```csharp
public static class FooEndpoints
{
    public static void MapFooEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("api/foo").WithTags("Foo");
        group.MapGet("/", GetAll).WithName("GetAllFoo");
    }

    internal static Ok<IEnumerable<Foo>> GetAll(IFooService fooService)
        => TypedResults.Ok(fooService.GetAll());
}
```

- Use `TypedResults.Ok(...)`, `TypedResults.NotFound()`, `TypedResults.Created(...)`, `TypedResults.NoContent()` — never raw `IResult`.
- Handler return type must be a typed union: e.g. `Results<Ok<CartItem>, NotFound<string>, ValidationProblem>`.
- Register new `MapFooEndpoints()` call in `Program.cs`.
- Register new service as `Singleton` in `Program.cs`.

## Cart Endpoints — Registered Routes (all stubbed)

| Method | Path | Handler | Expected return type |
|---|---|---|---|
| GET | `/api/cart` | `GetCart` | `Ok<IEnumerable<CartItem>>` |
| POST | `/api/cart` | `AddToCart` | `Results<Created<CartItem>, Ok<CartItem>, NotFound<string>, ValidationProblem>` |
| DELETE | `/api/cart/{productId:int}` | `RemoveFromCart` | `Results<NoContent, NotFound>` |
| DELETE | `/api/cart` | `ClearCart` | `NoContent` |

`AddToCartRequest` record is defined at the **bottom of `CartEndpoints.cs`** (not in `Models/`):
```csharp
public record AddToCartRequest(int ProductId, int Quantity);
```

## Product Catalog (hardcoded in MockProductService.cs)

| Id | Name | Price | Category | Stock | ImageUrl |
|---|---|---|---|---|---|
| 1 | Wireless Headphones | 79.99 | Electronics | 25 | `https://placehold.co/300x300?text=Headphones` |
| 2 | Running Shoes | 59.99 | Footwear | 40 | `https://placehold.co/300x300?text=Running+Shoes` |
| 3 | Stainless Steel Water Bottle | 24.99 | Accessories | 100 | `https://placehold.co/300x300?text=Water+Bottle` |
| 4 | Mechanical Keyboard | 109.99 | Electronics | 15 | `https://placehold.co/300x300?text=Keyboard` |
| 5 | Yoga Mat | 34.99 | Sports | 60 | `https://placehold.co/300x300?text=Yoga+Mat` |

## Backend Tests

- Framework: **xUnit** with `WebApplicationFactory<Program>` (no separate test server).
- Test project: `test/backend/MockEcommerce.Api.Tests/MockEcommerce.Api.Tests.csproj`
- Run command (from repo root): `dotnet test test/backend/MockEcommerce.Api.Tests/MockEcommerce.Api.Tests.csproj`
- Or: `cd src/backend && dotnet test`

Pattern for new integration tests:
```csharp
public class FooEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    public FooEndpointTests(WebApplicationFactory<Program> factory)
        => _client = factory.CreateClient();

    [Fact]
    public async Task GetAll_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/foo");
        response.EnsureSuccessStatusCode();
        var items = await response.Content.ReadFromJsonAsync<List<Foo>>();
        Assert.NotNull(items);
    }
}
```

## Running the Backend

```bash
# HTTP only — listens on http://localhost:5063
dotnet run --project src/backend/MockEcommerce.Api/MockEcommerce.Api.csproj --launch-profile http

# HTTP + HTTPS — http://localhost:5063 and https://localhost:7296
dotnet run --project src/backend/MockEcommerce.Api/MockEcommerce.Api.csproj --launch-profile https
```

Requires .NET 10 SDK. Launch profiles defined in `src/backend/MockEcommerce.Api/Properties/launchSettings.json`.
