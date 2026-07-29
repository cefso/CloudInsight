import { useState, useEffect, useRef } from 'react';
import { Card, Button, Spin, message, Collapse, Tag, Tooltip } from 'antd';
import { RobotOutlined, ReloadOutlined, ClockCircleOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { analyzeInspection, getAiReports } from '../../../api/ai';
import type { AiReport as AiReportType, AiStreamEvent } from '../../../types';

/** 过滤掉 <think>...</think> 标签及其内容 */
function filterThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

interface Props {
  taskId: number;
}

export default function AiReport({ taskId }: Props) {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [reports, setReports] = useState<AiReportType[]>([]);
  const [currentReport, setCurrentReport] = useState<AiReportType | null>(null);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  /** Markdown 转 HTML（简单转换） */
  const markdownToHtml = (md: string): string => {
    let html = md
      // 标题
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // 粗体
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // 斜体
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // 行内代码
      .replace(/`(.+?)`/g, '<code>$1</code>')
      // 列表项
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // 换行
      .replace(/\n/g, '<br>');
    // 包裹连续的 <li> 为 <ul>
    html = html.replace(/(<li>.*?<\/li>)(<br>)?/g, '$1');
    html = html.replace(/((?:<li>.*?<\/li><br>?)+)/g, '<ul>$1</ul>');
    return html;
  };

  /** 复制为富文本 */
  const handleCopyRichText = async () => {
    const filteredContent = filterThinkTags(content);
    if (!filteredContent) return;

    try {
      const html = markdownToHtml(filteredContent);
      const blob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([filteredContent], { type: 'text/plain' });

      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blob,
          'text/plain': textBlob,
        }),
      ]);

      setCopied(true);
      message.success('已复制为富文本，可粘贴到 Word、邮件等');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error('复制失败，请重试');
    }
  };

  useEffect(() => {
    // 监听触发分析的事件
    const handleTrigger = () => {
      setVisible(true);
      // 延迟执行分析，确保状态已更新
      setTimeout(() => {
        handleAnalyze();
      }, 100);
    };
    window.addEventListener('trigger-ai-analyze', handleTrigger);

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      window.removeEventListener('trigger-ai-analyze', handleTrigger);
    };
  }, [taskId]);

  const loadReports = async () => {
    try {
      const data = await getAiReports(taskId);
      setReports(data);
      if (data.length > 0) {
        setCurrentReport(data[0]);
        setContent(data[0].content);
      }
    } catch {
      // 静默失败
    }
  };

  const handleAnalyze = () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setLoading(true);
    setContent('');

    cleanupRef.current = analyzeInspection(
      taskId,
      null,
      (event: AiStreamEvent) => {
        if (event.type === 'token' && event.content) {
          setContent(prev => prev + event.content);
        } else if (event.type === 'done') {
          setLoading(false);
          loadReports();
          message.success('分析完成');
        } else if (event.type === 'error') {
          setLoading(false);
          message.error(event.content || '分析失败');
        }
      },
      (error) => {
        setLoading(false);
        message.error(error);
      }
    );
  };

  if (!visible) {
    return null;
  }

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RobotOutlined style={{ color: 'var(--color-primary)' }} />
          <span>AI 分析报告</span>
          {currentReport && (
            <Tag color="blue" style={{ marginLeft: 8 }}>
              {currentReport.model}
            </Tag>
          )}
        </div>
      }
      extra={
        <div style={{ display: 'flex', gap: 8 }}>
          {content && (
            <Tooltip title="复制为富文本，可粘贴到 Word、邮件等">
              <Button
                icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                onClick={handleCopyRichText}
                type={copied ? 'primary' : 'default'}
              >
                {copied ? '已复制' : '复制'}
              </Button>
            </Tooltip>
          )}
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={handleAnalyze}
          >
            {content ? '重新分析' : '生成分析'}
          </Button>
        </div>
      }
      style={{ marginBottom: 16 }}
    >
      {loading && !content && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
          <p style={{ marginTop: 16, color: 'var(--ant-color-text-secondary)' }}>AI 正在分析巡检数据...</p>
        </div>
      )}

      {content && filterThinkTags(content) && (
        <div className="ai-report-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {filterThinkTags(content)}
          </ReactMarkdown>
          {loading && <Spin size="small" style={{ marginLeft: 8 }} />}
        </div>
      )}

      {!loading && !content && reports.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--ant-color-text-tertiary)' }}>
          <p>正在生成分析报告...</p>
        </div>
      )}

      {reports.length > 1 && (
        <Collapse
          size="small"
          style={{ marginTop: 16 }}
          items={[{
            key: 'history',
            label: `历史报告 (${reports.length})`,
            children: (
              <div>
                {reports.slice(1).map(report => (
                  <div
                    key={report.id}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderRadius: 4,
                      marginBottom: 4,
                      background: currentReport?.id === report.id ? 'var(--color-primary-bg)' : 'transparent',
                    }}
                    onClick={() => {
                      setCurrentReport(report);
                      setContent(report.content);
                    }}
                  >
                    <ClockCircleOutlined style={{ marginRight: 8 }} />
                    {new Date(report.created_at).toLocaleString()}
                    <Tag style={{ marginLeft: 8 }}>{report.model}</Tag>
                  </div>
                ))}
              </div>
            ),
          }]}
        />
      )}
    </Card>
  );
}
