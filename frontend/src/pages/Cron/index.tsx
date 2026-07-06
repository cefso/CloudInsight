import { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Switch, message, Popconfirm, Select, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { getCronConfigs, createCronConfig, updateCronConfig, deleteCronConfig } from '../../api/inspections';
import { getAccounts } from '../../api/accounts';
import type { CronConfig, CloudAccount } from '../../types';
import PageHeader from '../../components/PageHeader';

export default function Cron() {
  const [configs, setConfigs] = useState<CronConfig[]>([]);
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchConfigs = async () => {
    setLoading(true);
    try { setConfigs(await getCronConfigs()); }
    catch { message.error('获取失败'); }
    finally { setLoading(false); }
  };

  const fetchAccounts = async () => {
    try { setAccounts(await getAccounts()); } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchConfigs();
    fetchAccounts();
  }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await createCronConfig(values);
      message.success('创建成功');
      form.resetFields();
      setModalVisible(false);
      fetchConfigs();
    } catch (e: unknown) { if (e instanceof Error && e.message) message.error(e.message); }
  };

  const handleToggle = async (id: number, enabled: boolean) => {
    try {
      await updateCronConfig(id, { is_enabled: enabled });
      message.success(enabled ? '已启用' : '已禁用');
      fetchConfigs();
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id: number) => {
    try { await deleteCronConfig(id); message.success('删除成功'); fetchConfigs(); }
    catch { message.error('删除失败'); }
  };

  const columns = [
    { title: '任务名称', dataIndex: 'name', key: 'name' },
    { title: 'Cron 表达式', dataIndex: 'cron_expression', key: 'cron', render: (e: string) => <code>{e}</code> },
    { title: '适用账号', dataIndex: 'account_names', key: 'accounts', render: (names: string[]) => {
      if (!names || names.length === 0) return <Tag>全部账号</Tag>;
      return <Space size={4} wrap>{names.map((n, i) => <Tag key={i}>{n}</Tag>)}</Space>;
    }},
    { title: '状态', dataIndex: 'is_enabled', key: 'enabled', render: (e: boolean, r: CronConfig) => <Switch checked={e} onChange={v => handleToggle(r.id, v)} /> },
    { title: '上次运行', dataIndex: 'last_run_at', key: 'last', render: (t: string) => t || '-' },
    { title: '下次运行', dataIndex: 'next_run_at', key: 'next', render: (t: string) => t || '-' },
    { title: '操作', key: 'action', render: (_: unknown, r: CronConfig) => <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}><Button type="link" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm> },
  ];

  return (
    <div>
      <PageHeader breadcrumbs={[{ title: '配置中心' }, { title: '定时任务' }]} title="定时任务管理" subtitle="配置自动巡检的定时任务" />
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>添加任务</Button>
        </div>
        <Table columns={columns} dataSource={configs} rowKey="id" loading={loading} />
      </Card>
      <Modal title="添加定时任务" open={modalVisible} onOk={handleCreate} onCancel={() => setModalVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="任务名称" rules={[{ required: true }]}><Input placeholder="如：每日巡检" /></Form.Item>
          <Form.Item name="cron_expression" label="Cron 表达式" rules={[{ required: true }]}><Input placeholder="如：0 8 * * * (每天8点)" /></Form.Item>
          <Form.Item name="account_ids" label="适用账号">
            <Select mode="multiple" placeholder="留空则巡检所有账号" allowClear
              options={accounts.map(a => ({ label: a.name, value: a.id }))} />
          </Form.Item>
        </Form>
        <p style={{ color: 'var(--ant-color-text-secondary)', fontSize: 12, marginTop: 8 }}>
          Cron 格式: 分 时 日 月 周。示例: 0 8 * * * (每天8点), 0 */2 * * * (每2小时)
        </p>
      </Modal>
    </div>
  );
}
