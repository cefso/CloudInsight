import { useState, useEffect } from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardOutlined, CloudServerOutlined, AlertOutlined, SettingOutlined, ClockCircleOutlined } from '@ant-design/icons';

const { Sider } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '巡检总览' },
  { key: '/accounts', icon: <CloudServerOutlined />, label: '云账号管理' },
  { key: '/inspections', icon: <AlertOutlined />, label: '巡检结果' },
  {
    key: 'settings',
    icon: <SettingOutlined />,
    label: '配置中心',
    children: [
      { key: '/thresholds', label: '告警阈值' },
      { key: '/cron', label: '定时任务' },
      { key: '/settings/ai', label: 'AI 设置' },
    ],
  },
];

function findSelectedKey(pathname: string): string {
  for (const item of menuItems) {
    if ('children' in item && item.children) {
      for (const child of item.children) {
        if (child.key !== '/' && pathname.startsWith(child.key)) return child.key;
      }
    } else if (item.key !== '/' && pathname.startsWith(item.key)) return item.key;
  }
  return '/';
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedKey = findSelectedKey(location.pathname);
  const parentKeys = menuItems
    .filter(item => 'children' in item && item.children?.some(c => c.key === selectedKey))
    .map(item => item.key);
  const [openKeys, setOpenKeys] = useState<string[]>(parentKeys);
  useEffect(() => {
    setOpenKeys(keys => [...new Set([...keys, ...parentKeys])]);
  }, [selectedKey]);
  return (
    <Sider width={220} style={{ background: 'var(--ant-color-bg-container)', borderRight: '1px solid var(--ant-color-border)' }}>
      <Menu mode="inline" selectedKeys={[selectedKey]} openKeys={openKeys} onOpenChange={setOpenKeys} items={menuItems} onClick={({ key }) => navigate(key)} style={{ height: '100%', borderRight: 0 }} />
    </Sider>
  );
}
