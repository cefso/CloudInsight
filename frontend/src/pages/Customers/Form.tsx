import { useEffect, useState } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { createCustomer, updateCustomer } from '../../api/customers';
import type { Customer } from '../../types';

interface CustomerFormProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialValues?: Customer | null;
}

export default function CustomerForm({ visible, onClose, onSuccess, initialValues }: CustomerFormProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const isEdit = !!initialValues?.id;

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
        await updateCustomer(initialValues.id, values);
        message.success('更新成功');
      } else {
        await createCustomer(values);
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
      title={isEdit ? '编辑客户' : '添加客户'}
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={loading}
      width={520}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="客户名称" rules={[{ required: true, message: '请输入客户名称' }]}>
          <Input placeholder="如：某某科技有限公司" maxLength={100} />
        </Form.Item>
        <Form.Item name="contact" label="联系人">
          <Input placeholder="可选" maxLength={100} />
        </Form.Item>
        <Form.Item name="phone" label="电话">
          <Input placeholder="可选" maxLength={50} />
        </Form.Item>
        <Form.Item name="remark" label="备注">
          <Input.TextArea rows={3} placeholder="可选" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
