import api from './index';
import type { AiConfig, AiReport, AiMessage, AiStreamEvent } from '../types';

// ========== AI 配置 ==========

export async function getAiConfig(): Promise<AiConfig | null> {
  return await api.get('/ai/config');
}

export async function updateAiConfig(data: Partial<AiConfig>): Promise<AiConfig> {
  return await api.put('/ai/config', data);
}

export async function testAiConnection(): Promise<{ success: boolean; message: string }> {
  return await api.post('/ai/config/test');
}

// ========== AI 分析报告 ==========

export async function getAiReports(taskId?: number): Promise<AiReport[]> {
  return await api.get('/ai/reports', { params: { task_id: taskId } });
}

export async function getAiReport(reportId: number): Promise<AiReport> {
  return await api.get(`/ai/reports/${reportId}`);
}

// ========== AI 对话 ==========

export async function getAiConversations(taskId: number): Promise<AiMessage[]> {
  return await api.get(`/ai/conversations/${taskId}`);
}

export async function clearAiConversations(taskId: number): Promise<void> {
  await api.delete(`/ai/conversations/${taskId}`);
}

// ========== SSE 流式调用 ==========

export function analyzeInspection(
  taskId: number,
  focus: string | null,
  onEvent: (event: AiStreamEvent) => void,
  onError: (error: string) => void
): () => void {
  const params = new URLSearchParams({ task_id: taskId.toString() });
  if (focus) params.append('focus', focus);

  const eventSource = new EventSource(`/api/ai/analyze?${params}`);

  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      onEvent(data);
      if (data.type === 'done' || data.type === 'error') {
        eventSource.close();
      }
    } catch (err) {
      onError('解析响应失败');
      eventSource.close();
    }
  };

  eventSource.onerror = () => {
    onError('连接失败');
    eventSource.close();
  };

  return () => eventSource.close();
}

export function chatWithAi(
  taskId: number,
  message: string,
  onEvent: (event: AiStreamEvent) => void,
  onError: (error: string) => void
): () => void {
  const controller = new AbortController();

  fetch(`/api/ai/chat?task_id=${taskId}&message=${encodeURIComponent(message)}`, {
    method: 'POST',
    signal: controller.signal,
  }).then(async (response) => {
    if (!response.ok) {
      onError('连接失败');
      return;
    }
    const reader = response.body?.getReader();
    if (!reader) { onError('连接失败'); return; }
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onEvent(data);
              if (data.type === 'done' || data.type === 'error') {
                controller.abort();
                return;
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) onError('连接中断');
    }
  }).catch((err) => {
    if (!controller.signal.aborted) onError('连接失败');
  });

  return () => controller.abort();
}
