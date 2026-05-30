'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import type { NormalizedRecord } from '@/types/api';

export default function AdminNormalizePage(): React.ReactNode {
  const [records, setRecords] = useState<NormalizedRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const loadRecords = useCallback(async (): Promise<void> => {
    const response = await api.get<{ data: NormalizedRecord[] }>(
      '/admin/normalize/records',
    );
    setRecords(response.data.data ?? []);
  }, []);

  useEffect(() => {
    loadRecords().catch(() => toast.error('Failed to load normalized records'));
  }, [loadRecords]);

  const approve = async (): Promise<void> => {
    setApproving(true);
    try {
      await api.post('/admin/normalize/approve', { ids: Array.from(selected) });
      toast.success(`Approved ${selected.size} records`);
      setSelected(new Set());
      await loadRecords();
    } catch {
      toast.error('Approval failed');
    } finally {
      setApproving(false);
    }
  };

  const reject = async (ids: string[]): Promise<void> => {
    setRejecting(true);
    try {
      await api.post('/admin/normalize/reject', { ids });
      toast.success(`Rejected ${ids.length} records`);
      setSelected(new Set());
      await loadRecords();
    } catch {
      toast.error('Rejection failed');
    } finally {
      setRejecting(false);
    }
  };

  const approveAll = async (): Promise<void> => {
    if (selectableIds.length === 0) return;
    const confirmed = window.confirm(
      `Approve all ${selectableIds.length} selectable records?`,
    );
    if (!confirmed) return;
    setApprovingAll(true);
    try {
      await api.post('/admin/normalize/approve', { ids: selectableIds });
      toast.success(`Approved ${selectableIds.length} records`);
      setSelected(new Set());
      await loadRecords();
    } catch {
      toast.error('Approval failed');
    } finally {
      setApprovingAll(false);
    }
  };

  const rejectAllFailed = async (): Promise<void> => {
    const failedIds = records
      .filter((r) => r.normalizationStatus === 'failed')
      .map((r) => r.id);
    if (failedIds.length === 0) return;
    await reject(failedIds);
  };

  const readyCount = records.filter(
    (r) => r.normalizationStatus === 'normalized',
  ).length;
  const failedCount = records.filter(
    (r) => r.normalizationStatus === 'failed',
  ).length;
  const lowConfidenceCount = records.filter(
    (r) => r.normalizationStatus === 'low_confidence',
  ).length;

  const selectableIds = records
    .filter(
      (r) =>
        (r.normalizationStatus === 'normalized' ||
          r.normalizationStatus === 'low_confidence') &&
        r.trainingEligible,
    )
    .map((r) => r.id);

  return (
    <div className="space-y-6">
      <Card data-ob="normalize-table">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Normalize</CardTitle>
          <Button variant="outline" size="sm" onClick={loadRecords}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-3">
            <Badge variant="secondary">{readyCount} ready</Badge>
            <Badge variant="outline">{lowConfidenceCount} low confidence</Badge>
            <Badge variant="destructive">{failedCount} failed</Badge>
          </div>
          <div className="mb-4 flex gap-2">
            {selected.size > 0 && (
              <Button onClick={approve} disabled={approving} size="sm">
                {approving ? 'Approving...' : `Approve (${selected.size})`}
              </Button>
            )}
            {selected.size > 0 && (
              <Button
                onClick={() => reject(Array.from(selected))}
                disabled={rejecting}
                variant="outline"
                size="sm"
              >
                {rejecting ? 'Rejecting...' : `Reject (${selected.size})`}
              </Button>
            )}
            {selectableIds.length > 0 && (
              <Button
                onClick={approveAll}
                disabled={approvingAll}
                variant="default"
                size="sm"
              >
                {approvingAll
                  ? 'Approving...'
                  : `Approve All (${selectableIds.length})`}
              </Button>
            )}
            {failedCount > 0 && (
              <Button
                onClick={rejectAllFailed}
                disabled={rejecting}
                variant="destructive"
                size="sm"
              >
                Reject All Failed ({failedCount})
              </Button>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Title</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => {
                const selectable = selectableIds.includes(record.id);
                const statusVariant =
                  record.normalizationStatus === 'normalized'
                    ? 'secondary'
                    : record.normalizationStatus === 'failed'
                      ? 'destructive'
                      : 'outline';
                return (
                  <TableRow key={record.id}>
                    <TableCell>
                      <Checkbox
                        disabled={!selectable}
                        checked={selected.has(record.id)}
                        onCheckedChange={() => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(record.id)) next.delete(record.id);
                            else next.add(record.id);
                            return next;
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {record.title ?? '-'}
                    </TableCell>
                    <TableCell>
                      {[record.city, record.province]
                        .filter(Boolean)
                        .join(', ') || '-'}
                    </TableCell>
                    <TableCell>
                      {record.askingPricePhp
                        ? `PHP ${record.askingPricePhp.toLocaleString()}`
                        : '-'}
                    </TableCell>
                    <TableCell>{record.confidenceScore ?? '-'}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant}>
                        {record.normalizationStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {(record.normalizationIssues ?? []).join('; ') ||
                        record.flagReason ||
                        '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
