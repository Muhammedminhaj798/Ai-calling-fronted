'use client';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Async, Badge, Banner, Card, Field, Input, KeyValue, PageHeader, Status } from '@/components/ui';
import { qs } from '@/lib/api';
import { fmtDateTime, money } from '@/lib/format';
import type { Product, ProductStock } from '@/lib/types';
import { useApi, useDebounce } from '@/lib/use-api';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useApi<{ product: Product }>(`/api/products/${id}`);
  const [quantity, setQuantity] = useState('');
  const qty = useDebounce(quantity);
  const stock = useApi<ProductStock>(`/api/inventory/${id}` + qs({ quantity: /^\d+$/.test(qty) && Number(qty) > 0 ? qty : '' }), { refreshMs: 30_000 });

  return (
    <Async q={q}>
      {({ product: p }) => (
        <>
          <PageHeader title={p.name} description={<span className="font-mono">{p.externalCode}</span>} actions={<Status value={p.status} />} />
          <div className="grid gap-4 xl:grid-cols-3">
            <Card title="Catalogue details" className="xl:col-span-2">
              <KeyValue
                columns={3}
                items={[
                  ['Brand', p.brand ?? '—'],
                  ['Generic name', p.genericName ?? '—'],
                  ['Strength', p.strength ?? '—'],
                  ['Dosage form', p.form ?? '—'],
                  ['Pack size', p.packSize],
                  ['Selling unit', p.unit ?? '—'],
                  ['Manufacturer', p.manufacturer ?? '—'],
                  ['PTR (price to retailer)', money(p.ptrPaise)],
                  ['MRP', money(p.mrpPaise)],
                  ['GST rate', p.gstRate != null ? `${p.gstRate}%` : '—'],
                  ['Status', <Status key="s" value={p.status} />],
                  ['Updated', fmtDateTime(p.updatedAt)],
                ]}
              />
            </Card>
            <Card title="Inventory availability">
              <Async q={stock}>
                {(s) => (
                  <>
                    {s.isMock && <Banner>{s.warning ?? 'Simulated stock from the mock inventory adapter — not real inventory.'}</Banner>}
                    <KeyValue
                      columns={1}
                      items={[
                        [
                          'Source',
                          <span key="src">
                            {s.source} {s.isMock ? <Badge tone="amber">mock</Badge> : <Badge tone="green">client inventory</Badge>}
                          </span>,
                        ],
                        ['Available to sell', s.availableToSell == null ? 'Unknown to the inventory system' : `${s.availableToSell} ${p.unit ?? ''}`.trim()],
                        ['Status', <Status key="st" value={s.status} />],
                        ['As of', fmtDateTime(s.asOf)],
                        ...(s.requestedQuantity != null ? [['Sufficient for ' + s.requestedQuantity, s.sufficient == null ? 'Unknown' : s.sufficient ? 'Yes' : 'No'] as [string, string]] : []),
                      ]}
                    />
                  </>
                )}
              </Async>
              <Field label="Check a quantity" className="mt-4" hint="Read-only: the dashboard never changes stock.">
                <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 20" />
              </Field>
            </Card>
          </div>
        </>
      )}
    </Async>
  );
}
