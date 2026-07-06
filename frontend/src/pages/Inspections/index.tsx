import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, message, Select, Space } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getInspectionTasks } from '../../api/inspections';
import { getAccounts } from '../../api/accounts';
import type { InspectionTaskWithAccounts, CloudAccount } from '../../types';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';

export default function Inspections() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<InspectionTaskWithAccounts[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [filterTrigger, setFilterTrigger] = useState<string | undefined>(undefined);
  const [filterAccount, setFilterAccount] = useState<number | undefined>(undefined);

  const fetchTasks = async (p: number, ps: number) => {
    setLoading(true);
    try {
      const filters: { trigger_type?: string; account_id?: number } = {};
      if (filterTrigger) filters.trigger_type = filterTrigger;
      if (filterAccount) filters.account_id = filterAccount;
      const data = await getInspectionTasks(p, ps, filters);
      setTasks((data.items || []) as InspectionTaskWithAccounts[]);
      setTotal(data.total);
    } catch { message.error('获取失败'); }
    finally { setLoading(false); }
  };

  const fetchAccounts = async () => {
    try { setAccounts(await getAccounts()); } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    setPage(1);
    fetchTasks(1, pageSize);
  }, [filterTrigger, filterAccount]);

  const handlePageChange = (p: number, ps: number) => {
    setPage(p);
    setPageSize(ps);
    fetchTasks(p, ps);
  };

  const columns = [
    { title: '批次ID', dataIndex: 'id', key: 'id', render: (id: number) => <Tag color="blue">#{id}</Tag> },
    { title: '巡检账号', dataIndex: 'account_names', key: 'accounts', render: (names: string[]) => {
      if (!names || names.length === 0) return <span style={{ color: 'var(--color-muted)' }}>-</span>;
      return <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{names.map((n, i) => <Tag key={i}>{n}</Tag>)}</div>;
    }},
    { title: '触发方式', dataIndex: 'trigger_type', key: 'trigger_type', render: (t: string) => <Tag color={t === 'manual' ? 'blue' : 'purple'}>{t === 'manual' ? '手动' : '定时'}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <StatusTag status={s} /> },
    { title: '资源总数', dataIndex: 'total_resources', key: 'total', render: (v: number) => <strong>{v}</strong> },
    { title: '正常', dataIndex: 'normal_count', key: 'normal', render: (v: number) => <span style={{ color: 'var(--color-normal-text)' }}>{v}</span> },
    { title: '异常', dataIndex: 'abnormal_count', key: 'abnormal', render: (v: number) => <span style={{ color: v > 0 ? 'var(--color-abnormal-text)' : 'var(--color-normal-text)' }}>{v}</span> },
    { title: '开始时间', dataIndex: 'started_at', key: 'started_at', render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss') },
    { title: '完成时间', dataIndex: 'completed_at', key: 'completed_at', render: (t: string) => t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-' },
    { title: '操作', key: 'action', render: (_: unknown, r: InspectionTaskWithAccounts) => <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/inspections/${r.id}`)}>查看详情</Button> },
  ];

  return (
    <div>
      <PageHeader breadcrumbs={[{ title: '巡检中心' }, { title: '巡检记录' }]} title="巡检记录" />
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Select allowClear placeholder="触发方式" style={{ width: 120 }} value={filterTrigger} onChange={setFilterTrigger}
              options={[{ label: '手动', value: 'manual' }, { label: '定时', value: 'cron' }]} />
            <Select allowClear placeholder="筛选账号" style={{ width: 160 }} value={filterAccount} onChange={setFilterAccount}
              options={accounts.map(a => ({ label: a.name, value: a.id }))} />
          </Space>
        </div>
        <Table columns={columns} dataSource={tasks} rowKey="id" loading={loading}
          pagination={{ current: page, pageSize, total, onChange: handlePageChange }} />
      </Card>
    </div>
  );
}
