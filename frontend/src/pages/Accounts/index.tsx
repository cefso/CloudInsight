import { useEffect, useState } from 'react';
import { Card, Table, Button, Tag, Space, message, Popconfirm, Breadcrumb } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ApiOutlined } from '@ant-design/icons';
import { getAccounts, deleteAccount, testConnection } from '../../api/accounts';
import type { CloudAccount } from '../../api/accounts';
import AccountForm from './Form';

export default function Accounts() {
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      setAccounts(await getAccounts());
    } catch {
      message.error('获取失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const handleDelete = async (id: number) => {
    try {
      await deleteAccount(id);
      message.success('删除成功');
      fetchAccounts();
    } catch {
      message.error('删除失败');
    }
  };

  const handleTest = async (id: number) => {
    try {
      const r = await testConnection(id);
      r.success ? message.success('连接成功') : message.error(r.message);
    } catch {
      message.error('测试失败');
    }
  };

  const columns = [
    {
      title: '账号名称',
      dataIndex: 'name',
      key: 'name',
      render: (n: string) => <strong>{n}</strong>,
    },
    {
      title: 'AK',
      dataIndex: 'access_key_id',
      key: 'ak',
      render: (ak: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{ak}</span>,
    },
    {
      title: '地域',
      dataIndex: 'regions',
      key: 'regions',
      render: (rs: string[] | null) =>
        rs ? (
          <Space size={4} wrap>
            {rs.slice(0, 3).map((r) => <Tag key={r}>{r}</Tag>)}
            {rs.length > 3 && <Tag>+{rs.length - 3}</Tag>}
          </Space>
        ) : (
          <Tag>默认</Tag>
        ),
    },
    {
      title: '资源类型',
      dataIndex: 'resource_types',
      key: 'types',
      render: (ts: string[] | null) => {
        if (!ts) return <Tag>全部</Tag>;
        const nameMap: Record<string, string> = {
          acs_ecs_dashboard: 'ECS',
          acs_rds_dashboard: 'RDS',
          slb: 'SLB',
        };
        return (
          <Space size={4} wrap>
            {ts.map((t) => (
              <Tag color="blue" key={t}>{nameMap[t] || t}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'is_enabled',
      key: 'enabled',
      render: (e: boolean) => (
        <Tag color={e ? 'success' : 'default'}>{e ? '已启用' : '已禁用'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, r: CloudAccount) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => { setEditingAccount(r); setFormVisible(true); }}>
            编辑
          </Button>
          <Button type="link" icon={<ApiOutlined />} onClick={() => handleTest(r.id)}>
            测试
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb items={[{ title: '配置中心' }, { title: '云账号管理' }]} style={{ marginBottom: 16 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>云账号管理</h1>
          <p style={{ color: 'var(--ant-color-text-secondary)', margin: '4px 0 0 0' }}>
            管理阿里云账号凭证，支持多账号配置
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingAccount(null); setFormVisible(true); }}>
          添加账号
        </Button>
      </div>
      <Card>
        <Table columns={columns} dataSource={accounts} rowKey="id" loading={loading} />
      </Card>
      <AccountForm
        visible={formVisible}
        onClose={() => { setFormVisible(false); setEditingAccount(null); }}
        onSuccess={fetchAccounts}
        initialValues={editingAccount}
      />
    </div>
  );
}
