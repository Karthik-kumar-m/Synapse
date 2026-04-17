import { Search, ShoppingBag } from 'lucide-react';

export function Navigation() {
  const navItems = ['Store', 'Mac', 'iPad', 'iPhone', 'Watch', 'Accessories', 'Support'];

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/[0.06]">
      <div className="max-w-[1400px] mx-auto px-6 h-12 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center">
          <span className="text-2xl font-semibold text-[#1D1D1F]">Store</span>
        </div>

        {/* Center Navigation Links */}
        <div className="flex items-center gap-8">
          {navItems.map((item) => (
            <button
              key={item}
              className="text-xs text-[#1D1D1F] hover:text-[#0066CC] transition-colors"
            >
              {item}
            </button>
          ))}
        </div>

        {/* Right Icons */}
        <div className="flex items-center gap-5">
          <button className="text-[#1D1D1F] hover:text-[#0066CC] transition-colors">
            <Search className="w-4 h-4" strokeWidth={2} />
          </button>
          <button className="text-[#1D1D1F] hover:text-[#0066CC] transition-colors">
            <ShoppingBag className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </nav>
  );
}
