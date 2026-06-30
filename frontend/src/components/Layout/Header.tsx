import { Layout, Space, Avatar, Input } from 'antd';
import { UserOutlined, SearchOutlined } from '@ant-design/icons';
import ThemeToggle from '../ThemeToggle';

const { Header: AntHeader } = Layout;

export default function Header() {
  return (
    <AntHeader style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: 'var(--ant-color-bg-container)', borderBottom: '1px solid var(--ant-color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>C</div>
        <span style={{ fontSize: 18, fontWeight: 700 }}>CloudInsight</span>
      </div>
      <Space size="middle">
        <Input placeholder="搜索资源..." prefix={<SearchOutlined />} style={{ width: 220 }} />
        <ThemeToggle />
        <Avatar icon={<UserOutlined />} />
      </Space>
    </AntHeader>
  );
}
