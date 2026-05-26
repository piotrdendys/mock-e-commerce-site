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
