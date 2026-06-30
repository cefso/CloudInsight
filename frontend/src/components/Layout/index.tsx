import { Outlet } from 'react-router-dom';
import { Layout as AntLayout } from 'antd';

const { Content } = AntLayout;

export default function Layout() {
  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Content style={{ padding: '24px' }}>
        <Outlet />
      </Content>
    </AntLayout>
  );
}
