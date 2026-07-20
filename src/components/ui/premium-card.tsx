import * as React from "react";
import { cn } from "@/lib/utils";

interface PremiumCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'gradient' | 'bordered';
  hover?: boolean;
  glow?: boolean;
  children: React.ReactNode;
}

const PremiumCard = React.forwardRef<HTMLDivElement, PremiumCardProps>(
  ({ className, variant = 'default', hover = false, glow = false, children, ...props }, ref) => {
    const variants = {
      default: 'bg-white border border-slate-200 shadow-sm',
      glass: 'bg-white/70 backdrop-blur-xl border border-white/20 shadow-lg shadow-black/5',
      gradient: 'bg-gradient-to-br from-white to-emerald-50/50 border border-emerald-100 shadow-md shadow-emerald-500/5',
      bordered: 'bg-transparent border-2 border-slate-200',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl transition-all duration-300',
          variants[variant],
          hover && 'hover:shadow-lg hover:-translate-y-0.5 cursor-pointer',
          glow && 'shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
PremiumCard.displayName = "PremiumCard";

// Sub-components
const PremiumCardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 pb-0", className)} {...props} />
);

const PremiumCardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6", className)} {...props} />
);

const PremiumCardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-lg font-semibold text-slate-900 tracking-tight", className)} {...props} />
);

const PremiumCardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-slate-500 mt-1", className)} {...props} />
);

export { PremiumCard, PremiumCardHeader, PremiumCardContent, PremiumCardTitle, PremiumCardDescription };
