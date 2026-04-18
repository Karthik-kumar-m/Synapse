import React from 'react';
import { Sparkles, MessageSquare } from 'lucide-react';
import type { ProductSummary } from '../api';

interface ProductSelectorProps {
  products: ProductSummary[];
  selectedProductId: string;
  onSelectProduct: (id: string) => void;
}

export function ProductSelector({ products, selectedProductId, onSelectProduct }: ProductSelectorProps) {
  if (!products.length) {
    return (
      <div className="rounded-[20px] border border-border bg-white p-6 text-sm font-medium text-muted-foreground">
        No products found yet. Ingest reviews to populate dashboard products.
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-[#E5E5EA] bg-white/80 p-3 shadow-sm">
      <div className="flex gap-4 overflow-x-auto pb-1 hide-scrollbar">
      {products.map((product) => {
        const isSelected = product.product_id === selectedProductId;
        const sentimentPct = Math.max(0, Math.min(100, Math.round((product.avg_sentiment_score ?? 0) * 10)));

        return (
          <button
            key={product.product_id}
            onClick={() => onSelectProduct(product.product_id)}
            className={`flex items-center gap-4 p-3 pr-6 rounded-[20px] transition-all duration-300 text-left min-w-[280px] shrink-0 border bg-card my-1 ml-1 ${
              isSelected 
                ? 'border-[#0071E3] shadow-[0_0_0_1px_rgba(0,113,227,1),0_4px_20px_rgba(0,113,227,0.15)] scale-[1.02]' 
                : 'border-border shadow-sm hover:border-border hover:shadow-md hover:bg-secondary/50'
            }`}
          >
            <div className="w-16 h-16 rounded-[14px] bg-secondary overflow-hidden shrink-0 flex items-center justify-center">
              <span className="text-xl font-bold text-muted-foreground">
                {product.product_name?.charAt(0)?.toUpperCase() || 'P'}
              </span>
            </div>
            
            <div className="flex flex-col justify-center gap-1.5 flex-1">
              <h3 className={`text-[15px] font-bold tracking-tight ${isSelected ? 'text-primary' : 'text-foreground'} line-clamp-1`}>
                {product.product_name}
              </h3>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <MessageSquare size={12} className="text-muted-foreground" />
                  <span className="text-[12px] font-medium text-muted-foreground">
                    {product.total_reviews.toLocaleString()}
                  </span>
                </div>
                <div className="w-[1px] h-3 bg-border" />
                <div className="flex items-center gap-1">
                  <Sparkles size={12} className={isSelected ? 'text-chart-2' : 'text-muted-foreground'} />
                  <span className={`text-[12px] font-bold ${isSelected ? 'text-chart-2' : 'text-muted-foreground'}`}>
                    {sentimentPct}%
                  </span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
      </div>
    </div>
  );
}