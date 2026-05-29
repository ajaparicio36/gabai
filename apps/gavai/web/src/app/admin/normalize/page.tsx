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
      toast.success(`Approved ${selected.size} normalized records`);
      setSelected(new Set());
      await loadRecords();
    } catch {
      toast.error('Approval failed');
    } finally {
      setApproving(false);
    }
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

  return (
    <div className="space-y-6">
      <Card>
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
          {selected.size > 0 && (
            <Button
              onClick={approve}
              disabled={approving}
              size="sm"
              className="mb-4"
            >
              {approving ? 'Approving...' : `Approve (${selected.size})`}
            </Button>
          )}
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
                const selectable =
                  record.normalizationStatus === 'normalized' &&
                  record.trainingEligible;
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
                      <Badge
                        variant={
                          record.normalizationStatus === 'normalized'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
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
