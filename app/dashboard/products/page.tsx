'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Async, Banner, Card, Empty, Field, Input, LinkButton, PageHeader, Pagination, Select, Status, Table, Td, Th, Toolbar, enumOptions } from '@/components/ui';
import { qs } from '@/lib/api';
import { money } from '@/lib/format';
import type { Page, Product, Settings } from '@/lib/types';
import { useApi, useDebounce } from '@/lib/use-api';

const PAGE_SIZE = 25;
const EMPTY = { q: '', brand: '', strength: '', form: '', manufacturer: '', status: '' };

export default function ProductsPage() {
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const set = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const debounced = useDebounce(filters);
  const settings = useApi<Settings>('/api/settings');
  const list = useApi<Page<Product>>('/api/products' + qs({ ...debounced, page, pageSize: PAGE_SIZE, sort: 'name' }));
  const inventory = settings.data?.providers.inventory.provider;

  return (
    <>
      <PageHeader title="Products" description="The wholesaler catalogue. The AI may only reference rows from this table." actions={inventory && <Status value={inventory === 'mock' ? 'mock' : inventory} />} />
      {inventory === 'mock' && <Banner>Stock figures come from the <strong>mock inventory adapter</strong> (local table), not from the client inventory system.</Banner>}
      <Toolbar>
        <Field label="Search" hint="Name, generic name or SKU">
          <Input value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search products" />
        </Field>
        <Field label="Brand" hint="Exact, case-insensitive">
          <Input value={filters.brand} onChange={(e) => set({ brand: e.target.value })} />
        </Field>
        <Field label="Strength">
          <Input value={filters.strength} onChange={(e) => set({ strength: e.target.value })} placeholder="650 mg" />
        </Field>
        <Field label="Dosage form">
          <Input value={filters.form} onChange={(e) => set({ form: e.target.value })} placeholder="tablet" />
        </Field>
        <Field label="Manufacturer">
          <Input value={filters.manufacturer} onChange={(e) => set({ manufacturer: e.target.value })} />
        </Field>
        <Field label="Status">
          <Select value={filters.status} onChange={(e) => set({ status: e.target.value })} options={enumOptions(['active', 'inactive', 'discontinued'])} placeholder="All" />
        </Field>
      </Toolbar>
      <Card padded={false}>
        <Async q={list} isEmpty={(d) => d.data.length === 0} empty={<Empty title="No products found" hint="The catalogue is imported from the client file (POST /api/products/import)." />}>
          {(data) => (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>SKU</Th>
                    <Th>Name</Th>
                    <Th>Brand</Th>
                    <Th>Generic</Th>
                    <Th>Strength</Th>
                    <Th>Form</Th>
                    <Th>Pack</Th>
                    <Th>Manufacturer</Th>
                    <Th right>PTR</Th>
                    <Th right>MRP</Th>
                    <Th>Status</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <Td mono>{p.externalCode}</Td>
                      <Td>
                        <Link href={`/dashboard/products/${p.id}`} className="font-medium text-blue-700 hover:underline">
                          {p.name}
                        </Link>
                      </Td>
                      <Td>{p.brand ?? '—'}</Td>
                      <Td>{p.genericName ?? '—'}</Td>
                      <Td>{p.strength ?? '—'}</Td>
                      <Td>{p.form ?? '—'}</Td>
                      <Td>
                        {p.packSize}
                        {p.unit && <span className="text-slate-400"> / {p.unit}</span>}
                      </Td>
                      <Td>{p.manufacturer ?? '—'}</Td>
                      <Td right>{money(p.ptrPaise)}</Td>
                      <Td right>{money(p.mrpPaise)}</Td>
                      <Td>
                        <Status value={p.status} />
                      </Td>
                      <Td right>
                        <LinkButton size="sm" href={`/dashboard/products/${p.id}`}>
                          View
                        </LinkButton>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
            </>
          )}
        </Async>
      </Card>
    </>
  );
}
