'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTrainingRecords } from '@/hooks/useTrainingRecords';
import { useRetrain } from '@/hooks/useRetrain';
import { useModelVersions } from '@/hooks/useModelVersions';
import { usePromote } from '@/hooks/usePromote';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { ModelVersion } from '@/types/api';

function statusVariant(
  status: string,
): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'deployed':
      return 'default';
    case 'ready':
      return 'secondary';
    case 'training':
      return 'outline';
    case 'archived':
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

function formatMape(mape: number | null): string {
  if (mape == null) return '-';
  return `${(mape * 100).toFixed(1)}%`;
}

export default function AdminModelPage(): React.ReactNode {
  const { data: records, isLoading: recordsLoading } = useTrainingRecords();
  const { data: versions, isLoading: versionsLoading } = useModelVersions();
  const retrain = useRetrain();
  const promote = usePromote();
  const [retrainElapsed, setRetrainElapsed] = useState(0);
  const retrainTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRetraining = retrain.isPending;

  useEffect(() => {
    if (isRetraining) {
      setRetrainElapsed(0);
      retrainTimerRef.current = setInterval(() => {
        setRetrainElapsed((prev) => prev + 1);
      }, 1000);
    } else if (retrainTimerRef.current) {
      clearInterval(retrainTimerRef.current);
      retrainTimerRef.current = null;
    }
    return () => {
      if (retrainTimerRef.current) {
        clearInterval(retrainTimerRef.current);
      }
    };
  }, [isRetraining]);

  const retrainElapsedFormatted = useMemo(() => {
    const mins = Math.floor(retrainElapsed / 60);
    const secs = retrainElapsed % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [retrainElapsed]);

  const typeBreakdown: Record<string, number> = {};
  if (records) {
    for (const r of records) {
      const t = r.propertyType || 'unknown';
      typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
    }
  }

  const deployedVersion = useMemo(() => {
    if (!versions) return null;
    return versions.find((v) => v.status === 'deployed') ?? null;
  }, [versions]);

  const latestReadyVersion = useMemo(() => {
    if (!versions) return null;
    return versions.find((v) => v.status === 'ready') ?? null;
  }, [versions]);

  const handleRetrain = useCallback(async () => {
    try {
      await retrain.mutateAsync();
      toast.success('AVM retraining job queued in background successfully');
    } catch {
      toast.error('Retraining failed');
    }
  }, [retrain]);

  const handlePromote = useCallback(
    async (version: string) => {
      try {
        await promote.mutateAsync(version);
        toast.success(`Model v${version} promoted to deployed`);
      } catch {
        toast.error(`Failed to promote v${version}`);
      }
    },
    [promote],
  );

  const minimumRecordsMet = records ? records.length >= 20 : false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Training Pool</CardTitle>
          <div className="flex items-center gap-3">
            {isRetraining && (
              <Badge variant="outline" className="text-xs font-mono gap-1">
                <span className="inline-block size-1.5 rounded-full bg-yellow-500 animate-ping" />
                Training... {retrainElapsedFormatted}
              </Badge>
            )}
            <Button
              onClick={handleRetrain}
              disabled={isRetraining || !minimumRecordsMet}
            >
              {isRetraining
                ? `Training... ${retrainElapsedFormatted}`
                : 'Retrain Model'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recordsLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading pool data...
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-8">
                <div>
                  <p className="text-3xl font-bold">{records?.length ?? 0}</p>
                  <p className="text-xs text-muted-foreground">
                    Normalized training records
                  </p>
                </div>
                <Separator orientation="vertical" className="h-auto" />
                <div className="flex gap-4">
                  {Object.entries(typeBreakdown).map(([type, count]) => (
                    <div key={type}>
                      <p className="text-xl font-semibold">{count}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {type.replace(/_/g, ' ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {records && records.length < 20 && (
                <p className="text-xs text-amber-600">
                  Minimum 20 records required for training. Currently at{' '}
                  {records.length}.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active Model</CardTitle>
          </CardHeader>
          <CardContent>
            {versionsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : deployedVersion ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Version</span>
                  <Badge>{deployedVersion.version}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">MAPE</span>
                  <span className="font-mono text-sm">
                    {formatMape(deployedVersion.mape)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Training Records
                  </span>
                  <span className="font-mono text-sm">
                    {deployedVersion.trainingRecords ?? '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Deployed
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {deployedVersion.deployedAt
                      ? new Date(deployedVersion.deployedAt).toLocaleString()
                      : '-'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                <p>No deployed model.</p>
                {latestReadyVersion && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => handlePromote(latestReadyVersion.version)}
                    disabled={promote.isPending}
                  >
                    {promote.isPending
                      ? 'Promoting...'
                      : `Promote v${latestReadyVersion.version}`}
                  </Button>
                )}
                {!latestReadyVersion && (
                  <p className="mt-1 text-xs">
                    Train a model first to deploy it.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest Ready</CardTitle>
          </CardHeader>
          <CardContent>
            {versionsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : latestReadyVersion ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Version</span>
                  <Badge variant="secondary">
                    {latestReadyVersion.version}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">MAPE</span>
                  <span className="font-mono text-sm">
                    {formatMape(latestReadyVersion.mape)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Training Records
                  </span>
                  <span className="font-mono text-sm">
                    {latestReadyVersion.trainingRecords ?? '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Created</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(latestReadyVersion.createdAt).toLocaleString()}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handlePromote(latestReadyVersion.version)}
                  disabled={promote.isPending}
                >
                  {promote.isPending ? 'Promoting...' : 'Promote to Deployed'}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No trained models ready. Click &quot;Retrain Model&quot; to
                create one.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Version History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>MAPE</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Deployed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions?.map((v: ModelVersion) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-sm">
                    <div>{v.version}</div>
                    {v.status === 'failed' && v.errorLog && (
                      <p className="mt-1 max-w-md text-xs text-destructive whitespace-pre-wrap">
                        {v.errorLog}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(v.status)}>{v.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatMape(v.mape)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {v.trainingRecords ?? '-'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(v.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {v.deployedAt
                      ? new Date(v.deployedAt).toLocaleString()
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {v.status !== 'deployed' && v.status !== 'failed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePromote(v.version)}
                        disabled={promote.isPending}
                      >
                        Promote
                      </Button>
                    )}
                    {v.status === 'deployed' && (
                      <span className="text-xs text-muted-foreground">
                        Active
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!versions || versions.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    No model versions yet. Run a retrain to create the first
                    model.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
