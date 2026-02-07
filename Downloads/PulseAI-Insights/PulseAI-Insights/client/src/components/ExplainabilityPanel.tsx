import { Info, Sparkles } from "lucide-react";

interface Reason {
  text: string;
  impact: "positive" | "negative" | "neutral";
}

interface ExplainabilityPanelProps {
  reasons: Reason[];
  confidence: "High" | "Medium" | "Low";
  summary?: string;
}

export function ExplainabilityPanel({ reasons, confidence, summary }: ExplainabilityPanelProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-lg flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Why this insight?
        </h3>
        <span className="text-xs font-medium px-2 py-1 bg-secondary rounded-full text-secondary-foreground">
          {confidence} Confidence
        </span>
      </div>
      
      <div className="space-y-3">
        {reasons.length === 0 ? (
          <p className="text-sm text-muted-foreground">No explainability data yet.</p>
        ) : (
          reasons.map((reason, idx) => (
            <div key={idx} className="flex items-start gap-3 text-sm">
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                reason.impact === 'positive' ? 'bg-green-500' : 
                reason.impact === 'negative' ? 'bg-red-500' : 'bg-blue-500'
              }`} />
              <p className="text-muted-foreground">{reason.text}</p>
            </div>
          ))
        )}
      </div>
      
      {summary && (
        <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="w-3 h-3" />
          <span>{summary}</span>
        </div>
      )}
    </div>
  );
}
