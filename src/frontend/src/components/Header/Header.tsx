interface HeaderProps {
  cartItemCount: number;
  onCartClick: () => void;
}

export function Header({ cartItemCount, onCartClick }: HeaderProps) {
  return (
    <header className="header">
      <div className="header__inner">
        <a href="/" className="header__logo" aria-label="Mock Shop home">
          <span className="header__logo-icon" aria-hidden="true">M</span>
          <span className="header__logo-text">Mock Shop</span>
        </a>

        <nav className="header__nav" aria-label="Main navigation">
          <a href="/" className="header__nav-link header__nav-link--active">
            Products
          </a>
          <a href="/" className="header__nav-link">
            Deals
          </a>
          <a href="/" className="header__nav-link">
            New
          </a>
        </nav>

        <div className="header__actions">
          <button
            className="header__cart-button"
            onClick={onCartClick}
            aria-label={`Shopping cart with ${cartItemCount} items`}
          >
            <svg
              className="header__cart-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
            </svg>
            {cartItemCount > 0 && (
              <span aria-hidden="true">{cartItemCount}</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
