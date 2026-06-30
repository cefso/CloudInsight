import { Breadcrumb, Space } from 'antd';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  breadcrumbs: { title: ReactNode }[];
  title: string;
  subtitle?: string;
  extra?: ReactNode;
}

export default function PageHeader({ breadcrumbs, title, subtitle, extra }: PageHeaderProps) {
  return (
    <div>
      <Breadcrumb items={breadcrumbs} style={{ marginBottom: 16 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{title}</h1>
          {subtitle && <p style={{ color: 'var(--ant-color-text-secondary)', margin: '4px 0 0 0' }}>{subtitle}</p>}
        </div>
        {extra && <Space>{extra}</Space>}
      </div>
    </div>
  );
}
