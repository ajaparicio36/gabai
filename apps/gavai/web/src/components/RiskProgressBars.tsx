'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { RiskAssessmentResponse } from '@/types/api';

interface RiskProgressBarsProps {
  riskScores: RiskAssessmentResponse;
}

function scoreToColor(score: number): string {
  if (score >= 0.7) return 'bg-emerald-500';
  if (score >= 0.4) return 'bg-amber-500';
  return 'bg-red-500';
}

function floodDescription(level: string): string {
  switch (level) {
    case 'none':
      return 'No known hazard (safe area)';
    case 'low':
      return 'Low risk (0\u20130.5m shallow flooding)';
    case 'medium':
      return 'Medium risk (0.5\u20131.5m flooding)';
    case 'high':
      return 'High risk (>1.5m deep flooding)';
    default:
      return level;
  }
}

function getBarLabel(axis: string): { left: string; right: string } {
  switch (axis) {
    case 'Flood':
      return { left: 'High flood risk', right: 'No flood risk' };
    case 'Traffic':
      return { left: 'Smooth traffic', right: 'Heavy congestion' };
    case 'Growth':
      return { left: 'Stagnant area', right: 'Booming growth' };
    default:
      return { left: 'Low', right: 'High' };
  }
}

function formatDetail(
  axis: string,
  _scores: RiskAssessmentResponse['scores'],
  metadata: RiskAssessmentResponse['metadata'],
): string {
  switch (axis) {
    case 'Flood':
      return metadata.flood
        ? `${floodDescription(metadata.flood.level)}\nReturn: ${metadata.flood.returnPeriod || '5yr'}\nSource: ${metadata.flood.source}`
        : 'No data';
    case 'Traffic':
      return metadata.traffic
        ? `Delay: ${(metadata.traffic.delayPercent * 100).toFixed(0)}%\nCached: ${new Date(metadata.traffic.cachedAt).toLocaleDateString()}`
        : 'No data';
    case 'Growth':
      return metadata.yield
        ? `Based on ${metadata.yield.articleCount} area news articles\n${(metadata.yield.positiveRatio * 100).toFixed(0)}% positive sentiment\nHigher = more development activity nearby. This is NOT rental yield.`
        : 'No data';
    default:
      return '';
  }
}

interface BarConfig {
  axis: string;
  score: number;
}

export function RiskProgressBars({
  riskScores,
}: RiskProgressBarsProps): React.ReactNode {
  const bars: BarConfig[] = [
    { axis: 'Flood', score: riskScores.scores.flood ?? 0.5 },
    { axis: 'Traffic', score: riskScores.scores.traffic ?? 0.5 },
    { axis: 'Growth', score: riskScores.scores.yield ?? 0.5 },
  ];

  return (
    <TooltipProvider>
      <div className="w-full">
        <p className="text-xs font-medium mb-3">Risk Assessment</p>
        <div className="space-y-3">
          {bars.map((bar) => {
            const displayScore =
              bar.axis === 'Traffic' ? 1 - bar.score : bar.score;
            const percentage = Math.round(displayScore * 100);
            const labels = getBarLabel(bar.axis);
            const color = scoreToColor(displayScore);
            const detail = formatDetail(
              bar.axis,
              riskScores.scores,
              riskScores.metadata,
            );

            return (
              <div key={bar.axis} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">
                    {bar.axis}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {percentage}%
                  </span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative h-2.5 w-full cursor-pointer rounded-full bg-muted">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full transition-all ${color}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px]">
                    {detail.split('\n').map((line, i) => (
                      <p key={i} className="text-xs">
                        {line}
                      </p>
                    ))}
                  </TooltipContent>
                </Tooltip>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{labels.left}</span>
                  <span>{labels.right}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center gap-3 mt-3">
          <span className="flex items-center gap-1 text-xs">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Good
          </span>
          <span className="flex items-center gap-1 text-xs">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            Fair
          </span>
          <span className="flex items-center gap-1 text-xs">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            Poor
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}
