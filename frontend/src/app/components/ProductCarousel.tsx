import { ImageWithFallback } from './figma/ImageWithFallback';

interface Product {
  id: string;
  name: string;
  price: string;
  image: string;
  isNew?: boolean;
}

const products: Product[] = [
  {
    id: '1',
    name: 'MacBook Pro 14"',
    price: '$1,999',
    image: 'https://images.unsplash.com/photo-1759668358492-927c1a1062b0?w=600',
    isNew: true,
  },
  {
    id: '2',
    name: 'iPhone 15 Pro',
    price: '$999',
    image: 'https://images.unsplash.com/photo-1522585136005-d014f6cf939e?w=600',
    isNew: true,
  },
  {
    id: '3',
    name: 'Apple Watch Ultra',
    price: '$799',
    image: 'https://images.unsplash.com/photo-1579721840641-7d0e67f1204e?w=600',
  },
  {
    id: '4',
    name: 'AirPods Max',
    price: '$549',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600',
  },
  {
    id: '5',
    name: 'iPad Pro 12.9"',
    price: '$1,099',
    image: 'https://images.unsplash.com/photo-1769603795371-ad63bd85d524?w=600',
    isNew: true,
  },
];

export function ProductCarousel() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 py-12">
      <h2 className="text-2xl font-semibold text-[#1D1D1F] mb-8">
        The latest. <span className="text-[#86868B]">Take a look at what's new, right now.</span>
      </h2>

      <div className="overflow-x-auto overflow-y-visible pb-4 -mx-6 px-6">
        <div className="flex gap-5 min-w-max">
          {products.map((product) => (
            <div
              key={product.id}
              className="group w-80 bg-white rounded-3xl p-8 border border-black/[0.06] hover:shadow-lg hover:shadow-black/5 transition-all duration-300 cursor-pointer"
            >
              {/* Product Image */}
              <div className="relative aspect-square mb-6 flex items-center justify-center overflow-hidden rounded-2xl">
                <ImageWithFallback
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                {product.isNew && (
                  <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#FF9500] text-white text-xs font-medium">
                    New
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-[#1D1D1F] group-hover:text-[#0066CC] transition-colors">
                  {product.name}
                </h3>
                <p className="text-sm text-[#86868B]">From {product.price}</p>
                <button className="text-sm text-[#0066CC] hover:underline font-medium">
                  Buy →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
