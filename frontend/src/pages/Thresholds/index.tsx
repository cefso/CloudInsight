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
      if (data.length > 0) form.setFieldsValue(data[0]);
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
          <Form.Item name="cpu_threshold" label="CPU 使用率阈值 (%)" rules={[{ required: true }]}><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="memory_threshold" label="内存使用率阈值 (%)" rules={[{ required: true }]}><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="disk_threshold" label="磁盘使用率阈值 (%)" rules={[{ required: true }]}><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item>
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
