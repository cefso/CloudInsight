import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Tag, Button, Breadcrumb, message, Space, Statistic, Row, Col, Progress, Segmented } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, CheckCircleOutlined, WarningOutlined, CloudServerOutlined, DatabaseOutlined, FilterOutlined, ApiOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getInspectionResults, getInspectionTasks, exportResults } from '../../../api/inspections';
import { getAccounts } from '../../../api/accounts';

const RESOURCE_ICONS: Record<string, any> = {
  ECS: <CloudServerOutlined />,
  RDS: <DatabaseOutlined />,
  SLB_Listener: <ApiOutlined />,
  SLB_Backend: <ApiOutlined />,
};

const RESOURCE_COLORS: Record<string, string> = {
  ECS: '#3b82f6',
  RDS: '#8b5cf6',
  SLB_Listener: '#f59e0b',
  SLB_Backend: '#10b981',
};

const RESOURCE_LABELS: Record<string, string> = {
  ECS: 'ECS 资源',
  RDS: 'RDS 资源',
  SLB_Listener: 'SLB 监听器',
  SLB_Backend: 'SLB 后端服务器',
};

export default function InspectionDetail() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState<any[]>([]);
  const [task, setTask] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMode, setShowMode] = useState<'all' | 'abnormal'>('abnormal');

  const fetchTask = async () => {
    try {
      const data = await getInspectionTasks(1, 100);
      const found = data.items?.find((t: any) => t.id === Number(taskId));
      if (found) setTask(found);
    } catch { /* ignore */ }
  };

  const fetchAccounts = async () => {
    try {
      const data = await getAccounts();
      setAccounts(data);
    } catch { /* ignore */ }
  };

  const fetchResults = async () => {
    setLoading(true);
    try {
      let allResults: any[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const data = await getInspectionResults({ task_id: Number(taskId), page_size: 100, page });
        const items = data.items || [];
        allResults = [...allResults, ...items];
        if (items.length < 100 || allResults.length >= data.total) hasMore = false;
        else page++;
      }
      setResults(allResults);
    } catch { message.error('获取失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTask(); fetchAccounts(); fetchResults(); }, [taskId]);

  const handleExport = async () => {
    try {
      const blob = await exportResults(Number(taskId));
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inspection_${taskId}_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`;
      a.click();
    } catch { message.error('导出失败'); }
  };

  const getAccountName = (id: number) => {
    const account = accounts.find(a => a.id === id);
    return account ? account.name : `账号${id}`;
  };

  // 按资源类型分组，SLB 拆分为监听器和后端服务器
  const groupedResults = results.reduce((acc: any, item: any) => {
    if (item.resource_type === 'SLB') {
      if (!acc['SLB_Listener']) acc['SLB_Listener'] = [];
      acc['SLB_Listener'].push(item);
      if (!acc['SLB_Backend']) acc['SLB_Backend'] = [];
      acc['SLB_Backend'].push(item);
    } else {
      const type = item.resource_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(item);
    }
    return acc;
  }, {});

  const getFilteredItems = (items: any[]) => {
    if (showMode === 'abnormal') return items.filter(i => i.status === 'abnormal' || i.status === 'warning');
    return items;
  };

  const getResourceTypeStats = (items: any[]) => {
    const total = items.length;
    const abnormal = items.filter(i => i.status === 'abnormal').length;
    const warning = items.filter(i => i.status === 'warning').length;
    return { total, abnormal, warning, normal: total - abnormal - warning };
  };

  const renderMetric = (value: number | null, threshold = 90) => {
    if (value === null) return <span style={{ color: '#8c8c8c' }}>-</span>;
    const color = value >= threshold ? '#dc2626' : value >= threshold - 10 ? '#f59e0b' : '#16a34a';
    return <span style={{ color, fontWeight: 600, fontSize: 18 }}>{value.toFixed(1)}%</span>;
  };

  const renderDiskDetails = (record: any) => {
    let diskDetails = record.disk_details ? JSON.parse(record.disk_details) : [];
    const filterPrefixes = ['/var/lib/container', '/var/lib/kubelet', '/var/lib/docker', '/run/container'];
    const expandedDisks: any[] = [];
    for (const disk of diskDetails) {
      const names = disk.device?.split(',').map((s: string) => s.trim()) || [];
      for (const name of names) {
        if (name && name.startsWith('/')) expandedDisks.push({ device: name, usage: disk.usage });
      }
    }
    const filteredDisks = expandedDisks.filter((disk: any) => !filterPrefixes.some(prefix => disk.device?.startsWith(prefix)));
    if (filteredDisks.length === 0) return record.disk_usage !== null ? renderMetric(record.disk_usage) : <span style={{ color: '#8c8c8c' }}>-</span>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filteredDisks.map((disk: any, idx: number) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#8c8c8c', fontSize: 12, minWidth: 80 }}>{disk.device}</span>
            <Progress percent={Math.round(disk.usage)} size="small" strokeColor={disk.usage > 90 ? '#dc2626' : disk.usage > 70 ? '#f59e0b' : '#16a34a'} style={{ flex: 1, marginBottom: 0 }} />
          </div>
        ))}
      </div>
    );
  };

  const renderSlbListenerItems = (record: any) => {
    let slbDetails = record.disk_details ? JSON.parse(record.disk_details) : {};
    let listeners = slbDetails.listeners || [];
    if (showMode === 'abnormal') listeners = listeners.filter((l: any) => l.status !== 'running');
    if (listeners.length === 0) return <span style={{ color: '#8c8c8c' }}>-</span>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {listeners.map((listener: any, idx: number) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{listener.protocol}:{listener.port}</span>
            <Tag color={listener.status === 'running' ? 'success' : 'error'} style={{ margin: 0, fontSize: 11 }}>{listener.status}</Tag>
          </div>
        ))}
      </div>
    );
  };

  const renderSlbBackendItems = (record: any) => {
    let slbDetails = record.disk_details ? JSON.parse(record.disk_details) : {};
    let backendServers = slbDetails.backend_servers || [];
    if (showMode === 'abnormal') backendServers = backendServers.filter((s: any) => s.status !== 'normal');
    if (backendServers.length === 0) return <span style={{ color: '#8c8c8c' }}>-</span>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {backendServers.map((server: any, idx: number) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{server.serverIp}:{server.port}</span>
            <Tag color={server.status === 'normal' ? 'success' : 'error'} style={{ margin: 0, fontSize: 11 }}>{server.status}</Tag>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <Breadcrumb items={[{ title: '巡检中心' }, { title: <a onClick={() => navigate('/inspections')}>巡检记录</a> }, { title: `批次 #${taskId}` }]} style={{ marginBottom: 16 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/inspections')}>返回</Button>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>巡检报告 #{taskId}</h1>
        </Space>
        <Space>
          <Segmented value={showMode} onChange={(v) => setShowMode(v as 'all' | 'abnormal')} options={[{ label: '仅异常', value: 'abnormal', icon: <WarningOutlined /> }, { label: '全部', value: 'all', icon: <FilterOutlined /> }]} />
          <Button icon={<DownloadOutlined />} onClick={handleExport}>导出 Excel</Button>
        </Space>
      </div>

      {task && (
        <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none' }}>
          <Row gutter={[32, 16]} style={{ color: 'white' }}>
            <Col span={3}><div style={{ opacity: 0.8, marginBottom: 4 }}>触发方式</div><div style={{ fontSize: 20, fontWeight: 600 }}>{task.trigger_type === 'manual' ? '手动' : '定时'}</div></Col>
            <Col span={3}><div style={{ opacity: 0.8, marginBottom: 4 }}>巡检状态</div><div style={{ fontSize: 20, fontWeight: 600 }}>{task.status === 'completed' ? '已完成' : task.status === 'failed' ? '失败' : '进行中'}</div></Col>
            <Col span={3}><div style={{ opacity: 0.8, marginBottom: 4 }}>资源总数</div><div style={{ fontSize: 28, fontWeight: 700 }}>{task.total_resources}</div></Col>
            <Col span={3}><div style={{ opacity: 0.8, marginBottom: 4 }}>正常</div><div style={{ fontSize: 28, fontWeight: 700, color: '#86efac' }}>{task.normal_count}</div></Col>
            <Col span={4}><div style={{ opacity: 0.8, marginBottom: 4 }}>警告</div><div style={{ fontSize: 28, fontWeight: 700, color: '#fcd34d' }}>{task.warning_count || 0}</div></Col>
            <Col span={4}><div style={{ opacity: 0.8, marginBottom: 4 }}>异常</div><div style={{ fontSize: 28, fontWeight: 700, color: task.abnormal_count > 0 ? '#fca5a5' : '#86efac' }}>{task.abnormal_count}</div></Col>
            <Col span={4}><div style={{ opacity: 0.8, marginBottom: 4 }}>巡检时间</div><div style={{ fontSize: 16 }}>{dayjs(task.started_at).format('YYYY-MM-DD HH:mm:ss')}</div></Col>
          </Row>
        </Card>
      )}

      {Object.entries(groupedResults).map(([resourceType, items]: [string, any]) => {
        const filteredItems = getFilteredItems(items);
        if (filteredItems.length === 0) return null;
        const stats = getResourceTypeStats(items);
        const icon = RESOURCE_ICONS[resourceType] || <CloudServerOutlined />;
        const color = RESOURCE_COLORS[resourceType] || '#3b82f6';
        const label = RESOURCE_LABELS[resourceType] || `${resourceType} 资源`;
        const isSlbType = resourceType === 'SLB_Listener' || resourceType === 'SLB_Backend';

        return (
          <Card key={resourceType} style={{ marginBottom: 16 }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 20 }}>{icon}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 400 }}>{showMode === 'abnormal' ? `${filteredItems.length} 个异常实例` : `共 ${stats.total} 个实例`}</div>
                </div>
              </div>
            }
            extra={<Space>
              <Tag icon={<CheckCircleOutlined />} color="success">{stats.normal} 正常</Tag>
              {stats.warning > 0 && <Tag color="warning">{stats.warning} 警告</Tag>}
              {stats.abnormal > 0 && <Tag icon={<WarningOutlined />} color="error">{stats.abnormal} 异常</Tag>}
            </Space>}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: isSlbType ? '2fr 2fr 1.5fr 3fr 0.8fr' : '2fr 1.5fr 1fr 1fr 1fr 1fr 0.8fr', gap: 16, padding: '8px 12px', background: '#f9fafb', borderRadius: '8px 8px 0 0', fontSize: 12, color: '#6b7280', fontWeight: 500, borderBottom: '1px solid #e5e7eb' }}>
                <div>资源名称</div>
                <div>实例ID</div>
                <div>账号 / 地域</div>
                <div style={{ textAlign: 'center' }}>{resourceType === 'SLB_Listener' ? '监听器状态' : resourceType === 'SLB_Backend' ? '后端服务器状态' : 'CPU'}</div>
                {!isSlbType && <div style={{ textAlign: 'center' }}>内存</div>}
                {!isSlbType && <div style={{ textAlign: 'center' }}>磁盘</div>}
                <div style={{ textAlign: 'center' }}>状态</div>
              </div>
              {filteredItems.map((item: any, idx: number) => (
                <div key={item.id} style={{
                  display: 'grid', gridTemplateColumns: isSlbType ? '2fr 2fr 1.5fr 3fr 0.8fr' : '2fr 1.5fr 1fr 1fr 1fr 1fr 0.8fr',
                  gap: 16, padding: '12px 16px',
                  background: item.status === 'abnormal' ? '#fef2f2' : item.status === 'warning' ? '#fffbeb' : '#fff',
                  borderBottom: '1px solid #e5e7eb',
                  borderLeft: item.status === 'abnormal' ? '3px solid #ef4444' : item.status === 'warning' ? '3px solid #f59e0b' : '3px solid transparent',
                  alignItems: 'center'
                }}>
                  <div style={{ fontWeight: 500 }}>{item.resource_name || '-'}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{item.resource_id}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}><Tag style={{ margin: 0 }}>{getAccountName(item.account_id)}</Tag><Tag style={{ margin: 0 }}>{item.region}</Tag></div>
                  {resourceType === 'SLB_Listener' ? <div>{renderSlbListenerItems(item)}</div> : resourceType === 'SLB_Backend' ? <div>{renderSlbBackendItems(item)}</div> : <><div style={{ textAlign: 'center' }}>{renderMetric(item.cpu_usage)}</div><div style={{ textAlign: 'center' }}>{renderMetric(item.memory_usage)}</div><div style={{ textAlign: 'center' }}>{renderDiskDetails(item)}</div></>}
                  <div style={{ textAlign: 'center' }}>
                    <Tag color={item.status === 'abnormal' ? 'error' : item.status === 'warning' ? 'warning' : 'success'}>
                      {item.status === 'abnormal' ? '异常' : item.status === 'warning' ? '警告' : '正常'}
                    </Tag>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
