import { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, message } from 'antd';
import { createCustomer, updateCustomer } from '../../api/customers';
import { getAccounts } from '../../api/accounts';
import type { Customer, CloudAccount } from '../../types';

interface CustomerFormProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialValues?: Customer | null;
}

export default function CustomerForm({ visible, onClose, onSuccess, initialValues }: CustomerFormProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const isEdit = !!initialValues?.id;

  useEffect(() => {
    if (!visible) return;
    getAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, [visible]);

  useEffect(() => {
    if (visible && initialValues) {
      form.setFieldsValue({
        ...initialValues,
        account_ids: accounts
          .filter((a) => a.customer_id === initialValues.id)
          .map((a) => a.id),
      });
    } else if (visible) {
      form.resetFields();
    }
    // 仅在打开/切换目标时重置；accounts 到达后回填已勾选账号
  }, [visible, initialValues, form]);

  useEffect(() => {
    if (visible && initialValues && accounts.length > 0) {
      form.setFieldValue(
        'account_ids',
        accounts.filter((a) => a.customer_id === initialValues.id).map((a) => a.id),
      );
    }
  }, [visible, initialValues, accounts, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const payload = {
        name: values.name,
        contact: values.contact,
        phone: values.phone,
        remark: values.remark,
        account_ids: values.account_ids ?? [],
      };
      if (isEdit) {
        await updateCustomer(initialValues.id, payload);
        message.success('更新成功');
      } else {
        await createCustomer(payload);
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
      width={560}
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
        <Form.Item
          name="account_ids"
          label="云账号"
          tooltip="选择该客户拥有的云账号；取消勾选会解除归属。多个客户可各自勾选不同账号"
        >
          <Select
            mode="multiple"
            allowClear
            placeholder="选择归属该客户的云账号"
            options={accounts.map((a) => ({
              label: a.customer_name && a.customer_id !== initialValues?.id
                ? `${a.name}（当前属于：${a.customer_name}）`
                : a.name,
              value: a.id,
            }))}
          />
        </Form.Item>
        <Form.Item name="remark" label="备注">
          <Input.TextArea rows={3} placeholder="可选" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
