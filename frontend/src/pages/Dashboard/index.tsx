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
