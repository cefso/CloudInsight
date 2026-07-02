import { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Button, message, Spin, Space, InputNumber, Switch, Breadcrumb } from 'antd';
import { SaveOutlined, ApiOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { getAiConfig, updateAiConfig, testAiConnection } from '../../api/ai';

const PROVIDERS = [
  { value: 'dashscope', label: '阿里云百炼 (通义千问)', defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { value: 'openai', label: 'OpenAI', defaultUrl: 'https://api.openai.com/v1' },
  { value: 'ollama', label: 'Ollama (本地)', defaultUrl: 'http://localhost:11434/v1' },
  { value: 'custom', label: '自定义', defaultUrl: '' },
];

export default function AiConfigPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const config = await getAiConfig();
      if (config) {
        form.setFieldsValue(config);
      }
    } catch {
      message.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await updateAiConfig(values);
      message.success('配置已保存');
      loadConfig();
    } catch (e: any) {
      if (e.message) message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testAiConnection();
      setTestResult(result);
      if (result.success) {
        message.success(result.message);
      } else {
        message.error(result.message);
      }
    } catch {
      setTestResult({ success: false, message: '测试失败' });
    } finally {
      setTesting(false);
    }
  };

  const handleProviderChange = (provider: string) => {
    const p = PROVIDERS.find(p => p.value === provider);
    if (p) {
      form.setFieldValue('base_url', p.defaultUrl);
    }
  };

  return (
    <Spin spinning={loading}>
      <div>
        <Breadcrumb items={[{ title: '配置中心' }, { title: 'AI 设置' }]} style={{ marginBottom: 16 }} />
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>AI 设置</h1>
          <p style={{ color: 'var(--ant-color-text-secondary)', margin: '8px 0 0 0' }}>
            配置 AI 服务，用于巡检结果分析和智能问答。
          </p>
        </div>

        <Card
          style={{ maxWidth: 600 }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ApiOutlined style={{ color: '#1890ff' }} />
              <span>AI 服务配置</span>
            </div>
          }
        >
          <Form form={form} layout="vertical">
            <Form.Item
              name="provider"
              label="服务提供商"
              rules={[{ required: true }]}
            >
              <Select
                options={PROVIDERS}
                onChange={handleProviderChange}
              />
            </Form.Item>

            <Form.Item
              name="base_url"
              label="API 地址"
              rules={[{ required: true }]}
            >
              <Input placeholder="https://api.example.com/v1" />
            </Form.Item>

            <Form.Item
              name="api_key"
              label="API Key"
              extra="API Key 将加密存储"
            >
              <Input.Password placeholder="sk-..." />
            </Form.Item>

            <Form.Item
              name="model"
              label="模型名称"
              rules={[{ required: true }]}
            >
              <Input placeholder="qwen-plus" />
            </Form.Item>

            <Form.Item
              name="max_tokens"
              label="最大输出 Token"
            >
              <InputNumber min={256} max={32768} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="enabled"
              label="启用 AI 功能"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={handleSave}
                >
                  保存
                </Button>
                <Button
                  icon={<ApiOutlined />}
                  loading={testing}
                  onClick={handleTest}
                >
                  测试连接
                </Button>
              </Space>
            </Form.Item>

            {testResult && (
              <div style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: testResult.success ? '#f6ffed' : '#fff2f0',
                border: `1px solid ${testResult.success ? '#b7eb8f' : '#ffccc7'}`,
              }}>
                {testResult.success ? (
                  <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                ) : (
                  <CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                )}
                {testResult.message}
              </div>
            )}
          </Form>
        </Card>
      </div>
    </Spin>
  );
}
