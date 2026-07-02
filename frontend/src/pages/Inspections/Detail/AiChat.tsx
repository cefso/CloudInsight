import { useState, useEffect, useRef } from 'react';
import { Drawer, Input, Button, message, Spin, Typography, Space, Popconfirm } from 'antd';
import { SendOutlined, DeleteOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chatWithAi, getAiConversations, clearAiConversations } from '../../../api/ai';
import type { AiMessage, AiStreamEvent } from '../../../types';

const { Text } = Typography;

/** 过滤掉 <think>...</think> 标签及其内容 */
function filterThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

interface Props {
  taskId: number;
  open: boolean;
  onClose: () => void;
}

export default function AiChat({ taskId, open, onClose }: Props) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      loadHistory();
    }
  }, [open, taskId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming]);

  const loadHistory = async () => {
    try {
      const data = await getAiConversations(taskId);
      setMessages(data);
    } catch {
      // 静默失败
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    setStreaming('');

    const newUserMessage: AiMessage = {
      id: Date.now(),
      task_id: taskId,
      role: 'user',
      content: userMessage,
      tool_calls: null,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, newUserMessage]);

    chatWithAi(
      taskId,
      userMessage,
      (event: AiStreamEvent) => {
        if (event.type === 'token' && event.content) {
          setStreaming(prev => prev + event.content);
        } else if (event.type === 'done') {
          setLoading(false);
          setStreaming('');
          loadHistory();
        } else if (event.type === 'error') {
          setLoading(false);
          setStreaming('');
          message.error(event.content || '对话失败');
        }
      },
      (error) => {
        setLoading(false);
        setStreaming('');
        message.error(error);
      }
    );
  };

  const handleClear = async () => {
    try {
      await clearAiConversations(taskId);
      setMessages([]);
      message.success('对话历史已清空');
    } catch {
      message.error('清空失败');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <RobotOutlined style={{ color: '#1890ff' }} />
            <span>AI 助手</span>
          </Space>
          <Popconfirm
            title="确定要清空对话历史吗？"
            onConfirm={handleClear}
            okText="确定"
            cancelText="取消"
          >
            <Button size="small" icon={<DeleteOutlined />} danger>
              清空
            </Button>
          </Popconfirm>
        </div>
      }
      placement="right"
      width={420}
      open={open}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <Input.TextArea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题..."
            autoSize={{ minRows: 1, maxRows: 3 }}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
          >
            发送
          </Button>
        </div>
      }
    >
      <div style={{ height: '100%', overflow: 'auto', padding: '0 0 16px 0' }}>
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
            <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <p>你好！我是 AI 巡检助手</p>
            <p style={{ fontSize: 12 }}>你可以问我关于巡检结果的问题</p>
            <div style={{ marginTop: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>示例问题：</Text>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  '哪些 ECS 需要扩容？',
                  'RDS 为什么磁盘告警？',
                  '整体健康状况如何？',
                  '有什么优化建议？',
                ].map((q, i) => (
                  <Button
                    key={i}
                    size="small"
                    block
                    onClick={() => setInput(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <div
            key={msg.id || index}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 16,
              padding: '0 12px',
            }}
          >
            {msg.role === 'user' ? (
              <div style={{
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: 12,
                background: '#1890ff',
                color: '#fff',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                wordBreak: 'break-word',
              }}>
                <UserOutlined style={{ marginTop: 2 }} />
                <span>{msg.content}</span>
              </div>
            ) : (
              <div style={{
                maxWidth: '90%',
                padding: '12px 16px',
                borderRadius: 12,
                background: '#f5f5f5',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}>
                <RobotOutlined style={{ color: '#1890ff', marginTop: 4 }} />
                <div style={{
                  flex: 1,
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                }}>
                  <div className="ai-chat-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {filterThinkTags(msg.content || '')}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {streaming && filterThinkTags(streaming) && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16, padding: '0 12px' }}>
            <div style={{
              maxWidth: '90%',
              padding: '12px 16px',
              borderRadius: 12,
              background: '#f5f5f5',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}>
              <RobotOutlined style={{ color: '#1890ff', marginTop: 4 }} />
              <div style={{
                flex: 1,
                overflow: 'hidden',
                wordBreak: 'break-word',
              }}>
                <div className="ai-chat-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {filterThinkTags(streaming)}
                  </ReactMarkdown>
                </div>
                <Spin size="small" style={{ marginTop: 8 }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </Drawer>
  );
}
