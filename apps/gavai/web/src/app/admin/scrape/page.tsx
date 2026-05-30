'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { NormalizedRecord } from '@/types/api';

interface QueueStatus {
  scraping: { active: number; waiting: number };
  enrichment: { active: number; waiting: number };
}

interface ScrapeRecord {
  id: string;
  status: string;
  title: string;
  askingPricePhp: number | null;
  propertyType: string;
  barangay: string | null;
  city: string | null;
  flagged: boolean;
  flagReason: string | null;
}

function isBusy(status: QueueStatus): boolean {
  const s = status.scraping.active + status.scraping.waiting;
  const e = status.enrichment.active + status.enrichment.waiting;
  return s > 0 || e > 0;
}

function statusLabel(status: QueueStatus): string {
  const parts: string[] = [];
  const scrape = status.scraping.active + status.scraping.waiting;
  const enrich = status.enrichment.active + status.enrichment.waiting;
  if (scrape > 0) parts.push(`Scraping: ${scrape} job${scrape > 1 ? 's' : ''}`);
  if (enrich > 0)
    parts.push(`Enriching: ${enrich} job${enrich > 1 ? 's' : ''}`);
  return parts.join(' • ') || 'Idle';
}

export default function AdminScrapePage(): React.ReactNode {
  const [records, setRecords] = useState<ScrapeRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [normalizedRecords, setNormalizedRecords] = useState<
    NormalizedRecord[]
  >([]);
  const [selectedNormalized, setSelectedNormalized] = useState<Set<string>>(
    new Set(),
  );
  const [approvingNormalized, setApprovingNormalized] = useState(false);
  const [rejectingNormalized, setRejectingNormalized] = useState(false);

  const loadRecords = useCallback(async (): Promise<void> => {
    try {
      const response = await api.get('/admin/scrape/records');
      setRecords(response.data.data as ScrapeRecord[]);
    } catch {
      toast.error('Failed to load records');
    }
  }, []);

  const loadQueueStatus = useCallback(async (): Promise<void> => {
    try {
      const response = await api.get('/admin/scrape/queue-status');
      setQueueStatus(response.data.data as QueueStatus);
    } catch {
      // silently ignore polling errors
    }
  }, []);

  const loadNormalizedRecords = useCallback(async (): Promise<void> => {
    try {
      const response = await api.get<{ data: NormalizedRecord[] }>(
        '/admin/normalize/records',
      );
      setNormalizedRecords(response.data.data ?? []);
    } catch {
      toast.error('Failed to load normalized records');
    }
  }, []);

  useEffect(() => {
    loadRecords();
    loadNormalizedRecords();
    loadQueueStatus();
    pollingRef.current = setInterval(() => {
      loadQueueStatus();
    }, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [loadRecords, loadNormalizedRecords, loadQueueStatus]);

  const handleRunScrape = async (): Promise<void> => {
    setRunning(true);
    try {
      await api.post('/admin/scrape/run');
      toast.success('Scraping job queued');
      await loadQueueStatus();
    } catch {
      toast.error('Failed to queue scrape job');
    } finally {
      setRunning(false);
    }
  };

  const handleApprove = async (): Promise<void> => {
    if (selected.size === 0) return;
    setApproving(true);
    try {
      await api.post('/admin/scrape/approve', {
        ids: Array.from(selected),
      });
      toast.success(`Approved ${selected.size} records`);
      setSelected(new Set());
      await loadRecords();
    } catch {
      toast.error('Approval failed');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (): Promise<void> => {
    if (selected.size === 0) return;
    try {
      await api.post('/admin/scrape/reject', {
        ids: Array.from(selected),
      });
      toast.success(`Rejected ${selected.size} records`);
      setSelected(new Set());
      await loadRecords();
    } catch {
      toast.error('Rejection failed');
    }
  };

  const toggleSelect = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (): void => {
    if (selected.size === records.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(records.map((r) => r.id)));
    }
  };

  const handleApproveNormalized = async (): Promise<void> => {
    if (selectedNormalized.size === 0) return;
    setApprovingNormalized(true);
    try {
      await api.post('/admin/normalize/approve', {
        ids: Array.from(selectedNormalized),
      });
      toast.success(`Approved ${selectedNormalized.size} records`);
      setSelectedNormalized(new Set());
      await loadNormalizedRecords();
    } catch {
      toast.error('Normalized approval failed');
    } finally {
      setApprovingNormalized(false);
    }
  };

  const handleRejectNormalized = async (): Promise<void> => {
    if (selectedNormalized.size === 0) return;
    setRejectingNormalized(true);
    try {
      await api.post('/admin/normalize/reject', {
        ids: Array.from(selectedNormalized),
      });
      toast.success(`Rejected ${selectedNormalized.size} records`);
      setSelectedNormalized(new Set());
      await loadNormalizedRecords();
    } catch {
      toast.error('Normalized rejection failed');
    } finally {
      setRejectingNormalized(false);
    }
  };

  const toggleSelectNormalized = (id: string): void => {
    setSelectedNormalized((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllNormalized = (): void => {
    if (selectedNormalized.size === normalizedRecords.length) {
      setSelectedNormalized(new Set());
    } else {
      setSelectedNormalized(new Set(normalizedRecords.map((r) => r.id)));
    }
  };

  return (
    <div className="space-y-6">
      <Card data-ob="scrape-records-table">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>Scraped Records</CardTitle>
            {queueStatus && (
              <Badge
                variant={isBusy(queueStatus) ? 'default' : 'secondary'}
                className="text-xs gap-1"
              >
                {isBusy(queueStatus) && (
                  <span className="inline-block size-1.5 rounded-full bg-current animate-ping" />
                )}
                {statusLabel(queueStatus)}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleRunScrape}
              disabled={running}
              data-ob="scrape-run"
            >
              {running ? 'Running...' : 'Run Scrape'}
            </Button>
            <Button variant="outline" onClick={loadRecords} size="sm">
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {selected.size > 0 && (
              <div className="flex gap-2">
                <Button onClick={handleApprove} disabled={approving} size="sm">
                  Approve ({selected.size})
                </Button>
                <Button onClick={handleReject} variant="destructive" size="sm">
                  Reject
                </Button>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        records.length > 0 && selected.size === records.length
                      }
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={() => toggleSelect(r.id)}
                      />
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {r.title}
                    </TableCell>
                    <TableCell>
                      {r.askingPricePhp
                        ? `PHP ${r.askingPricePhp.toLocaleString()}`
                        : '-'}
                    </TableCell>
                    <TableCell>{r.propertyType}</TableCell>
                    <TableCell>
                      {[r.barangay, r.city].filter(Boolean).join(', ') || '-'}
                    </TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell>
                      {r.flagged && (
                        <Badge variant="destructive" className="text-xs">
                          Flagged
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {records.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground"
                    >
                      No records. Run a scrape job first.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card data-ob="normalize-table">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Normalized Records</CardTitle>
          <Button variant="outline" size="sm" onClick={loadNormalizedRecords}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {selectedNormalized.size > 0 && (
              <div className="flex gap-2">
                <Button
                  onClick={handleApproveNormalized}
                  disabled={approvingNormalized}
                  size="sm"
                >
                  {approvingNormalized
                    ? 'Approving...'
                    : `Approve (${selectedNormalized.size})`}
                </Button>
                <Button
                  onClick={handleRejectNormalized}
                  disabled={rejectingNormalized}
                  variant="destructive"
                  size="sm"
                >
                  {rejectingNormalized
                    ? 'Rejecting...'
                    : `Reject (${selectedNormalized.size})`}
                </Button>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        normalizedRecords.length > 0 &&
                        selectedNormalized.size === normalizedRecords.length
                      }
                      onCheckedChange={toggleAllNormalized}
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {normalizedRecords.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedNormalized.has(r.id)}
                        onCheckedChange={() => toggleSelectNormalized(r.id)}
                      />
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {r.title ?? '-'}
                    </TableCell>
                    <TableCell>
                      {[r.city, r.province].filter(Boolean).join(', ') || '-'}
                    </TableCell>
                    <TableCell>
                      {r.askingPricePhp
                        ? `PHP ${r.askingPricePhp.toLocaleString()}`
                        : '-'}
                    </TableCell>
                    <TableCell>{r.propertyType ?? '-'}</TableCell>
                    <TableCell>
                      {r.confidenceScore != null
                        ? r.confidenceScore.toFixed(2)
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.normalizationStatus === 'normalized'
                            ? 'secondary'
                            : r.normalizationStatus === 'failed'
                              ? 'destructive'
                              : 'outline'
                        }
                      >
                        {r.normalizationStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {(r.normalizationIssues ?? []).join('; ') ||
                        r.flagReason ||
                        '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {normalizedRecords.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground"
                    >
                      No normalized records
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
