import { useEffect, useState } from 'react';
import { Card, Form, InputNumber, Button, message, Breadcrumb, Space } from 'antd';
import { getThresholds, updateThreshold } from '../../api/inspections';
import { CloudServerOutlined, DatabaseOutlined, SaveOutlined, SettingOutlined } from '@ant-design/icons';
import type { AlertThreshold } from '../../types';

const RESOURCE_CONFIG: Record<string, { label: string; icon: any; color: string; hasCpu: boolean; hasMemory: boolean; hasDisk: boolean }> = {
  global: { label: '通用默认', icon: <SettingOutlined />, color: '#6b7280', hasCpu: true, hasMemory: true, hasDisk: true },
  ECS: { label: 'ECS 云服务器', icon: <CloudServerOutlined />, color: '#3b82f6', hasCpu: true, hasMemory: true, hasDisk: true },
  RDS: { label: 'RDS 数据库', icon: <DatabaseOutlined />, color: '#8b5cf6', hasCpu: true, hasMemory: true, hasDisk: true },
  Redis: { label: 'Redis 缓存', icon: <SaveOutlined />, color: '#dc2626', hasCpu: false, hasMemory: true, hasDisk: false },
};

function ThresholdCard({ threshold, onSave }: { threshold: AlertThreshold; onSave: (id: number, values: any) => Promise<void> }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const config = RESOURCE_CONFIG[threshold.resource_type || 'global'] || RESOURCE_CONFIG.global;

  useEffect(() => {
    form.setFieldsValue(threshold);
  }, [threshold, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await onSave(threshold.id, values);
      message.success(`${config.label} 阈值已保存`);
    } catch (e: any) {
      if (e.message) message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      style={{ borderTop: `3px solid ${config.color}` }}
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

        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
          <div>警告: ≥ 阈值-10% ｜ 异常: ≥ 阈值</div>
        </div>

        <Space>
          <Button type="primary" size="small" loading={saving} onClick={handleSave}>保存</Button>
          {config.hasCpu && (
            <>
              <Button size="small" onClick={() => {
                const p: any = {};
                if (config.hasCpu) p.cpu_threshold = 80;
                if (config.hasMemory) p.memory_threshold = 80;
                if (config.hasDisk) p.disk_threshold = 80;
                form.setFieldsValue(p);
              }}>80%</Button>
              <Button size="small" onClick={() => {
                const p: any = {};
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
  const [, setLoading] = useState(false);

  const fetchThresholds = async () => {
    setLoading(true);
    try {
      const data = await getThresholds();
      setThresholds(data);
    } catch { message.error('获取失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchThresholds(); }, []);

  const handleSave = async (id: number, values: any) => {
    await updateThreshold(id, values);
    fetchThresholds();
  };

  return (
    <div>
      <Breadcrumb items={[{ title: '配置中心' }, { title: '告警阈值' }]} style={{ marginBottom: 16 }} />
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>告警阈值设置</h1>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        {thresholds.map(t => (
          <div key={t.id} style={{ width: 320 }}>
            <ThresholdCard threshold={t} onSave={handleSave} />
          </div>
        ))}
      </div>
    </div>
  );
}
