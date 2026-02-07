import { AlertCircle, TrendingDown, Sparkles, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AlertCardProps {
  type: string;
  employeeName: string;
  reason: string;
  confidence: string;
  onAction: () => void;
  isResolving?: boolean;
  onRefreshAi?: () => void;
  isRefreshing?: boolean;
}

export function AlertCard({
  type,
  employeeName,
  reason,
  confidence,
  onAction,
  isResolving,
  onRefreshAi,
  isRefreshing,
}: AlertCardProps) {
  const getIcon = () => {
    switch (type) {
      case 'burnout_risk': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'performance_decline': return <TrendingDown className="w-5 h-5 text-orange-500" />;
      case 'emerging_talent': return <Sparkles className="w-5 h-5 text-blue-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getConfidenceColor = () => {
    switch (confidence.toLowerCase()) {
      case 'high': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="group bg-card rounded-xl p-5 border border-border/50 shadow-sm hover:shadow-md hover:border-border transition-all duration-300">
      <div className="flex justify-between items-start gap-4">
        <div className="flex gap-4">
          <div className="mt-1 p-2 bg-secondary rounded-full group-hover:bg-white group-hover:shadow-sm transition-all duration-300">
            {getIcon()}
          </div>
          <div>
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              {employeeName}
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wide", getConfidenceColor())}>
                {confidence} Confidence
              </span>
            </h4>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-md">
              {reason}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Button 
            variant="outline" 
            size="sm"
            onClick={onAction}
            disabled={isResolving}
            className="hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
          >
            {isResolving ? (
              "Resolving..."
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Resolve
              </>
            )}
          </Button>
          {onRefreshAi && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefreshAi}
              disabled={isRefreshing}
              className="text-xs"
            >
              {isRefreshing ? "Clicking..." : "Click AI"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
