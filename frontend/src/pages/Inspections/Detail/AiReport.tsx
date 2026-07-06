import { useState, useEffect, useRef } from 'react';
import { Card, Button, Spin, message, Collapse, Tag } from 'antd';
import { RobotOutlined, ReloadOutlined, ClockCircleOutlined } from '@ant-design/icons';
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
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    loadReports();
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [taskId]);

  const loadReports = async () => {
    try {
      const data = await getAiReports(taskId);
      setReports(data);
      if (data.length > 0) {
        setCurrentReport(data[0]);
        setContent(data[0].content);
        setVisible(true);
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
    setVisible(true);

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
    return (
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<RobotOutlined />}
          loading={loading}
          onClick={handleAnalyze}
        >
          AI 分析
        </Button>
      </div>
    );
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
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={handleAnalyze}
        >
          {content ? '重新分析' : '生成分析'}
        </Button>
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
