import { useEffect, useState } from 'react';
import { Card, Table, Button, Tag, Space, message, Popconfirm, Breadcrumb, Input } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import { getCustomers, deleteCustomer } from '../../api/customers';
import type { Customer } from '../../types';
import CustomerForm from './Form';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      setCustomers(await getCustomers());
    } catch {
      message.error('获取失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await deleteCustomer(id);
      message.success('删除成功，云账号已保留');
      fetchCustomers();
    } catch {
      message.error('删除失败');
    }
  };

  const filtered = customers.filter(
    (c) =>
      !search ||
      c.name.includes(search) ||
      (c.contact || '').includes(search) ||
      (c.phone || '').includes(search),
  );

  const columns = [
    {
      title: '客户名称',
      dataIndex: 'name',
      key: 'name',
      render: (n: string) => <strong>{n}</strong>,
    },
    {
      title: '联系人',
      dataIndex: 'contact',
      key: 'contact',
      render: (v: string | null) => v || '-',
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      render: (v: string | null) => v || '-',
    },
    {
      title: '云账号',
      dataIndex: 'account_names',
      key: 'accounts',
      render: (names: string[]) => {
        if (!names || names.length === 0) return <Tag>暂无</Tag>;
        return (
          <Space size={4} wrap>
            {names.map((n) => (
              <Tag key={n}>{n}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '账号数',
      dataIndex: 'account_count',
      key: 'account_count',
      render: (v: number) => <strong>{v}</strong>,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      render: (v: string | null) => v || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, r: Customer) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingCustomer(r);
              setFormVisible(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm title="确定删除客户？云账号会保留并解除归属" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb items={[{ title: '配置中心' }, { title: '客户管理' }]} style={{ marginBottom: 16 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>客户管理</h1>
          <p style={{ color: 'var(--ant-color-text-secondary)', margin: '4px 0 0 0' }}>
            维护客户资料，多云账号可归属同一客户，便于按客户批量巡检
          </p>
        </div>
        <Space>
          <Input
            allowClear
            placeholder="搜索客户/联系人/电话"
            style={{ width: 220 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefix={<UserOutlined />}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingCustomer(null);
              setFormVisible(true);
            }}
          >
            添加客户
          </Button>
        </Space>
      </div>
      <Card>
        <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading} />
      </Card>
      <CustomerForm
        visible={formVisible}
        onClose={() => {
          setFormVisible(false);
          setEditingCustomer(null);
        }}
        onSuccess={fetchCustomers}
        initialValues={editingCustomer}
      />
    </div>
  );
}
