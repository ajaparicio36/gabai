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
}

export function AreaIntelCard({
  areaName,
  bulletPoints,
  sources,
  lastUpdated,
  stale,
}: AreaIntelCardProps): React.ReactNode {
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
        {bulletPoints.length === 0 ? (
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
