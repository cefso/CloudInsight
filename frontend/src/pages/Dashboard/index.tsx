import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Button, Table, Tag, message, Space, Breadcrumb, Modal, Select } from 'antd';
import { CloudServerOutlined, CheckCircleOutlined, WarningOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getDashboardStats, getAbnormalResources, triggerInspection } from '../../api/dashboard';
import { getAccounts } from '../../api/accounts';
import type { DashboardStats, AbnormalResource } from '../../api/dashboard';
import type { CloudAccount } from '../../api/accounts';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [abnormalResources, setAbnormalResources] = useState<AbnormalResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [showAccountModal, setShowAccountModal] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, resourcesData] = await Promise.all([getDashboardStats(), getAbnormalResources(10)]);
      setStats(statsData);
      setAbnormalResources(resourcesData);
    } catch { message.error('获取数据失败'); }
    finally { setLoading(false); }
  };

  const fetchAccounts = async () => {
    try {
      const data = await getAccounts();
      setAccounts(data);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchData(); fetchAccounts(); }, []);

  const handleTriggerClick = () => {
    if (accounts.length === 0) {
      message.warning('请先配置云账号');
      return;
    }
    setSelectedAccountIds([]);
    setShowAccountModal(true);
  };

  const handleTriggerConfirm = async () => {
    if (selectedAccountIds.length === 0) {
      message.warning('请选择要巡检的账号');
      return;
    }
    setShowAccountModal(false);
    setTriggering(true);
    try {
      await triggerInspection(selectedAccountIds);
      message.success('巡检任务已提交，请稍后刷新查看结果');
    } catch { 
      message.error('触发巡检失败');
    } finally {
      setTriggering(false);
    }
  };

  const columns = [
    { title: '资源类型', dataIndex: 'resource_type', key: 'type', render: (t: string) => <Tag color="red">{t}</Tag> },
    { title: '资源名称', dataIndex: 'resource_name', key: 'name' },
    { title: '实例ID', dataIndex: 'resource_id', key: 'id', render: (id: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{id}</span> },
    { title: '地域', dataIndex: 'region', key: 'region', render: (r: string) => <Tag>{r}</Tag> },
    { title: 'CPU', dataIndex: 'cpu_usage', key: 'cpu', render: (v: number | null) => v !== null ? <span style={{ color: v > 90 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{v.toFixed(1)}%</span> : '-' },
    { title: '内存', dataIndex: 'memory_usage', key: 'mem', render: (v: number | null) => v !== null ? <span style={{ color: v > 90 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{v.toFixed(1)}%</span> : '-' },
    { title: '磁盘', dataIndex: 'disk_usage', key: 'disk', render: (v: number | null) => v !== null ? <span style={{ color: v > 90 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{v.toFixed(1)}%</span> : '-' },
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
          <Button type="primary" icon={<ReloadOutlined />} loading={triggering} onClick={handleTriggerClick}>立即巡检</Button>
        </Space>
      </div>
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        <Col span={6}><Card loading={loading}><Statistic title="监控资源" value={stats?.total_resources || 0} prefix={<CloudServerOutlined />} /></Card></Col>
        <Col span={6}><Card loading={loading}><Statistic title="运行正常" value={stats?.normal_count || 0} prefix={<CheckCircleOutlined />} styles={{ content: { color: '#16a34a' } }} /></Card></Col>
        <Col span={6}><Card loading={loading}><Statistic title="存在异常" value={stats?.abnormal_count || 0} prefix={<WarningOutlined />} styles={{ content: { color: '#dc2626' } }} /></Card></Col>
        <Col span={6}><Card loading={loading}><Statistic title="巡检账号" value={stats?.account_count || 0} /></Card></Col>
      </Row>
      <Card title="异常资源列表" loading={loading}>
        <Table columns={columns} dataSource={abnormalResources} rowKey="id" pagination={false} />
      </Card>

      <Modal
        title="选择巡检账号"
        open={showAccountModal}
        onOk={handleTriggerConfirm}
        onCancel={() => setShowAccountModal(false)}
        okText="开始巡检"
        cancelText="取消"
      >
        <p style={{ marginBottom: 16 }}>请选择要巡检的云账号：</p>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="选择账号"
          value={selectedAccountIds}
          onChange={setSelectedAccountIds}
          options={accounts.map(a => ({
            label: `${a.name} (${a.access_key_id})`,
            value: a.id,
          }))}
        />
      </Modal>
    </div>
  );
}
