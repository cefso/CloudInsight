import { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, message } from 'antd';
import { createAccount, updateAccount } from '../../api/accounts';
import type { CloudAccount } from '../../types';

const REGION_OPTIONS = [
  { label: '华东1（杭州）', value: 'cn-hangzhou' },
  { label: '华东2（上海）', value: 'cn-shanghai' },
  { label: '华北2（北京）', value: 'cn-beijing' },
  { label: '华南1（深圳）', value: 'cn-shenzhen' },
  { label: '中国香港', value: 'cn-hongkong' },
];

const RESOURCE_TYPE_OPTIONS = [
  { label: 'ECS（云服务器）', value: 'acs_ecs_dashboard' },
  { label: 'RDS（数据库）', value: 'acs_rds_dashboard' },
  { label: 'SLB（负载均衡）', value: 'slb' },
];

interface AccountFormProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialValues?: CloudAccount | null;
}

export default function AccountForm({ visible, onClose, onSuccess, initialValues }: AccountFormProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const isEdit = !!initialValues?.id;

  // 当 initialValues 变化时，设置表单值
  useEffect(() => {
    if (visible && initialValues) {
      form.setFieldsValue(initialValues);
    } else if (visible) {
      form.resetFields();
    }
  }, [visible, initialValues, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      if (isEdit) {
        await updateAccount(initialValues.id, values);
        message.success('更新成功');
      } else {
        await createAccount(values);
        message.success('创建成功');
      }
      form.resetFields();
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg) message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={isEdit ? '编辑账号' : '添加账号'}
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={loading}
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="账号名称" rules={[{ required: true }]}>
          <Input placeholder="如：生产环境" />
        </Form.Item>
        <Form.Item name="access_key_id" label="Access Key ID" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="access_key_secret" label="Access Key Secret" rules={[{ required: !isEdit }]}>
          <Input.Password placeholder={isEdit ? '留空则不修改' : ''} />
        </Form.Item>
        <Form.Item name="regions" label="监控地域">
          <Select mode="multiple" options={REGION_OPTIONS} />
        </Form.Item>
        <Form.Item name="resource_types" label="资源类型">
          <Select mode="multiple" options={RESOURCE_TYPE_OPTIONS} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
