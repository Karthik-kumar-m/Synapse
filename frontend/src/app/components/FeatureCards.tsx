import { ImageWithFallback } from './figma/ImageWithFallback';

export function FeatureCards() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 py-12">
      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Left Card - Larger */}
        <div className="relative overflow-hidden rounded-3xl bg-white border border-black/[0.06] group cursor-pointer hover:shadow-xl hover:shadow-black/5 transition-all duration-300">
          <div className="relative h-[500px]">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1765648684555-de2d0f6af467?w=1200"
              alt="Workspace"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
            
            <div className="absolute top-8 left-8 max-w-md">
              <h3 className="text-4xl font-semibold text-white mb-3 leading-tight">
                Designed for professionals
              </h3>
              <p className="text-white/90 text-lg mb-6">
                The tools you need to do your best work.
              </p>
              <button className="px-6 py-2.5 bg-white text-[#1D1D1F] rounded-full text-sm font-medium hover:bg-white/90 transition-colors shadow-md">
                Shop Mac
              </button>
            </div>
          </div>
        </div>

        {/* Right Card */}
        <div className="relative overflow-hidden rounded-3xl bg-white border border-black/[0.06] group cursor-pointer hover:shadow-xl hover:shadow-black/5 transition-all duration-300">
          <div className="relative h-[500px]">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1759150467548-5a97257e583a?w=1200"
              alt="Creative Studio"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
            
            <div className="absolute top-8 left-8 max-w-md">
              <h3 className="text-4xl font-semibold text-white mb-3 leading-tight">
                Unleash your creativity
              </h3>
              <p className="text-white/90 text-lg mb-6">
                Powerful tools for your biggest ideas.
              </p>
              <button className="px-6 py-2.5 bg-white text-[#1D1D1F] rounded-full text-sm font-medium hover:bg-white/90 transition-colors shadow-md">
                Explore iPad
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full Width Card */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0066CC] group cursor-pointer hover:shadow-xl hover:shadow-[#0066CC]/20 transition-all duration-300">
        <div className="relative h-[300px] flex items-center justify-center">
          <div className="text-center px-8">
            <h3 className="text-5xl font-semibold text-white mb-4 leading-tight">
              Special financing available
            </h3>
            <p className="text-white/90 text-lg mb-6">
              Pay over time, interest-free when you choose to check out with Apple Card Monthly Installments.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button className="px-6 py-2.5 bg-white text-[#0066CC] rounded-full text-sm font-medium hover:bg-white/90 transition-colors shadow-md">
                Learn more
              </button>
              <button className="px-6 py-2.5 border border-white text-white rounded-full text-sm font-medium hover:bg-white/10 transition-colors">
                Apply now
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
