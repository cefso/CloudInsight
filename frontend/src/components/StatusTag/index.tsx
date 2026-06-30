import { Tag } from 'antd';
import { CheckCircleOutlined, WarningOutlined, CloseCircleOutlined } from '@ant-design/icons';

type StatusType = 'normal' | 'warning' | 'abnormal' | 'completed' | 'failed' | 'running';

interface StatusTagProps {
  status: StatusType | string;
  showIcon?: boolean;
}

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  normal: { color: 'success', label: '正常', icon: <CheckCircleOutlined /> },
  warning: { color: 'warning', label: '警告', icon: <WarningOutlined /> },
  abnormal: { color: 'error', label: '异常', icon: <CloseCircleOutlined /> },
  completed: { color: 'success', label: '已完成', icon: <CheckCircleOutlined /> },
  failed: { color: 'error', label: '失败', icon: <CloseCircleOutlined /> },
  running: { color: 'processing', label: '进行中', icon: undefined },
};

export default function StatusTag({ status, showIcon = true }: StatusTagProps) {
  const config = STATUS_CONFIG[status] || { color: 'default', label: status, icon: undefined };

  return (
    <Tag color={config.color} icon={showIcon ? config.icon : undefined}>
      {config.label}
    </Tag>
  );
}
