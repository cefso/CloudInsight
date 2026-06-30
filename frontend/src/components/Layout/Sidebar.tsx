import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardOutlined, CloudServerOutlined, AlertOutlined, SettingOutlined, ClockCircleOutlined } from '@ant-design/icons';

const { Sider } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '巡检总览' },
  { key: '/accounts', icon: <CloudServerOutlined />, label: '云账号管理' },
  { key: '/inspections', icon: <AlertOutlined />, label: '巡检结果' },
  { key: '/thresholds', icon: <SettingOutlined />, label: '告警阈值' },
  { key: '/cron', icon: <ClockCircleOutlined />, label: '定时任务' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <Sider width={220} style={{ background: 'var(--ant-color-bg-container)', borderRight: '1px solid var(--ant-color-border)' }}>
      <Menu mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => navigate(key)} style={{ height: '100%', borderRight: 0 }} />
    </Sider>
  );
}
