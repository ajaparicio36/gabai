'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Source {
  title: string;
  url: string;
  domain: string;
}

interface AreaIntelCardProps {
  areaName: string;
  bulletPoints: string[];
  sources: Source[];
  lastUpdated: string;
  stale: boolean;
  yieldScore?: number | null;
  yieldArticleCount?: number | null;
  yieldPositiveRatio?: number | null;
  growthScore?: number | null;
  growthConfidence?: string | null;
  growthReasoning?: string | null;
  growthDisclaimer?: string;
}

function YieldBadge({ score }: { score: number }): React.ReactNode {
  let label = 'Neutral';
  let color = 'bg-yellow-100 text-yellow-800';
  if (score >= 0.7) {
    label = 'High';
    color = 'bg-green-100 text-green-800';
  } else if (score <= 0.3) {
    label = 'Low';
    color = 'bg-red-100 text-red-800';
  }
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${color}`}
    >
      {label}
    </span>
  );
}

export function AreaIntelCard({
  areaName,
  bulletPoints,
  sources,
  lastUpdated,
  stale,
  yieldScore,
  yieldArticleCount,
  yieldPositiveRatio,
  growthScore,
  growthConfidence,
  growthReasoning,
  growthDisclaimer,
}: AreaIntelCardProps): React.ReactNode {
  const hasYield = yieldScore !== null && yieldScore !== undefined;
  const hasGrowth = growthScore !== null && growthScore !== undefined;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Area Intelligence — {areaName}
          </CardTitle>
          {stale && (
            <span className="text-xs text-muted-foreground">(cached)</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasYield && (
          <div className="space-y-1.5 rounded-md border bg-muted/40 p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Yield Score</span>
              <YieldBadge score={yieldScore} />
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.round(yieldScore * 100)}%` }}
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              {yieldArticleCount !== null &&
                yieldArticleCount !== undefined && (
                  <span>{yieldArticleCount} articles</span>
                )}
              {yieldPositiveRatio !== null &&
                yieldPositiveRatio !== undefined && (
                  <span>{Math.round(yieldPositiveRatio * 100)}% positive</span>
                )}
            </div>
          </div>
        )}

        {hasGrowth ? (
          <div className="space-y-1.5 rounded-md border bg-primary/5 p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Growth Estimate</span>
              <span className="text-xs font-semibold tabular-nums">
                ~{Math.round(growthScore)}% annually
              </span>
            </div>
            {growthConfidence && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground capitalize">
                  Confidence:
                </span>
                <span
                  className={`text-[10px] font-medium capitalize ${
                    growthConfidence === 'high'
                      ? 'text-green-600'
                      : growthConfidence === 'medium'
                        ? 'text-yellow-600'
                        : 'text-muted-foreground'
                  }`}
                >
                  {growthConfidence}
                </span>
              </div>
            )}
            {growthReasoning && (
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                {growthReasoning}
              </p>
            )}
            <p className="text-[9px] italic text-muted-foreground/70">
              {growthDisclaimer ??
                'AI-generated estimate based on recent news and development data.'}
            </p>
          </div>
        ) : bulletPoints.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No recent developments found for this area.
          </p>
        ) : (
          <ul className="space-y-2">
            {bulletPoints.map((point, i) => (
              <li
                key={i}
                className="text-xs leading-relaxed text-muted-foreground flex gap-1"
              >
                <span className="text-foreground font-medium">-</span>
                {point}
              </li>
            ))}
          </ul>
        )}

        <div className="border-t pt-2 space-y-1">
          <p className="text-[10px] text-muted-foreground">
            Last updated: {new Date(lastUpdated).toLocaleDateString()}
          </p>
          <div className="flex flex-wrap gap-1">
            {sources.map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-primary"
              >
                [{i + 1}] {s.domain}
              </a>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
