// 云账号
export interface CloudAccount {
  id: number;
  name: string;
  access_key_id: string;
  regions: string[] | null;
  resource_types: string[] | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// 巡检任务
export interface InspectionTask {
  id: number;
  trigger_type: 'manual' | 'cron';
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at: string | null;
  total_resources: number;
  normal_count: number;
  warning_count: number;
  abnormal_count: number;
  error_message: string | null;
}

// 巡检结果
export interface InspectionResult {
  id: number;
  task_id: number;
  account_id: number;
  resource_type: string;
  resource_id: string;
  resource_name: string;
  region: string;
  cpu_usage: number | null;
  memory_usage: number | null;
  disk_usage: number | null;
  disk_details: DiskDetail[] | null;
  slb_details: SlbDetails | null;
  expiration_details: Record<string, unknown> | null;
  event_details: Record<string, unknown> | null;
  status: 'normal' | 'warning' | 'abnormal';
  abnormal_metrics: string[] | null;
  inspected_at: string;
}

// SLB 监听器
export interface SlbListener {
  port: number;
  protocol: string;
  status: 'running' | 'stopped' | string;
  description: string;
}

// SLB 后端服务器
export interface SlbBackendServer {
  serverIp: string;
  port: number;
  protocol: string;
  status: 'normal' | 'unavailable' | 'abnormal';
}

// SLB 详情
export interface SlbDetails {
  listeners: SlbListener[];
  backend_servers: SlbBackendServer[];
}

// 磁盘详情
export interface DiskDetail {
  device: string;
  usage: number;
}

// 告警阈值
export interface AlertThreshold {
  id: number;
  resource_type: string;
  name: string;
  cpu_threshold: number | null;
  memory_threshold: number | null;
  disk_threshold: number | null;
  is_default: boolean;
  created_at: string;
}

// 定时任务配置
export interface CronConfig {
  id: number;
  name: string;
  cron_expression: string;
  account_ids: number[];
  account_names: string[];
  is_enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

// 仪表盘统计
export interface DashboardStats {
  total_resources: number;
  normal_count: number;
  warning_count: number;
  abnormal_count: number;
  account_count: number;
  last_inspection_time: string | null;
  next_inspection_time: string | null;
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// 巡检任务（含账号名称）
export interface InspectionTaskWithAccounts extends InspectionTask {
  account_names: string[];
}

// 资源类型统计
export interface ResourceTypeStats {
  total: number;
  abnormal: number;
  warning: number;
  normal: number;
}

// ========== AI 相关类型 ==========

export interface AiConfig {
  id: number;
  provider: 'dashscope' | 'openai' | 'ollama' | 'custom';
  base_url: string;
  api_key: string | null;
  model: string;
  max_tokens: number;
  enabled: boolean;
}

export interface AiReport {
  id: number;
  task_id: number;
  content: string;
  model: string | null;
  tokens_used: number | null;
  created_at: string;
}

export interface AiMessage {
  id: number;
  task_id: number;
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls: Record<string, unknown> | null;
  created_at: string;
}

export interface AiStreamEvent {
  type: 'token' | 'tool_call' | 'tool_result' | 'done' | 'error';
  content?: string;
  id?: string;
  name?: string;
  arguments?: string;
  data?: Record<string, unknown>;
  report_id?: number;
}

