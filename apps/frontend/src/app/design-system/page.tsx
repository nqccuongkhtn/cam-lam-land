'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Button, buttonClass, Card, Badge, Chip, Skeleton, EmptyState } from '@/components/ui';

// Trang tham chieu he thiet ke (noi bo): mo /design-system de xem & kiem chung primitive.
export default function DesignSystemPage() {
  const [active, setActive] = useState('nha-pho');
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-2xl font-extrabold text-navy">Hệ thiết kế · Cam Lâm Land</h1>
        <p className="mt-1 text-sm text-slate-500">Bộ primitive dùng chung — một ngôn ngữ thiết kế cho toàn app. Trang này để đối chiếu khi migrate các màn.</p>
      </header>

      <Section title="Màu thương hiệu">
        <div className="flex flex-wrap gap-3">
          <Swatch name="navy" hex="#0B4045" className="bg-navy" />
          <Swatch name="gold" hex="#C8A14B" className="bg-gold" />
        </div>
      </Section>

      <Section title="Button — biến thể">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Tìm kiếm</Button>
          <Button variant="navy">Xem chi tiết</Button>
          <Button variant="gold">Nổi bật</Button>
          <Button variant="success">Liên hệ</Button>
          <Button variant="outline">Bộ lọc</Button>
          <Button variant="ghost">Bỏ qua</Button>
          <Button variant="danger">Xoá</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="navy">sm</Button>
          <Button size="md" variant="navy">md</Button>
          <Button size="lg" variant="navy">lg</Button>
          <Button shape="pill" variant="primary">pill</Button>
          <Button variant="navy" disabled>disabled</Button>
        </div>
        <div className="mt-3">
          <Button block variant="primary">Nút full-width (block)</Button>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Trên Link/thẻ a: <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-600">{"className={buttonClass({ variant: 'navy' })}"}</code>
        </p>
        <div className="mt-2">
          <Link href="#" className={buttonClass({ variant: 'outline', shape: 'pill' })}>Link trông như nút</Link>
        </div>
      </Section>

      <Section title="Card">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <b className="text-navy">Card mặc định</b>
            <p className="mt-1 text-sm text-slate-500">pad lg · bo góc 2xl · viền slate mỏng.</p>
          </Card>
          <Card pad="sm">
            <b className="text-navy">Card pad nhỏ</b>
            <p className="mt-1 text-sm text-slate-500">Dùng cho thẻ gọn trong danh sách.</p>
          </Card>
        </div>
      </Section>

      <Section title="Badge">
        <div className="flex flex-wrap gap-2">
          <Badge tone="red">CẦN BÁN</Badge>
          <Badge tone="emerald">CHO THUÊ</Badge>
          <Badge tone="navy">VIP</Badge>
          <Badge tone="gold">KIM CƯƠNG</Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="red" soft>Mới</Badge>
          <Badge tone="emerald" soft>Xác thực</Badge>
          <Badge tone="navy" soft>Nội bộ</Badge>
          <Badge tone="amber" soft>Chờ duyệt</Badge>
        </div>
      </Section>

      <Section title="Chip (bộ lọc)">
        <div className="flex flex-wrap gap-2">
          {([['nha-pho', 'Nhà phố'], ['dat-nen', 'Đất nền'], ['can-ho', 'Căn hộ'], ['biet-thu', 'Biệt thự']] as const).map(([k, l]) => (
            <Chip key={k} active={active === k} onClick={() => setActive(k)}>{l}</Chip>
          ))}
        </div>
      </Section>

      <Section title="Skeleton (đang tải)">
        <div className="space-y-2">
          <Skeleton h={16} w="60%" />
          <Skeleton h={16} w="90%" />
          <Skeleton h={80} rounded="rounded-xl" />
        </div>
      </Section>

      <Section title="Empty state">
        <Card pad="none">
          <EmptyState
            icon={<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>}
            title="Không có kết quả phù hợp"
            description="Thử nới rộng bộ lọc hoặc đổi khu vực tìm kiếm."
            action={<Button variant="navy" size="sm">Xoá bộ lọc</Button>}
          />
        </Card>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ name, hex, className }: { name: string; hex: string; className: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className={`h-14 w-28 ${className}`} />
      <div className="px-2 py-1 text-xs">
        <b className="text-navy">{name}</b> <span className="text-slate-400">{hex}</span>
      </div>
    </div>
  );
}
