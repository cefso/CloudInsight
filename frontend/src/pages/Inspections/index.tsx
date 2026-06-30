import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, message } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getInspectionTasks } from '../../api/inspections';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';

export default function Inspections() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await getInspectionTasks(page, 20);
      setTasks(data.items || []);
      setTotal(data.total || 0);
    } catch { message.error('获取失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, [page]);

  const columns = [
    {
      title: '批次ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: number) => <Tag color="blue">#{id}</Tag>,
    },
    {
      title: '触发方式',
      dataIndex: 'trigger_type',
      key: 'trigger_type',
      render: (type: string) => <Tag>{type === 'manual' ? '手动' : '定时'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <StatusTag status={status} />,
    },
    {
      title: '资源总数',
      dataIndex: 'total_resources',
      key: 'total',
      render: (v: number) => <strong>{v}</strong>,
    },
    {
      title: '正常',
      dataIndex: 'normal_count',
      key: 'normal',
      render: (v: number) => <span style={{ color: '#16a34a' }}>{v}</span>,
    },
    {
      title: '异常',
      dataIndex: 'abnormal_count',
      key: 'abnormal',
      render: (v: number) => <span style={{ color: v > 0 ? '#dc2626' : '#16a34a' }}>{v}</span>,
    },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      key: 'started_at',
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '完成时间',
      dataIndex: 'completed_at',
      key: 'completed_at',
      render: (t: string) => t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/inspections/${record.id}`)}>
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ title: '巡检中心' }, { title: '巡检记录' }]}
        title="巡检记录"
      />
      <Card>
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: 20,
            total,
            onChange: (p) => setPage(p),
          }}
        />
      </Card>
    </div>
  );
}
