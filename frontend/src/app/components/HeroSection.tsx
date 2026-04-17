import { Laptop, Smartphone, Watch, Tablet, Headphones, Tv } from 'lucide-react';

export function HeroSection() {
  const quickLinks = [
    { icon: Laptop, label: 'Mac' },
    { icon: Smartphone, label: 'iPhone' },
    { icon: Tablet, label: 'iPad' },
    { icon: Watch, label: 'Watch' },
    { icon: Headphones, label: 'Airpods' },
    { icon: Tv, label: 'TV' },
  ];

  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-12 pb-16">
      <div className="max-w-4xl">
        <h1 className="text-5xl font-semibold text-[#1D1D1F] leading-tight tracking-tight mb-10">
          Store. The best way to buy
          <br />
          the products you love.
        </h1>

        <div className="flex items-center gap-6">
          {quickLinks.map((link) => (
            <button
              key={link.label}
              className="group flex flex-col items-center gap-2"
            >
              <div className="w-14 h-14 rounded-full bg-white border border-black/[0.06] flex items-center justify-center group-hover:border-[#0066CC] transition-colors shadow-sm">
                <link.icon className="w-6 h-6 text-[#1D1D1F] group-hover:text-[#0066CC] transition-colors" strokeWidth={1.5} />
              </div>
              <span className="text-xs text-[#86868B] group-hover:text-[#0066CC] transition-colors">
                {link.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
