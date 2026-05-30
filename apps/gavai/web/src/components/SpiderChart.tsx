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

function formatDetail(
  axis: string,
  _scores: RiskAssessmentResponse['scores'],
  metadata: RiskAssessmentResponse['metadata'],
): string {
  switch (axis) {
    case 'Flood':
      return metadata.flood
        ? `${metadata.flood.returnPeriod || '5yr'} Flood: ${floodDescription(metadata.flood.level)}\nSource: ${metadata.flood.source}`
        : 'No data';
    case 'Traffic':
      return metadata.traffic
        ? `Traffic Delay: ${(metadata.traffic.delayPercent * 100).toFixed(0)}%\nCached: ${new Date(metadata.traffic.cachedAt).toLocaleDateString()}`
        : 'No data';
    case 'Growth':
      return metadata.yield
        ? `Growth Outlook: Based on ${metadata.yield.articleCount} area news articles\n${(metadata.yield.positiveRatio * 100).toFixed(0)}% positive sentiment\nHigher = more development activity nearby. This is NOT rental yield.`
        : 'No data';
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
      score: 1 - (riskScores.scores.traffic ?? 0.5),
      fullMark: 1,
      color: scoreToColor(1 - (riskScores.scores.traffic ?? 0.5)),
      detail: formatDetail('Traffic', riskScores.scores, riskScores.metadata),
    },
    {
      axis: 'Growth',
      score: riskScores.scores.yield ?? 0.5,
      fullMark: 1,
      color: scoreToColor(riskScores.scores.yield ?? 0.5),
      detail: formatDetail('Growth', riskScores.scores, riskScores.metadata),
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
