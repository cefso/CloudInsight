import { useEffect, useState } from 'react';
import { Card, Form, InputNumber, Button, message, Breadcrumb, Space, Tabs } from 'antd';
import { getThresholds, updateThreshold } from '../../api/inspections';
import { CloudServerOutlined, DatabaseOutlined, SaveOutlined } from '@ant-design/icons';
import type { AlertThreshold } from '../../types';

const RESOURCE_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; hasCpu: boolean; hasMemory: boolean; hasDisk: boolean }> = {
  global: { label: '通用默认', icon: <CloudServerOutlined />, color: '#6b7280', hasCpu: true, hasMemory: true, hasDisk: true },
  ECS: { label: 'ECS 云服务器', icon: <CloudServerOutlined />, color: '#3b82f6', hasCpu: true, hasMemory: true, hasDisk: true },
  RDS: { label: 'RDS 数据库', icon: <DatabaseOutlined />, color: '#8b5cf6', hasCpu: true, hasMemory: true, hasDisk: true },
  Redis: { label: 'Redis 缓存', icon: <SaveOutlined />, color: '#dc2626', hasCpu: false, hasMemory: true, hasDisk: false },
};

export default function Thresholds() {
  const [thresholds, setThresholds] = useState<AlertThreshold[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('global');
  const [form] = Form.useForm();

  const fetchThresholds = async () => {
    setLoading(true);
    try {
      const data = await getThresholds();
      setThresholds(data);
      // 默认选中第一个
      if (data.length > 0) {
        setActiveTab(data[0].resource_type || 'global');
        form.setFieldsValue(data[0]);
      }
    } catch { message.error('获取失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchThresholds(); }, []);

  useEffect(() => {
    const current = thresholds.find(t => (t.resource_type || 'global') === activeTab);
    if (current) form.setFieldsValue(current);
  }, [activeTab, thresholds, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const current = thresholds.find(t => (t.resource_type || 'global') === activeTab);
      if (current) {
        await updateThreshold(current.id, values);
        message.success('保存成功');
        fetchThresholds();
      }
    } catch { message.error('保存失败'); }
  };

  const config = RESOURCE_TYPE_CONFIG[activeTab] || RESOURCE_TYPE_CONFIG.global;

  return (
    <div>
      <Breadcrumb items={[{ title: '配置中心' }, { title: '告警阈值' }]} style={{ marginBottom: 16 }} />
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>告警阈值设置</h1>

      <Card loading={loading}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
          items={thresholds.map(t => ({
            key: t.resource_type || 'global',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {RESOURCE_TYPE_CONFIG[t.resource_type || 'global']?.icon}
                {t.name}
              </span>
            ),
          }))}
        />

        <div style={{ maxWidth: 500, marginTop: 16 }}>
          <Form form={form} layout="vertical">
            {config.hasCpu && (
              <Form.Item name="cpu_threshold" label="CPU 使用率阈值" rules={[{ required: true }]}>
                <InputNumber min={0} max={100} addonAfter="%" style={{ width: '100%' }} />
              </Form.Item>
            )}
            {config.hasMemory && (
              <Form.Item name="memory_threshold" label="内存使用率阈值" rules={[{ required: true }]}>
                <InputNumber min={0} max={100} addonAfter="%" style={{ width: '100%' }} />
              </Form.Item>
            )}
            {config.hasDisk && (
              <Form.Item name="disk_threshold" label="磁盘使用率阈值" rules={[{ required: true }]}>
                <InputNumber min={0} max={100} addonAfter="%" style={{ width: '100%' }} />
              </Form.Item>
            )}

            <div style={{ 
              background: '#f8fafc', 
              padding: 16, 
              borderRadius: 8, 
              marginBottom: 16,
              fontSize: 13,
              color: '#64748b'
            }}>
              <div style={{ marginBottom: 8, fontWeight: 600, color: '#374151' }}>告警规则</div>
              <div>• <span style={{ color: '#f59e0b' }}>警告</span>：使用率 ≥ 阈值 - 10%</div>
              <div>• <span style={{ color: '#ef4444' }}>异常</span>：使用率 ≥ 阈值</div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>
                例：阈值 90% → 80%-90% 警告，≥90% 异常
              </div>
            </div>

            <Form.Item>
              <Space>
                <Button type="primary" onClick={handleSave}>保存配置</Button>
                <Button onClick={() => {
                  const preset: any = {};
                  if (config.hasCpu) preset.cpu_threshold = 80;
                  if (config.hasMemory) preset.memory_threshold = 80;
                  if (config.hasDisk) preset.disk_threshold = 80;
                  form.setFieldsValue(preset);
                }}>80%</Button>
                <Button onClick={() => {
                  const preset: any = {};
                  if (config.hasCpu) preset.cpu_threshold = 90;
                  if (config.hasMemory) preset.memory_threshold = 90;
                  if (config.hasDisk) preset.disk_threshold = 90;
                  form.setFieldsValue(preset);
                }}>90%</Button>
                <Button onClick={() => {
                  const preset: any = {};
                  if (config.hasCpu) preset.cpu_threshold = 95;
                  if (config.hasMemory) preset.memory_threshold = 95;
                  if (config.hasDisk) preset.disk_threshold = 95;
                  form.setFieldsValue(preset);
                }}>95%</Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      </Card>
    </div>
  );
}
