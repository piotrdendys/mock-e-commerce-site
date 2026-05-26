using MockEcommerce.Api.Models;

namespace MockEcommerce.Api.Services;

/// <summary>
/// Defines operations for managing shopping cart items.
/// </summary>
public interface ICartService
{
    /// <summary>Returns all items currently in the cart.</summary>
    IEnumerable<CartItem> GetAll();

    /// <summary>
    /// Upserts a cart item. If an item with the same <see cref="CartItem.ProductId"/>
    /// already exists it is replaced in full. If not, the item is added.
    /// No quantity validation is performed here — callers must validate before invoking.
    /// </summary>
    CartItem Add(CartItem item);

    /// <summary>
    /// Finds an existing cart item by product ID.
    /// </summary>
    /// <param name="productId">The product ID to look up.</param>
    /// <returns>The matching cart item, or <c>null</c> if not found.</returns>
    CartItem? GetByProductId(int productId);

    /// <summary>
    /// Removes a cart item by product ID.
    /// </summary>
    /// <param name="productId">The product ID to remove.</param>
    /// <returns><c>true</c> if the item was found and removed; otherwise <c>false</c>.</returns>
    bool Remove(int productId);

    /// <summary>Removes all items from the cart.</summary>
    void Clear();
}
