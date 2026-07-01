import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Tag, Button, Breadcrumb, message, Space, Row, Col, Progress, Segmented } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, CheckCircleOutlined, WarningOutlined, CloudServerOutlined, DatabaseOutlined, FilterOutlined, ApiOutlined, ClockCircleOutlined, SaveOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import dayjs from 'dayjs';
import { getInspectionResults, getInspectionTasks, exportResults } from '../../../api/inspections';
import { getAccounts } from '../../../api/accounts';
import type {
  InspectionResult,
  InspectionTaskWithAccounts,
  CloudAccount,
  SlbListener,
  SlbBackendServer,
  DiskDetail,
  ResourceTypeStats,
} from '../../../types';

const RESOURCE_ICONS: Record<string, ReactNode> = {
  ECS: <CloudServerOutlined />,
  RDS: <DatabaseOutlined />,
  Redis: <SaveOutlined />,
  SLB_Listener: <ApiOutlined />,
  SLB_Backend: <ApiOutlined />,
  Expiration: <ClockCircleOutlined />,
};

const RESOURCE_COLORS: Record<string, string> = {
  ECS: '#3b82f6',
  RDS: '#8b5cf6',
  Redis: '#dc2626',
  SLB_Listener: '#f59e0b',
  SLB_Backend: '#10b981',
  Expiration: '#ef4444',
};

const RESOURCE_LABELS: Record<string, string> = {
  ECS: 'ECS 资源',
  RDS: 'RDS 资源',
  Redis: 'Redis 资源',
  SLB_Listener: 'SLB 监听器',
  SLB_Backend: 'SLB 后端服务器',
  Expiration: '实例到期提醒',
};

interface GroupedItem extends InspectionResult {
  status: 'normal' | 'warning' | 'abnormal';
}

type GroupedResults = Record<string, GroupedItem[]>;

function safeParseJSON<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; }
  catch { return fallback; }
}

export default function InspectionDetail() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState<InspectionResult[]>([]);
  const [task, setTask] = useState<InspectionTaskWithAccounts | null>(null);
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [, setLoading] = useState(false);
  const [showMode, setShowMode] = useState<'all' | 'warning' | 'abnormal'>('abnormal');

  const fetchTask = async () => {
    try {
      const data = await getInspectionTasks(1, 100);
      const found = data.items?.find((t) => t.id === Number(taskId));
      if (found) setTask(found as InspectionTaskWithAccounts);
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
      let allResults: InspectionResult[] = [];
      let page = 1;
      let hasMore = true;
      const MAX_PAGES = 50;
      while (hasMore && page <= MAX_PAGES) {
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
      window.URL.revokeObjectURL(url);
    } catch { message.error('导出失败'); }
  };

  const getAccountName = (id: number): string => {
    const account = accounts.find(a => a.id === id);
    return account ? account.name : `账号${id}`;
  };

  const groupedResults: GroupedResults = results.reduce<GroupedResults>((acc, item) => {
    if (item.resource_type === 'SLB') {
      const slbDetails = safeParseJSON(item.slb_details, {} as { listeners?: SlbListener[]; backend_servers?: SlbBackendServer[] });
      const listeners = slbDetails.listeners || [];
      const hasListenerWarning = listeners.some((l) => l.status === 'stopped');
      const hasListenerAbnormal = listeners.some((l) => l.status !== 'running' && l.status !== 'stopped');
      const backendServers = slbDetails.backend_servers || [];
      const hasBackendWarning = backendServers.some((s) => s.status === 'unavailable');
      const hasBackendAbnormal = backendServers.some((s) => s.status === 'abnormal');

      if (!acc['SLB_Listener']) acc['SLB_Listener'] = [];
      const listenerItem: GroupedItem = {
        ...item,
        status: hasListenerAbnormal ? 'abnormal' : hasListenerWarning ? 'warning' : 'normal',
      };
      acc['SLB_Listener'].push(listenerItem);

      if (!acc['SLB_Backend']) acc['SLB_Backend'] = [];
      const backendItem: GroupedItem = {
        ...item,
        status: hasBackendAbnormal ? 'abnormal' : hasBackendWarning ? 'warning' : 'normal',
      };
      acc['SLB_Backend'].push(backendItem);
    } else {
      const type = item.resource_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(item as GroupedItem);
    }
    return acc;
  }, {});

  const getFilteredItems = (items: GroupedItem[]): GroupedItem[] => {
    if (showMode === 'abnormal') return items.filter(i => i.status === 'abnormal');
    if (showMode === 'warning') return items.filter(i => i.status === 'abnormal' || i.status === 'warning');
    return items;
  };

  const getResourceTypeStats = (items: GroupedItem[]): ResourceTypeStats => {
    const total = items.length;
    const abnormal = items.filter(i => i.status === 'abnormal').length;
    const warning = items.filter(i => i.status === 'warning').length;
    return { total, abnormal, warning, normal: total - abnormal - warning };
  };

  const renderMetric = (value: number | null, threshold = 90) => {
    if (value === null) return <span style={{ color: 'var(--color-muted)' }}>-</span>;
    const color = value >= threshold ? 'var(--color-abnormal-text)' : value >= threshold - 10 ? 'var(--color-warning-text)' : 'var(--color-normal-text)';
    return <span style={{ color, fontWeight: 600, fontSize: 18 }}>{value.toFixed(1)}%</span>;
  };

  const renderDiskDetails = (record: InspectionResult) => {
    const diskDetails = safeParseJSON<DiskDetail[]>(record.disk_details, []);
    const filterPrefixes = ['/var/lib/container', '/var/lib/kubelet', '/var/lib/docker', '/run/container'];
    const expandedDisks: DiskDetail[] = [];
    for (const disk of diskDetails) {
      const names = disk.device?.split(',').map((s: string) => s.trim()) || [];
      for (const name of names) {
        if (name && name.startsWith('/')) expandedDisks.push({ device: name, usage: disk.usage });
      }
    }
    const filteredDisks = expandedDisks.filter((disk) => !filterPrefixes.some(prefix => disk.device?.startsWith(prefix)));
    if (filteredDisks.length === 0) return record.disk_usage !== null ? renderMetric(record.disk_usage) : <span style={{ color: 'var(--color-muted)' }}>-</span>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filteredDisks.map((disk, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--color-muted)', fontSize: 12, minWidth: 80 }}>{disk.device}</span>
            <Progress percent={Math.round(disk.usage)} size="small" strokeColor={disk.usage > 90 ? 'var(--color-abnormal-text)' : disk.usage > 70 ? 'var(--color-warning-text)' : 'var(--color-normal-text)'} style={{ flex: 1, marginBottom: 0 }} />
          </div>
        ))}
      </div>
    );
  };

  const renderSlbListenerItems = (record: InspectionResult) => {
    const slbDetails = safeParseJSON<{ listeners?: SlbListener[] }>(record.slb_details, {});
    let listeners = slbDetails.listeners || [];
    if (showMode === 'abnormal' || showMode === 'warning') {
      listeners = listeners.filter((l) => l.status !== 'running');
    }
    if (listeners.length === 0) return <span style={{ color: 'var(--color-muted)' }}>-</span>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {listeners.map((listener, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{listener.protocol}:{listener.port}</span>
            <Tag color={listener.status === 'running' ? 'success' : listener.status === 'stopped' ? 'warning' : 'error'} style={{ margin: 0, fontSize: 11 }}>
              {listener.status}
            </Tag>
          </div>
        ))}
      </div>
    );
  };

  const renderSlbBackendItems = (record: InspectionResult) => {
    const slbDetails = safeParseJSON<{ backend_servers?: SlbBackendServer[] }>(record.slb_details, {});
    let backendServers = slbDetails.backend_servers || [];
    if (showMode === 'abnormal' || showMode === 'warning') {
      backendServers = backendServers.filter((s) => s.status !== 'normal');
    }
    if (backendServers.length === 0) return <span style={{ color: 'var(--color-muted)' }}>-</span>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {backendServers.map((server, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{server.serverIp}:{server.port}</span>
            <Tag color={server.status === 'normal' ? 'success' : server.status === 'unavailable' ? 'warning' : 'error'} style={{ margin: 0, fontSize: 11 }}>
              {server.status}
            </Tag>
          </div>
        ))}
      </div>
    );
  };

  const statusBg = (status: string) => {
    if (status === 'abnormal') return 'var(--color-abnormal-bg)';
    if (status === 'warning') return 'var(--color-warning-bg)';
    return 'var(--color-normal-bg)';
  };

  const statusBorder = (status: string) => {
    if (status === 'abnormal') return 'var(--color-abnormal-border)';
    if (status === 'warning') return 'var(--color-warning-border)';
    return 'transparent';
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
          <Segmented value={showMode} onChange={(v) => setShowMode(v as 'all' | 'warning' | 'abnormal')} options={[
            { label: '仅异常', value: 'abnormal', icon: <WarningOutlined /> },
            { label: '异常+警告', value: 'warning' },
            { label: '全部', value: 'all', icon: <FilterOutlined /> }
          ]} />
          <Button icon={<DownloadOutlined />} onClick={handleExport}>导出 Excel</Button>
        </Space>
      </div>

      {task && (
        <Card style={{ marginBottom: 24, background: 'var(--color-card-summary-bg)', border: 'none' }}>
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

      {/* 资源类型异常统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {Object.entries(groupedResults).map(([resourceType, items]) => {
          const stats = getResourceTypeStats(items);
          const icon = RESOURCE_ICONS[resourceType] || <CloudServerOutlined />;
          const color = RESOURCE_COLORS[resourceType] || '#3b82f6';
          const label = RESOURCE_LABELS[resourceType] || `${resourceType} 资源`;
          const hasAbnormal = stats.abnormal > 0 || stats.warning > 0;

          return (
            <Col key={resourceType} span={6}>
              <Card
                hoverable
                onClick={() => {
                  const el = document.getElementById(`resource-${resourceType}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                style={{ cursor: 'pointer', borderLeft: `4px solid ${hasAbnormal ? 'var(--color-abnormal-border)' : 'var(--color-normal-text)'}` }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 18 }}>{icon}</div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{label}</div>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div><div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 2 }}>总计</div><div style={{ fontSize: 20, fontWeight: 700 }}>{stats.total}</div></div>
                  <div><div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 2 }}>正常</div><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-normal-text)' }}>{stats.normal}</div></div>
                  {stats.warning > 0 && <div><div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 2 }}>警告</div><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-warning-text)' }}>{stats.warning}</div></div>}
                  {stats.abnormal > 0 && <div><div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 2 }}>异常</div><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-abnormal-text)' }}>{stats.abnormal}</div></div>}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {Object.entries(groupedResults).map(([resourceType, items]) => {
        const filteredItems = getFilteredItems(items);
        if (filteredItems.length === 0) return null;
        const stats = getResourceTypeStats(items);
        const icon = RESOURCE_ICONS[resourceType] || <CloudServerOutlined />;
        const color = RESOURCE_COLORS[resourceType] || '#3b82f6';
        const label = RESOURCE_LABELS[resourceType] || `${resourceType} 资源`;
        const isSlbType = resourceType === 'SLB_Listener' || resourceType === 'SLB_Backend';
        const isExpiration = resourceType === 'Expiration';
        const gridCols = isExpiration ? '2fr 2fr 1.5fr 2fr 1fr' : isSlbType ? '2fr 2fr 1.5fr 3fr 0.8fr' : '2fr 1.5fr 1fr 1fr 1fr 1fr 0.8fr';

        return (
          <Card key={resourceType} id={`resource-${resourceType}`} style={{ marginBottom: 16, scrollMarginTop: 20 }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 20 }}>{icon}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 400 }}>{showMode === 'abnormal' ? `${filteredItems.length} 个异常实例` : `共 ${stats.total} 个实例`}</div>
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
              <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 16, padding: '8px 12px', background: 'var(--color-table-header-bg)', borderRadius: '8px 8px 0 0', fontSize: 12, color: 'var(--color-muted)', fontWeight: 500, borderBottom: '1px solid var(--color-table-border)' }}>
                <div>{isExpiration ? '产品' : '资源名称'}</div>
                <div>{isExpiration ? '实例ID' : '实例ID'}</div>
                <div>{isExpiration ? '地域' : '账号 / 地域'}</div>
                <div style={{ textAlign: 'center' }}>{isExpiration ? '到期时间' : resourceType === 'SLB_Listener' ? '监听器状态' : resourceType === 'SLB_Backend' ? '后端服务器状态' : 'CPU'}</div>
                {isExpiration ? <div style={{ textAlign: 'center' }}>剩余天数</div> : !isSlbType && <div style={{ textAlign: 'center' }}>内存</div>}
                {!isSlbType && !isExpiration && <div style={{ textAlign: 'center' }}>磁盘</div>}
                <div style={{ textAlign: 'center' }}>状态</div>
              </div>
              {filteredItems.map((item) => {
                const details = safeParseJSON(item.expiration_details, {} as Record<string, unknown>);
                return (
                  <div key={item.id} style={{
                    display: 'grid', gridTemplateColumns: gridCols,
                    gap: 16, padding: '12px 16px',
                    background: statusBg(item.status),
                    borderBottom: '1px solid var(--color-table-border)',
                    borderLeft: `3px solid ${statusBorder(item.status)}`,
                    alignItems: 'center'
                  }}>
                    {isExpiration ? (
                      <>
                        <div style={{ fontWeight: 500 }}>{details.product_code as string || '-'}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: 'monospace' }}>{item.resource_id}</div>
                        <div><Tag style={{ margin: 0 }}>{item.region}</Tag></div>
                        <div style={{ textAlign: 'center', fontSize: 13 }}>{details.end_time ? dayjs(details.end_time as string).format('YYYY-MM-DD') : '-'}</div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ color: (details.days_remaining as number) < 7 ? 'var(--color-abnormal-text)' : 'var(--color-warning-text)', fontWeight: 600, fontSize: 16 }}>
                            {details.days_remaining as number} 天
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 500 }}>{item.resource_name || '-'}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: 'monospace' }}>{item.resource_id}</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}><Tag style={{ margin: 0 }}>{getAccountName(item.account_id)}</Tag><Tag style={{ margin: 0 }}>{item.region}</Tag></div>
                        {resourceType === 'SLB_Listener' ? <div>{renderSlbListenerItems(item)}</div> : resourceType === 'SLB_Backend' ? <div>{renderSlbBackendItems(item)}</div> : <><div style={{ textAlign: 'center' }}>{renderMetric(item.cpu_usage)}</div><div style={{ textAlign: 'center' }}>{renderMetric(item.memory_usage)}</div><div style={{ textAlign: 'center' }}>{renderDiskDetails(item)}</div></>}
                      </>
                    )}
                    <div style={{ textAlign: 'center' }}>
                      <Tag color={item.status === 'abnormal' ? 'error' : item.status === 'warning' ? 'warning' : 'success'}>
                        {item.status === 'abnormal' ? '异常' : item.status === 'warning' ? '警告' : '正常'}
                      </Tag>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
