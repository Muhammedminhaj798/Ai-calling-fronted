'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Async, Card, Empty, Field, Input, LinkButton, PageHeader, Pagination, Select, Status, Table, Td, Th, Toolbar, enumOptions } from '@/components/ui';
import { qs } from '@/lib/api';
import { fmtDate, languageName } from '@/lib/format';
import { LANGUAGES, type Customer, type Page } from '@/lib/types';
import { useApi, useDebounce } from '@/lib/use-api';

const PAGE_SIZE = 25;

export default function CustomersPage() {
  const [filters, setFilters] = useState({ q: '', status: '', preferredLanguage: '' });
  const [page, setPage] = useState(1);
  const set = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const q = useDebounce(filters.q.trim());
  const list = useApi<Page<Customer>>('/api/customers' + qs({ ...filters, q, page, pageSize: PAGE_SIZE, sort: 'name' }));

  return (
    <>
      <PageHeader title="Customers" description="The client customer master: retail pharmacies allowed to order by phone. Read-only here; create and edit APIs exist but are not exposed in this step." />
      <Toolbar>
        <Field label="Search" hint="Name, code or phone number">
          <Input value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search customers" />
        </Field>
        <Field label="Status">
          <Select value={filters.status} onChange={(e) => set({ status: e.target.value })} options={enumOptions(['active', 'inactive', 'blocked'])} placeholder="All" />
        </Field>
        <Field label="Language">
          <Select value={filters.preferredLanguage} onChange={(e) => set({ preferredLanguage: e.target.value })} options={LANGUAGES.map((l) => ({ value: l, label: languageName(l) }))} placeholder="All" />
        </Field>
      </Toolbar>
      <Card padded={false}>
        <Async q={list} isEmpty={(d) => d.data.length === 0} empty={<Empty title="No customers found" hint="Customers are imported from the client master file (POST /api/customers/import)." />}>
          {(data) => (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Code</Th>
                    <Th>Name</Th>
                    <Th>Phone</Th>
                    <Th>Language</Th>
                    <Th>Status</Th>
                    <Th right>Addresses</Th>
                    <Th>Since</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <Td mono>{c.externalCode}</Td>
                      <Td>
                        <Link href={`/dashboard/customers/${c.id}`} className="font-medium text-blue-700 hover:underline">
                          {c.name}
                        </Link>
                      </Td>
                      <Td mono>
                        {c.phonePrimary}
                        {c.phoneAlternates.length > 0 && <span className="block text-slate-400">+{c.phoneAlternates.length} more</span>}
                      </Td>
                      <Td>{languageName(c.preferredLanguage)}</Td>
                      <Td>
                        <Status value={c.status} />
                      </Td>
                      <Td right>{c.addresses.length}</Td>
                      <Td>{fmtDate(c.createdAt)}</Td>
                      <Td right>
                        <LinkButton size="sm" href={`/dashboard/customers/${c.id}`}>
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
