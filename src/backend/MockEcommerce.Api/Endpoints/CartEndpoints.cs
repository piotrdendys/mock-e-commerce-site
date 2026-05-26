using Microsoft.AspNetCore.Http.HttpResults;
using MockEcommerce.Api.Models;
using MockEcommerce.Api.Services;

namespace MockEcommerce.Api.Endpoints;

/// <summary>
/// Maps shopping cart endpoints under <c>/api/cart</c>.
/// </summary>
public static class CartEndpoints
{
    /// <summary>Registers cart-related routes on the given endpoint route builder.</summary>
    public static void MapCartEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("api/cart")
            .WithTags("Cart");

        group.MapGet("/", GetCart)
            .WithName("GetCart")
            .WithSummary("Returns all items currently in the cart.");

        group.MapPost("/", AddToCart)
            .WithName("AddToCart")
            .WithSummary("Adds a product to the cart or increments quantity if already present.");

        group.MapPut("/{productId:int}", UpdateCartItem)
            .WithName("UpdateCartItem")
            .WithSummary("Sets the quantity of a cart item to an exact value. Creates the item if not already in the cart.");

        group.MapDelete("/{productId:int}", RemoveFromCart)
            .WithName("RemoveFromCart")
            .WithSummary("Removes a single product from the cart by its product ID.");

        group.MapDelete("/", ClearCart)
            .WithName("ClearCart")
            .WithSummary("Removes all items from the cart.");
    }

    /// <summary>Returns all items currently in the cart.</summary>
    internal static Ok<IEnumerable<CartItem>> GetCart(ICartService cartService)
        => TypedResults.Ok(cartService.GetAll());

    /// <summary>Adds a product to the cart or increments quantity if already present.</summary>
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

    /// <summary>Sets the quantity of a cart item to an exact value. Creates the item if not already in the cart.</summary>
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

    /// <summary>Removes a single product from the cart by its product ID.</summary>
    internal static Results<NoContent, NotFound> RemoveFromCart(int productId, ICartService cartService)
    {
        var removed = cartService.Remove(productId);
        return removed ? TypedResults.NoContent() : TypedResults.NotFound();
    }

    /// <summary>Removes all items from the cart.</summary>
    internal static NoContent ClearCart(ICartService cartService)
    {
        cartService.Clear();
        return TypedResults.NoContent();
    }
}

/// <summary>Request body for adding a product to the cart.</summary>
public record AddToCartRequest(int ProductId, int Quantity);

/// <summary>Request body for updating the quantity of an existing cart item.</summary>
public record UpdateCartItemRequest(int Quantity);
