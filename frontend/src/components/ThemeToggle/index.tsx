import { Button } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useTheme } from '../../hooks/useTheme';

export default function ThemeToggle() {
  const { mode, toggleTheme } = useTheme();
  return <Button type="text" icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />} onClick={toggleTheme} style={{ fontSize: 18 }} />;
}
