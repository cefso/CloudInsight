import { useEffect, useState } from 'react';
import { Card, Form, InputNumber, Button, message, Breadcrumb, Space, Spin } from 'antd';
import { getThresholds, updateThreshold } from '../../api/inspections';
import { CloudServerOutlined, DatabaseOutlined, SaveOutlined } from '@ant-design/icons';
import type { AlertThreshold } from '../../types';

const RESOURCE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; hasCpu: boolean; hasMemory: boolean; hasDisk: boolean }> = {
  ECS: { label: 'ECS 云服务器', icon: <CloudServerOutlined />, color: '#3b82f6', hasCpu: true, hasMemory: true, hasDisk: true },
  RDS: { label: 'RDS 数据库', icon: <DatabaseOutlined />, color: '#8b5cf6', hasCpu: true, hasMemory: true, hasDisk: true },
  Redis: { label: 'Redis 缓存', icon: <SaveOutlined />, color: '#dc2626', hasCpu: false, hasMemory: true, hasDisk: false },
};

const CARD_ORDER = ['ECS', 'RDS', 'Redis'];

function ThresholdCard({ threshold, onSave }: { threshold: AlertThreshold; onSave: (id: number, values: { cpu_threshold?: number; memory_threshold?: number; disk_threshold?: number }) => Promise<void> }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const config = RESOURCE_CONFIG[threshold.resource_type || 'ECS'] || RESOURCE_CONFIG.ECS;

  useEffect(() => {
    form.setFieldsValue(threshold);
  }, [threshold, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await onSave(threshold.id, values);
      message.success(`${config.label} 阈值已保存`);
    } catch (e: unknown) {
      if (e instanceof Error && e.message) message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      style={{ borderTop: `3px solid ${config.color}`, height: '100%' }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: `${config.color}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: config.color, fontSize: 18
          }}>
            {config.icon}
          </div>
          <span>{config.label}</span>
        </div>
      }
    >
      <Form form={form} layout="vertical">
        {config.hasCpu && (
          <Form.Item name="cpu_threshold" label="CPU 使用率" rules={[{ required: true }]}>
            <InputNumber min={0} max={100} addonAfter="%" style={{ width: '100%' }} />
          </Form.Item>
        )}
        {config.hasMemory && (
          <Form.Item name="memory_threshold" label="内存使用率" rules={[{ required: true }]}>
            <InputNumber min={0} max={100} addonAfter="%" style={{ width: '100%' }} />
          </Form.Item>
        )}
        {config.hasDisk && (
          <Form.Item name="disk_threshold" label="磁盘使用率" rules={[{ required: true }]}>
            <InputNumber min={0} max={100} addonAfter="%" style={{ width: '100%' }} />
          </Form.Item>
        )}

        <div style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', marginBottom: 16 }}>
          <div>警告: ≥ 阈值-10% ｜ 异常: ≥ 阈值</div>
        </div>

        <Space>
          <Button type="primary" size="small" loading={saving} onClick={handleSave}>保存</Button>
          {config.hasCpu && (
            <>
              <Button size="small" onClick={() => {
                const p: Record<string, number> = {};
                if (config.hasCpu) p.cpu_threshold = 80;
                if (config.hasMemory) p.memory_threshold = 80;
                if (config.hasDisk) p.disk_threshold = 80;
                form.setFieldsValue(p);
              }}>80%</Button>
              <Button size="small" onClick={() => {
                const p: Record<string, number> = {};
                if (config.hasCpu) p.cpu_threshold = 90;
                if (config.hasMemory) p.memory_threshold = 90;
                if (config.hasDisk) p.disk_threshold = 90;
                form.setFieldsValue(p);
              }}>90%</Button>
            </>
          )}
        </Space>
      </Form>
    </Card>
  );
}

export default function Thresholds() {
  const [thresholds, setThresholds] = useState<AlertThreshold[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchThresholds = async () => {
    setLoading(true);
    try {
      const data = await getThresholds();
      setThresholds(data);
    } catch { message.error('获取失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchThresholds();
  }, []);

  const handleSave = async (id: number, values: { cpu_threshold?: number; memory_threshold?: number; disk_threshold?: number }) => {
    await updateThreshold(id, values);
    fetchThresholds();
  };

  // 按指定顺序排列
  const sortedThresholds = [...thresholds].sort((a, b) => {
    const aIdx = CARD_ORDER.indexOf(a.resource_type || 'global');
    const bIdx = CARD_ORDER.indexOf(b.resource_type || 'global');
    return aIdx - bIdx;
  });

  return (
    <Spin spinning={loading}>
    <div>
      <Breadcrumb items={[{ title: '配置中心' }, { title: '告警阈值' }]} style={{ marginBottom: 16 }} />
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>告警阈值设置</h1>
        <p style={{ color: 'var(--ant-color-text-secondary)', margin: '8px 0 0 0' }}>
          各资源类型独立配置告警阈值，未配置的指标使用系统默认值 90%。
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
        {sortedThresholds.map(t => (
          <ThresholdCard key={t.id} threshold={t} onSave={handleSave} />
        ))}
      </div>
    </div>
    </Spin>
  );
}
