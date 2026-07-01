// 状态颜色 - 根据深色/浅色模式返回对应颜色
export const STATUS_COLORS = {
  abnormal: { bg: 'var(--color-abnormal-bg)', border: 'var(--color-abnormal-border)', text: 'var(--color-abnormal-text)' },
  warning: { bg: 'var(--color-warning-bg)', border: 'var(--color-warning-border)', text: 'var(--color-warning-text)' },
  normal: { bg: 'var(--color-normal-bg)', border: 'var(--color-normal-border)', text: 'var(--color-normal-text)' },
} as const;

// 资源类型颜色
export const RESOURCE_TYPE_COLORS: Record<string, string> = {
  ECS: '#3b82f6',
  RDS: '#8b5cf6',
  SLB_Listener: '#f59e0b',
  SLB_Backend: '#10b981',
};

// 资源类型标签
export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  ECS: 'ECS 资源',
  RDS: 'RDS 资源',
  SLB_Listener: 'SLB 监听器',
  SLB_Backend: 'SLB 后端服务器',
};

// CSS 变量注入（深色/浅色模式）
export const THEME_CSS_VARS = `
  :root {
    --color-abnormal-bg: #fef2f2;
    --color-abnormal-border: #ef4444;
    --color-abnormal-text: #dc2626;
    --color-warning-bg: #fffbeb;
    --color-warning-border: #f59e0b;
    --color-warning-text: #d97706;
    --color-normal-bg: #ffffff;
    --color-normal-border: transparent;
    --color-normal-text: #16a34a;
    --color-muted: #8c8c8c;
    --color-table-header-bg: #f9fafb;
    --color-table-border: #e5e7eb;
    --color-card-summary-bg: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
  [data-theme='dark'] {
    --color-abnormal-bg: #450a0a;
    --color-abnormal-border: #ef4444;
    --color-abnormal-text: #f87171;
    --color-warning-bg: #451a03;
    --color-warning-border: #f59e0b;
    --color-warning-text: #fbbf24;
    --color-normal-bg: #052e16;
    --color-normal-border: transparent;
    --color-normal-text: #4ade80;
    --color-muted: #71717a;
    --color-table-header-bg: #27272a;
    --color-table-border: #3f3f46;
    --color-card-summary-bg: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%);
  }
`;
