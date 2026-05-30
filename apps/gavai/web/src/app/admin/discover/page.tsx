'use client';

import { useState, type FormEvent } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { toast } from 'sonner';

interface DiscoverTarget {
  id: string;
  url: string;
  status: string;
  location: string;
  propertyType: string;
}

export default function AdminDiscoverPage(): React.ReactNode {
  const [location, setLocation] = useState('');
  const [propertyType, setPropertyType] = useState('any');
  const [discovering, setDiscovering] = useState(false);
  const [targets, setTargets] = useState<DiscoverTarget[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState(false);

  const handleDiscover = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setDiscovering(true);
    try {
      await api.post('/admin/discover', {
        location,
        propertyType: propertyType === 'any' ? undefined : propertyType,
      });
      toast.success('Discovery completed');
      await loadTargets();
    } catch {
      toast.error('Discovery failed');
    } finally {
      setDiscovering(false);
    }
  };

  const loadTargets = async (): Promise<void> => {
    try {
      const response = await api.get('/admin/discover/targets');
      setTargets(response.data.data as DiscoverTarget[]);
    } catch {
      toast.error('Failed to load targets');
    }
  };

  const handleApprove = async (): Promise<void> => {
    if (selected.size === 0) return;
    setApproving(true);
    try {
      await api.post('/admin/discover/approve', {
        ids: Array.from(selected),
      });
      toast.success(`Approved ${selected.size} targets`);
      setSelected(new Set());
      await loadTargets();
    } catch {
      toast.error('Approval failed');
    } finally {
      setApproving(false);
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
    if (selected.size === targets.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(targets.map((t) => t.id)));
    }
  };

  return (
    <div className="space-y-6">
      <Card data-ob="discover-form">
        <CardHeader>
          <CardTitle>Discover Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDiscover} className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g. Lahug, Cebu City"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>
            <div className="w-48 space-y-2">
              <Label>Property Type</Label>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="residential_lot">
                    Residential Lot
                  </SelectItem>
                  <SelectItem value="house_and_lot">House & Lot</SelectItem>
                  <SelectItem value="condo">Condo</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={discovering}>
              {discovering ? 'Discovering...' : 'Discover'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card data-ob="discover-urls-table">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Discovered URLs</CardTitle>
          <Button onClick={loadTargets} variant="outline" size="sm">
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {selected.size > 0 && (
              <Button onClick={handleApprove} disabled={approving} size="sm">
                {approving ? 'Approving...' : `Approve (${selected.size})`}
              </Button>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        targets.length > 0 && selected.size === targets.length
                      }
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(t.id)}
                        onCheckedChange={() => toggleSelect(t.id)}
                      />
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      <a
                        href={t.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate"
                      >
                        {t.url}
                      </a>
                    </TableCell>
                    <TableCell>{t.location}</TableCell>
                    <TableCell>{t.propertyType}</TableCell>
                    <TableCell>{t.status}</TableCell>
                  </TableRow>
                ))}
                {targets.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      No results. Run a discovery first.
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
