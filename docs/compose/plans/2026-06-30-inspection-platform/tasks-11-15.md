# 前端任务 (Task 11-15)

---

## Task 11: 前端项目初始化

**Covers:** S2

**Files:**
- Create: `frontend/` (via Vite)

### Steps

- [ ] **Step 1: 初始化前端项目**

```bash
cd /Users/cefso/code/aliyun
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install antd @ant-design/icons axios react-router-dom dayjs
```

- [ ] **Step 2: 更新 vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../backend/static',
    emptyOutDir: true,
  },
})
```

- [ ] **Step 3: 创建 src/api/index.ts**

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.response.use(
  (response) => {
    const { data } = response;
    if (data.code !== 200) {
      return Promise.reject(new Error(data.message || '请求失败'));
    }
    return data;
  },
  (error) => Promise.reject(error)
);

export default api;
```

- [ ] **Step 4: 创建 src/styles/theme.ts**

```typescript
import { theme } from 'antd';

export const darkTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#3b82f6',
    colorBgContainer: '#18181b',
    colorBgElevated: '#27272a',
    colorBorder: '#3f3f46',
    colorText: '#fafafa',
    colorTextSecondary: '#a1a1aa',
    borderRadius: 8,
  },
};

export const lightTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#2563eb',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#f8fafc',
    colorBorder: '#e2e8f0',
    colorText: '#0f172a',
    colorTextSecondary: '#64748b',
    borderRadius: 8,
  },
};
```

- [ ] **Step 5: 创建 src/hooks/useTheme.ts**

```typescript
import { useState, useEffect } from 'react';

type ThemeMode = 'light' | 'dark';

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme-mode');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme-mode', mode);
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const toggleTheme = () => setMode(prev => prev === 'light' ? 'dark' : 'light');

  return { mode, toggleTheme };
}
```

- [ ] **Step 6: 创建 src/App.tsx**

```tsx
import { ConfigProvider } from 'antd';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useTheme } from './hooks/useTheme';
import { darkTheme, lightTheme } from './styles/theme';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Inspections from './pages/Inspections';
import Thresholds from './pages/Thresholds';
import Cron from './pages/Cron';

function App() {
  const { mode } = useTheme();
  return (
    <ConfigProvider theme={mode === 'dark' ? darkTheme : lightTheme}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="inspections" element={<Inspections />} />
            <Route path="thresholds" element={<Thresholds />} />
            <Route path="cron" element={<Cron />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
```

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: 初始化前端项目"
```

---

## Task 12: 前端布局组件

**Covers:** S5

**Files:**
- Create: `frontend/src/components/ThemeToggle/index.tsx`
- Create: `frontend/src/components/Layout/Header.tsx`
- Create: `frontend/src/components/Layout/Sidebar.tsx`
- Create: `frontend/src/components/Layout/index.tsx`

### Steps

- [ ] **Step 1: 创建 ThemeToggle 组件**

```tsx
// frontend/src/components/ThemeToggle/index.tsx
import { Button } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useTheme } from '../../hooks/useTheme';

export default function ThemeToggle() {
  const { mode, toggleTheme } = useTheme();
  return <Button type="text" icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />} onClick={toggleTheme} style={{ fontSize: 18 }} />;
}
```

- [ ] **Step 2: 创建 Header 组件**

```tsx
// frontend/src/components/Layout/Header.tsx
import { Layout, Space, Avatar, Input } from 'antd';
import { UserOutlined, SearchOutlined } from '@ant-design/icons';
import ThemeToggle from '../ThemeToggle';

const { Header: AntHeader } = Layout;

export default function Header() {
  return (
    <AntHeader style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: 'var(--ant-color-bg-container)', borderBottom: '1px solid var(--ant-color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>C</div>
        <span style={{ fontSize: 18, fontWeight: 700 }}>CloudInsight</span>
      </div>
      <Space size="middle">
        <Input placeholder="搜索资源..." prefix={<SearchOutlined />} style={{ width: 220 }} />
        <ThemeToggle />
        <Avatar icon={<UserOutlined />} />
      </Space>
    </AntHeader>
  );
}
```

- [ ] **Step 3: 创建 Sidebar 组件**

```tsx
// frontend/src/components/Layout/Sidebar.tsx
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardOutlined, CloudServerOutlined, AlertOutlined, SettingOutlined, ClockCircleOutlined } from '@ant-design/icons';

const { Sider } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '巡检总览' },
  { key: '/accounts', icon: <CloudServerOutlined />, label: '云账号管理' },
  { key: '/inspections', icon: <AlertOutlined />, label: '巡检结果' },
  { key: '/thresholds', icon: <SettingOutlined />, label: '告警阈值' },
  { key: '/cron', icon: <ClockCircleOutlined />, label: '定时任务' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <Sider width={220} style={{ background: 'var(--ant-color-bg-container)', borderRight: '1px solid var(--ant-color-border)' }}>
      <Menu mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => navigate(key)} style={{ height: '100%', borderRight: 0 }} />
    </Sider>
  );
}
```

- [ ] **Step 4: 创建 Layout 组件**

```tsx
// frontend/src/components/Layout/index.tsx
import { Layout as AntLayout } from 'antd';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';

const { Content } = AntLayout;

export default function Layout() {
  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header />
      <AntLayout>
        <Sidebar />
        <Content style={{ padding: 24, background: 'var(--ant-color-bg-layout)', overflow: 'auto' }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: 实现布局组件"
```

---

## Task 13: Dashboard 页面

**Covers:** S5

**Files:**
- Create: `frontend/src/api/dashboard.ts`
- Create: `frontend/src/pages/Dashboard/index.tsx`

### Steps

- [ ] **Step 1: 创建 dashboard API**

```typescript
// frontend/src/api/dashboard.ts
import api from './index';

export interface DashboardStats {
  total_resources: number;
  normal_count: number;
  abnormal_count: number;
  account_count: number;
  last_inspection_time: string | null;
  next_inspection_time: string | null;
}

export interface AbnormalResource {
  id: number;
  resource_type: string;
  resource_id: string;
  resource_name: string;
  region: string;
  cpu_usage: number | null;
  memory_usage: number | null;
  disk_usage: number | null;
  abnormal_metrics: string[] | null;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await api.get('/dashboard/stats');
  return res.data;
}

export async function getAbnormalResources(limit = 10): Promise<AbnormalResource[]> {
  const res = await api.get('/dashboard/abnormal-resources', { params: { limit } });
  return res.data;
}

export async function triggerInspection(): Promise<{ task_id: number }> {
  const res = await api.post('/inspections/trigger', {});
  return res.data;
}
```

- [ ] **Step 2: 创建 Dashboard 页面**

```tsx
// frontend/src/pages/Dashboard/index.tsx
import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Button, Table, Tag, message, Space, Breadcrumb } from 'antd';
import { CloudServerOutlined, CheckCircleOutlined, WarningOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getDashboardStats, getAbnormalResources, triggerInspection, DashboardStats, AbnormalResource } from '../../api/dashboard';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [abnormalResources, setAbnormalResources] = useState<AbnormalResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, resourcesData] = await Promise.all([getDashboardStats(), getAbnormalResources(10)]);
      setStats(statsData);
      setAbnormalResources(resourcesData);
    } catch { message.error('获取数据失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await triggerInspection();
      message.success('巡检任务已启动');
      setTimeout(fetchData, 3000);
    } catch { message.error('触发巡检失败'); }
    finally { setTriggering(false); }
  };

  const columns = [
    { title: '资源类型', dataIndex: 'resource_type', key: 'type', render: (t: string) => <Tag color="red">{t}</Tag> },
    { title: '资源名称', dataIndex: 'resource_name', key: 'name' },
    { title: '实例ID', dataIndex: 'resource_id', key: 'id', render: (id: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{id}</span> },
    { title: '地域', dataIndex: 'region', key: 'region', render: (r: string) => <Tag>{r}</Tag> },
    { title: 'CPU', dataIndex: 'cpu_usage', key: 'cpu', render: (v: number | null) => v !== null ? <span style={{ color: v > 90 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{v.toFixed(1)}%</span> : '-' },
    { title: '内存', dataIndex: 'memory_usage', key: 'mem', render: (v: number | null) => v !== null ? <span style={{ color: v > 90 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{v.toFixed(1)}%</span> : '-' },
    { title: '磁盘', dataIndex: 'disk_usage', key: 'disk', render: (v: number | null) => v !== null ? <span style={{ color: v > 90 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{v.toFixed(1)}%</span> : '-' },
    { title: '操作', key: 'action', render: () => <a>查看详情</a> },
  ];

  return (
    <div>
      <Breadcrumb items={[{ title: '首页' }, { title: '巡检总览' }]} style={{ marginBottom: 16 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>巡检总览</h1>
          {stats?.last_inspection_time && <p style={{ color: 'var(--ant-color-text-secondary)', margin: '4px 0 0 0' }}>最近更新: {dayjs(stats.last_inspection_time).format('YYYY-MM-DD HH:mm:ss')}</p>}
        </div>
        <Space>
          <Button type="primary" icon={<ReloadOutlined />} loading={triggering} onClick={handleTrigger}>立即巡检</Button>
        </Space>
      </div>
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        <Col span={6}><Card loading={loading}><Statistic title="监控资源" value={stats?.total_resources || 0} prefix={<CloudServerOutlined />} /></Card></Col>
        <Col span={6}><Card loading={loading}><Statistic title="运行正常" value={stats?.normal_count || 0} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#16a34a' }} /></Card></Col>
        <Col span={6}><Card loading={loading}><Statistic title="存在异常" value={stats?.abnormal_count || 0} prefix={<WarningOutlined />} valueStyle={{ color: '#dc2626' }} /></Card></Col>
        <Col span={6}><Card loading={loading}><Statistic title="巡检账号" value={stats?.account_count || 0} /></Card></Col>
      </Row>
      <Card title="异常资源列表" loading={loading}>
        <Table columns={columns} dataSource={abnormalResources} rowKey="id" pagination={false} />
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard/ frontend/src/api/dashboard.ts
git commit -m "feat: 实现 Dashboard 页面"
```

---

## Task 14: 账号管理页面

**Covers:** S5

**Files:**
- Create: `frontend/src/api/accounts.ts`
- Create: `frontend/src/pages/Accounts/Form.tsx`
- Create: `frontend/src/pages/Accounts/index.tsx`

### Steps

- [ ] **Step 1: 创建 accounts API**

```typescript
// frontend/src/api/accounts.ts
import api from './index';

export interface CloudAccount {
  id: number; name: string; access_key_id: string;
  regions: string[] | null; resource_types: string[] | null;
  is_enabled: boolean; created_at: string; updated_at: string;
}

export async function getAccounts(): Promise<CloudAccount[]> {
  const res = await api.get('/accounts');
  return res.data;
}

export async function createAccount(params: any): Promise<{ id: number }> {
  const res = await api.post('/accounts', params);
  return res.data;
}

export async function updateAccount(id: number, params: any): Promise<void> {
  await api.put(`/accounts/${id}`, params);
}

export async function deleteAccount(id: number): Promise<void> {
  await api.delete(`/accounts/${id}`);
}

export async function testConnection(id: number): Promise<{ success: boolean; message: string }> {
  const res = await api.post(`/accounts/${id}/test`);
  return res.data;
}
```

- [ ] **Step 2: 创建账号表单组件**

```tsx
// frontend/src/pages/Accounts/Form.tsx
import { useState } from 'react';
import { Modal, Form, Input, Select, message } from 'antd';
import { createAccount, updateAccount } from '../../api/accounts';

const REGION_OPTIONS = [
  { label: '华东1（杭州）', value: 'cn-hangzhou' },
  { label: '华东2（上海）', value: 'cn-shanghai' },
  { label: '华北2（北京）', value: 'cn-beijing' },
  { label: '华南1（深圳）', value: 'cn-shenzhen' },
  { label: '中国香港', value: 'cn-hongkong' },
];

const RESOURCE_TYPE_OPTIONS = [
  { label: 'ECS（云服务器）', value: 'acs_ecs_dashboard' },
  { label: 'RDS（数据库）', value: 'acs_rds_dashboard' },
  { label: 'SLB（负载均衡）', value: 'acs_slb_dashboard' },
  { label: 'OSS（对象存储）', value: 'acs_oss_dashboard' },
  { label: 'Redis（缓存）', value: 'acs_kvstore_dashboard' },
  { label: 'NAT（网关）', value: 'acs_nat_gateway' },
];

export default function AccountForm({ visible, onClose, onSuccess, initialValues }: any) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const isEdit = !!initialValues?.id;

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      if (isEdit) {
        await updateAccount(initialValues.id, values);
        message.success('更新成功');
      } else {
        await createAccount(values);
        message.success('创建成功');
      }
      form.resetFields();
      onSuccess();
      onClose();
    } catch (e: any) {
      if (e.message) message.error(e.message);
    } finally { setLoading(false); }
  };

  return (
    <Modal title={isEdit ? '编辑账号' : '添加账号'} open={visible} onOk={handleSubmit} onCancel={onClose} confirmLoading={loading} width={600}>
      <Form form={form} layout="vertical" initialValues={initialValues}>
        <Form.Item name="name" label="账号名称" rules={[{ required: true }]}><Input placeholder="如：生产环境" /></Form.Item>
        <Form.Item name="access_key_id" label="Access Key ID" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="access_key_secret" label="Access Key Secret" rules={[{ required: !isEdit }]}><Input.Password placeholder={isEdit ? '留空则不修改' : ''} /></Form.Item>
        <Form.Item name="regions" label="监控地域"><Select mode="multiple" options={REGION_OPTIONS} /></Form.Item>
        <Form.Item name="resource_types" label="资源类型"><Select mode="multiple" options={RESOURCE_TYPE_OPTIONS} /></Form.Item>
      </Form>
    </Modal>
  );
}
```

- [ ] **Step 3: 创建账号列表页面**

```tsx
// frontend/src/pages/Accounts/index.tsx
import { useEffect, useState } from 'react';
import { Card, Table, Button, Tag, Space, message, Popconfirm, Breadcrumb } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ApiOutlined } from '@ant-design/icons';
import { getAccounts, deleteAccount, testConnection, CloudAccount } from '../../api/accounts';
import AccountForm from './Form';

export default function Accounts() {
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    try { setAccounts(await getAccounts()); }
    catch { message.error('获取失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const handleDelete = async (id: number) => {
    try { await deleteAccount(id); message.success('删除成功'); fetchAccounts(); }
    catch { message.error('删除失败'); }
  };

  const handleTest = async (id: number) => {
    try {
      const r = await testConnection(id);
      r.success ? message.success('连接成功') : message.error(r.message);
    } catch { message.error('测试失败'); }
  };

  const columns = [
    { title: '账号名称', dataIndex: 'name', key: 'name', render: (n: string) => <strong>{n}</strong> },
    { title: 'AK', dataIndex: 'access_key_id', key: 'ak', render: (ak: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{ak}</span> },
    { title: '地域', dataIndex: 'regions', key: 'regions', render: (rs: string[] | null) => rs ? <Space size={4} wrap>{rs.slice(0, 3).map(r => <Tag key={r}>{r}</Tag>)}{rs.length > 3 && <Tag>+{rs.length - 3}</Tag>}</Space> : <Tag>默认</Tag> },
    { title: '资源类型', dataIndex: 'resource_types', key: 'types', render: (ts: string[] | null) => ts ? <Space size={4} wrap>{ts.slice(0, 3).map(t => <Tag color="blue" key={t}>{t.split('_')[1]?.toUpperCase()}</Tag>)}{ts.length > 3 && <Tag>+{ts.length - 3}</Tag>}</Space> : <Tag>全部</Tag> },
    { title: '状态', dataIndex: 'is_enabled', key: 'enabled', render: (e: boolean) => <Tag color={e ? 'success' : 'default'}>{e ? '已启用' : '已禁用'}</Tag> },
    {
      title: '操作', key: 'action', render: (_: any, r: CloudAccount) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => { setEditingAccount(r); setFormVisible(true); }}>编辑</Button>
          <Button type="link" icon={<ApiOutlined />} onClick={() => handleTest(r.id)}>测试</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}><Button type="link" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm>
        </Space>
      )
    },
  ];

  return (
    <div>
      <Breadcrumb items={[{ title: '配置中心' }, { title: '云账号管理' }]} style={{ marginBottom: 16 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>云账号管理</h1>
          <p style={{ color: 'var(--ant-color-text-secondary)', margin: '4px 0 0 0' }}>管理阿里云账号凭证，支持多账号配置</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingAccount(null); setFormVisible(true); }}>添加账号</Button>
      </div>
      <Card><Table columns={columns} dataSource={accounts} rowKey="id" loading={loading} /></Card>
      <AccountForm visible={formVisible} onClose={() => { setFormVisible(false); setEditingAccount(null); }} onSuccess={fetchAccounts} initialValues={editingAccount} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Accounts/ frontend/src/api/accounts.ts
git commit -m "feat: 实现账号管理页面"
```

---

## Task 15: 巡检结果和配置页面

**Covers:** S5

**Files:**
- Create: `frontend/src/api/inspections.ts`
- Create: `frontend/src/pages/Inspections/index.tsx`
- Create: `frontend/src/pages/Thresholds/index.tsx`
- Create: `frontend/src/pages/Cron/index.tsx`

### Steps

- [ ] **Step 1: 创建 inspections API**

```typescript
// frontend/src/api/inspections.ts
import api from './index';

export async function getInspectionResults(params: any) {
  const res = await api.get('/inspections/results', { params });
  return res.data;
}

export async function exportResults(taskId?: number, format = 'excel') {
  const res = await api.get('/inspections/results/export', { params: { task_id: taskId, format }, responseType: 'blob' });
  return res.data;
}

export async function getThresholds() {
  const res = await api.get('/thresholds');
  return res.data;
}

export async function updateThreshold(id: number, params: any) {
  await api.put(`/thresholds/${id}`, params);
}

export async function getCronConfigs() {
  const res = await api.get('/cron');
  return res.data;
}

export async function createCronConfig(params: any) {
  const res = await api.post('/cron', params);
  return res.data;
}

export async function updateCronConfig(id: number, params: any) {
  await api.put(`/cron/${id}`, params);
}

export async function deleteCronConfig(id: number) {
  await api.delete(`/cron/${id}`);
}
```

- [ ] **Step 2: 创建巡检结果页面**

```tsx
// frontend/src/pages/Inspections/index.tsx
import { useEffect, useState } from 'react';
import { Card, Table, Tag, Select, Button, Breadcrumb, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getInspectionResults, exportResults } from '../../api/inspections';

const RESOURCE_TYPES = ['', 'ECS', 'RDS', 'SLB', 'OSS', 'Redis', 'NAT'];

export default function Inspections() {
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<any>({ page: 1, page_size: 20 });

  const fetchResults = async () => {
    setLoading(true);
    try {
      const data = await getInspectionResults(filter);
      setResults(data.items);
      setTotal(data.total);
    } catch { message.error('获取失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchResults(); }, [filter]);

  const handleExport = async () => {
    try {
      const blob = await exportResults(filter.task_id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inspection_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`;
      a.click();
    } catch { message.error('导出失败'); }
  };

  const columns = [
    { title: '资源类型', dataIndex: 'resource_type', key: 'type', render: (t: string) => <Tag>{t}</Tag> },
    { title: '资源名称', dataIndex: 'resource_name', key: 'name' },
    { title: '实例ID', dataIndex: 'resource_id', key: 'id', render: (id: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{id}</span> },
    { title: '地域', dataIndex: 'region', key: 'region', render: (r: string) => <Tag>{r}</Tag> },
    { title: 'CPU', dataIndex: 'cpu_usage', key: 'cpu', render: (v: number | null) => v !== null ? <span style={{ color: v > 90 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{v.toFixed(1)}%</span> : '-' },
    { title: '内存', dataIndex: 'memory_usage', key: 'mem', render: (v: number | null) => v !== null ? <span style={{ color: v > 90 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{v.toFixed(1)}%</span> : '-' },
    { title: '磁盘', dataIndex: 'disk_usage', key: 'disk', render: (v: number | null) => v !== null ? <span style={{ color: v > 90 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{v.toFixed(1)}%</span> : '-' },
    { title: '状态', dataIndex: 'is_abnormal', key: 'status', render: (a: boolean) => <Tag color={a ? 'error' : 'success'}>{a ? '异常' : '正常'}</Tag> },
  ];

  return (
    <div>
      <Breadcrumb items={[{ title: '巡检中心' }, { title: '巡检结果' }]} style={{ marginBottom: 16 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>巡检结果</h1>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>导出 Excel</Button>
      </div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <Select placeholder="资源类型" allowClear style={{ width: 120 }} options={RESOURCE_TYPES.filter(Boolean).map(t => ({ label: t, value: t }))}
            onChange={v => setFilter((f: any) => ({ ...f, resource_type: v }))} />
          <Select placeholder="状态" allowClear style={{ width: 100 }}
            options={[{ label: '正常', value: false }, { label: '异常', value: true }]}
            onChange={v => setFilter((f: any) => ({ ...f, is_abnormal: v }))} />
        </div>
      </Card>
      <Card>
        <Table columns={columns} dataSource={results} rowKey="id" loading={loading}
          pagination={{ current: filter.page, pageSize: filter.page_size, total, onChange: (p, s) => setFilter((f: any) => ({ ...f, page: p, page_size: s })) }} />
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: 创建阈值配置页面**

```tsx
// frontend/src/pages/Thresholds/index.tsx
import { useEffect, useState } from 'react';
import { Card, Form, InputNumber, Button, message, Breadcrumb, Space } from 'antd';
import { getThresholds, updateThreshold } from '../../api/inspections';

export default function Thresholds() {
  const [thresholds, setThresholds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const fetchThresholds = async () => {
    setLoading(true);
    try {
      const data = await getThresholds();
      setThresholds(data);
      if (data.length > 0) {
        form.setFieldsValue(data[0]);
      }
    } catch { message.error('获取失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchThresholds(); }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (thresholds.length > 0) {
        await updateThreshold(thresholds[0].id, values);
        message.success('保存成功');
      }
    } catch { message.error('保存失败'); }
  };

  return (
    <div>
      <Breadcrumb items={[{ title: '配置中心' }, { title: '告警阈值' }]} style={{ marginBottom: 16 }} />
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>告警阈值设置</h1>
      <Card loading={loading} style={{ maxWidth: 600 }}>
        <Form form={form} layout="vertical">
          <Form.Item name="cpu_threshold" label="CPU 使用率阈值 (%)" rules={[{ required: true }]}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="memory_threshold" label="内存使用率阈值 (%)" rules={[{ required: true }]}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="disk_threshold" label="磁盘使用率阈值 (%)" rules={[{ required: true }]}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleSave}>保存配置</Button>
              <Button onClick={() => form.setFieldsValue({ cpu_threshold: 80, memory_threshold: 80, disk_threshold: 80 })}>80%</Button>
              <Button onClick={() => form.setFieldsValue({ cpu_threshold: 90, memory_threshold: 90, disk_threshold: 90 })}>90%</Button>
              <Button onClick={() => form.setFieldsValue({ cpu_threshold: 95, memory_threshold: 95, disk_threshold: 95 })}>95%</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: 创建定时任务页面**

```tsx
// frontend/src/pages/Cron/index.tsx
import { useEffect, useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Input, Switch, message, Breadcrumb, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { getCronConfigs, createCronConfig, updateCronConfig, deleteCronConfig } from '../../api/inspections';

export default function Cron() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchConfigs = async () => {
    setLoading(true);
    try { setConfigs(await getCronConfigs()); }
    catch { message.error('获取失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchConfigs(); }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await createCronConfig(values);
      message.success('创建成功');
      form.resetFields();
      setModalVisible(false);
      fetchConfigs();
    } catch (e: any) { if (e.message) message.error(e.message); }
  };

  const handleToggle = async (id: number, enabled: boolean) => {
    try {
      await updateCronConfig(id, { is_enabled: enabled });
      message.success(enabled ? '已启用' : '已禁用');
      fetchConfigs();
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id: number) => {
    try { await deleteCronConfig(id); message.success('删除成功'); fetchConfigs(); }
    catch { message.error('删除失败'); }
  };

  const columns = [
    { title: '任务名称', dataIndex: 'name', key: 'name' },
    { title: 'Cron 表达式', dataIndex: 'cron_expression', key: 'cron', render: (e: string) => <code>{e}</code> },
    { title: '状态', dataIndex: 'is_enabled', key: 'enabled', render: (e: boolean, r: any) => <Switch checked={e} onChange={v => handleToggle(r.id, v)} /> },
    { title: '上次运行', dataIndex: 'last_run_at', key: 'last', render: (t: string) => t || '-' },
    { title: '下次运行', dataIndex: 'next_run_at', key: 'next', render: (t: string) => t || '-' },
    { title: '操作', key: 'action', render: (_: any, r: any) => <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}><Button type="link" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm> },
  ];

  return (
    <div>
      <Breadcrumb items={[{ title: '配置中心' }, { title: '定时任务' }]} style={{ marginBottom: 16 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>定时任务管理</h1>
          <p style={{ color: 'var(--ant-color-text-secondary)', margin: '4px 0 0 0' }}>配置自动巡检的定时任务</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>添加任务</Button>
      </div>
      <Card>
        <Table columns={columns} dataSource={configs} rowKey="id" loading={loading} />
      </Card>
      <Modal title="添加定时任务" open={modalVisible} onOk={handleCreate} onCancel={() => setModalVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="任务名称" rules={[{ required: true }]}><Input placeholder="如：每日巡检" /></Form.Item>
          <Form.Item name="cron_expression" label="Cron 表达式" rules={[{ required: true }]}><Input placeholder="如：0 8 * * * (每天8点)" /></Form.Item>
        </Form>
        <p style={{ color: 'var(--ant-color-text-secondary)', fontSize: 12 }}>格式: 分 时 日 月 周。示例: 0 8 * * * (每天8点), 0 */2 * * * (每2小时)</p>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ frontend/src/api/inspections.ts
git commit -m "feat: 实现巡检结果和配置页面"
```
