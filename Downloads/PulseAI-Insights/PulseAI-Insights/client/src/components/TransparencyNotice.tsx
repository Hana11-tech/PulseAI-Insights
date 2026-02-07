import { ShieldCheck } from "lucide-react";

export function TransparencyNotice() {
  return (
    <div className="bg-secondary/50 rounded-xl p-4 flex items-start gap-3 text-xs text-muted-foreground mt-8 border border-border/50">
      <ShieldCheck className="w-5 h-5 shrink-0 text-primary" />
      <p>
        <strong className="block text-foreground mb-1">Privacy & Transparency</strong>
        Insights are generated from aggregated performance data and are designed to support professional growth, not surveillance. 
        Individual data points are anonymized where possible to protect privacy.
      </p>
    </div>
  );
}
