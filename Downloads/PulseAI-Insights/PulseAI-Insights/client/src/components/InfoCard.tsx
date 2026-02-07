import { cn } from "@/lib/utils";

interface InfoCardProps {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function InfoCard({ label, value, trend, trendValue, icon, className, onClick }: InfoCardProps) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "glass-card rounded-2xl p-6 relative overflow-hidden transition-all duration-300",
        onClick && "cursor-pointer hover:shadow-md hover:border-primary/20",
        className
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{label}</h3>
        {icon && <div className="text-primary/80 bg-primary/5 p-2 rounded-lg">{icon}</div>}
      </div>
      
      <div className="flex items-end gap-3">
        <span className="text-3xl font-bold font-display text-foreground">{value}</span>
        {trend && (
          <span className={cn(
            "text-xs font-medium px-2 py-1 rounded-full mb-1",
            trend === "up" ? "bg-green-100 text-green-700" :
            trend === "down" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
          )}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendValue}
          </span>
        )}
      </div>
      
      {/* Decorative gradient blob */}
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-2xl pointer-events-none" />
    </div>
  );
}
