'use client';

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { RiskAssessmentResponse } from '@/types/api';

interface SpiderChartProps {
  riskScores: RiskAssessmentResponse;
}

interface ChartDataPoint {
  axis: string;
  score: number;
  fullMark: number;
  color: string;
  detail: string;
}

function scoreToColor(score: number): string {
  if (score >= 0.7) return '#10b981';
  if (score >= 0.4) return '#f59e0b';
  return '#ef4444';
}

function formatDetail(
  axis: string,
  scores: RiskAssessmentResponse['scores'],
  metadata: RiskAssessmentResponse['metadata'],
): string {
  switch (axis) {
    case 'Flood':
      return metadata.flood
        ? `Level: ${metadata.flood.level}\nSource: ${metadata.flood.source}\nPeriod: ${metadata.flood.returnPeriod}`
        : 'No data';
    case 'Traffic':
      return metadata.traffic
        ? `Speed Ratio: ${metadata.traffic.speedRatio.toFixed(2)}\nCached: ${new Date(metadata.traffic.cachedAt).toLocaleDateString()}`
        : 'No data';
    case 'Yield':
      return metadata.yield
        ? `Articles: ${metadata.yield.articleCount}\nPositive: ${(metadata.yield.positiveRatio * 100).toFixed(0)}%`
        : 'No data';
    case 'Market':
      return metadata.marketPremium
        ? `AVM/sqm: PHP ${metadata.marketPremium.avmPerSqm.toLocaleString()}\nZonal/sqm: PHP ${metadata.marketPremium.zonalPerSqm.toLocaleString()}\nRatio: ${metadata.marketPremium.ratio.toFixed(2)}x`
        : 'No data';
    case 'Fault':
      return metadata.fault?.status ?? 'Placeholder';
    default:
      return '';
  }
}

export function SpiderChart({ riskScores }: SpiderChartProps): React.ReactNode {
  const data: ChartDataPoint[] = [
    {
      axis: 'Flood',
      score: riskScores.scores.flood ?? 0.5,
      fullMark: 1,
      color: scoreToColor(riskScores.scores.flood ?? 0.5),
      detail: formatDetail('Flood', riskScores.scores, riskScores.metadata),
    },
    {
      axis: 'Traffic',
      score: riskScores.scores.traffic ?? 0.5,
      fullMark: 1,
      color: scoreToColor(riskScores.scores.traffic ?? 0.5),
      detail: formatDetail('Traffic', riskScores.scores, riskScores.metadata),
    },
    {
      axis: 'Yield',
      score: riskScores.scores.yield ?? 0.5,
      fullMark: 1,
      color: scoreToColor(riskScores.scores.yield ?? 0.5),
      detail: formatDetail('Yield', riskScores.scores, riskScores.metadata),
    },
    {
      axis: 'Market',
      score: riskScores.scores.marketPremium ?? 0.5,
      fullMark: 1,
      color: scoreToColor(riskScores.scores.marketPremium ?? 0.5),
      detail: formatDetail('Market', riskScores.scores, riskScores.metadata),
    },
    {
      axis: 'Fault',
      score: riskScores.scores.fault ?? 0.5,
      fullMark: 1,
      color: scoreToColor(riskScores.scores.fault ?? 0.5),
      detail: formatDetail('Fault', riskScores.scores, riskScores.metadata),
    },
  ];

  return (
    <div className="w-full">
      <p className="text-xs font-medium mb-2">Risk Assessment</p>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fontSize: 11, fill: '#6b7280' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 1]}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickCount={4}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload?.[0]) {
                const d = payload[0].payload as ChartDataPoint;
                return (
                  <div className="rounded-md border bg-background p-2 text-xs shadow-md">
                    <p className="font-medium" style={{ color: d.color }}>
                      {d.axis}: {(d.score * 100).toFixed(0)}%
                    </p>
                    {d.detail.split('\n').map((line, i) => (
                      <p key={i} className="text-muted-foreground">
                        {line}
                      </p>
                    ))}
                  </div>
                );
              }
              return null;
            }}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-3 mt-2">
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
  );
}
