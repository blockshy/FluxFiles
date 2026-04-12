import { SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Checkbox, Collapse, Input, Space, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import { getPermissionCombinationFeedback, getPermissionGroups, getPermissionLabels } from './permissionConfig';

interface PermissionSelectorProps {
  value?: string[];
  onChange?: (nextValue: string[]) => void;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function PermissionSelector({ value, onChange }: PermissionSelectorProps) {
  const { locale } = useI18n();
  const [keyword, setKeyword] = useState('');
  const selected = value ?? [];
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const normalizedKeyword = keyword.trim().toLowerCase();
  const permissionLabels = getPermissionLabels(locale);
  const permissionGroups = getPermissionGroups(locale);
  const feedback = getPermissionCombinationFeedback(locale, selected);

  const filteredGroups = useMemo(() => {
    return permissionGroups
      .map((group) => {
        const options = group.options.filter((permission) => {
          if (!normalizedKeyword) {
            return true;
          }
          const label = (permissionLabels[permission] ?? permission).toLowerCase();
          const title = group.title.toLowerCase();
          const description = group.description.toLowerCase();
          return label.includes(normalizedKeyword) || title.includes(normalizedKeyword) || description.includes(normalizedKeyword);
        });
        return { ...group, options };
      })
      .filter((group) => group.options.length > 0);
  }, [normalizedKeyword, permissionGroups, permissionLabels]);

  const sections = useMemo(() => {
    return [
      {
        key: 'public',
        title: locale === 'zh-CN' ? '前台权限' : 'Public permissions',
        groups: filteredGroups.filter((group) => group.scope === 'public'),
      },
      {
        key: 'admin',
        title: locale === 'zh-CN' ? '后台权限' : 'Admin permissions',
        groups: filteredGroups.filter((group) => group.scope === 'admin'),
      },
    ].filter((section) => section.groups.length > 0);
  }, [filteredGroups, locale]);

  function updateValues(nextValues: string[]) {
    onChange?.(uniqueSorted(nextValues));
  }

  function toggleGroup(groupPermissions: string[], checked: boolean) {
    if (checked) {
      updateValues([...selected, ...groupPermissions]);
      return;
    }
    updateValues(selected.filter((permission) => !groupPermissions.includes(permission)));
  }

  return (
    <div className="permission-selector">
      <div className="permission-selector-toolbar">
        <div>
          <div className="permission-selector-title">
            {locale === 'zh-CN' ? '权限选择' : 'Permission selector'}
          </div>
          <div className="permission-selector-subtitle">
            {locale === 'zh-CN'
              ? `当前已选择 ${selected.length} 项权限，可按前台/后台分组展开配置。`
              : `${selected.length} permissions selected. Expand public/admin groups to configure them.`}
          </div>
        </div>
        <Space wrap>
          <Tag className="data-pill is-info">
            {locale === 'zh-CN' ? `已选 ${selected.length} 项` : `${selected.length} selected`}
          </Tag>
          <Button onClick={() => updateValues([])}>
            {locale === 'zh-CN' ? '清空全部' : 'Clear all'}
          </Button>
        </Space>
      </div>

      <Input
        allowClear
        className="permission-search-input"
        prefix={<SearchOutlined />}
        placeholder={locale === 'zh-CN' ? '搜索权限名称、分组或用途说明' : 'Search permissions, groups, or descriptions'}
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
      />

      <div className="permission-section-list">
        {sections.map((section) => (
          <section key={section.key} className="permission-section">
            <div className="permission-section-header">
              <div className="permission-section-title">{section.title}</div>
              <div className="permission-section-meta">
                {locale === 'zh-CN'
                  ? `${section.groups.length} 个分组`
                  : `${section.groups.length} groups`}
              </div>
            </div>
            <Collapse
              className="permission-group-collapse"
              ghost
              defaultActiveKey={section.groups.map((group) => group.key)}
              items={section.groups.map((group) => {
                const checkedCount = group.options.filter((permission) => selectedSet.has(permission)).length;
                return {
                  key: group.key,
                  label: (
                    <div className="permission-group-header">
                      <div>
                        <div className="permission-group-title">{group.title}</div>
                        <div className="permission-group-description">{group.description}</div>
                      </div>
                      <Tag className="data-pill">
                        {locale === 'zh-CN'
                          ? `${checkedCount}/${group.options.length} 已选`
                          : `${checkedCount}/${group.options.length} selected`}
                      </Tag>
                    </div>
                  ),
                  children: (
                    <div className="permission-group-card refined">
                      <div className="permission-group-actions">
                        <Space wrap>
                          <Button
                            size="small"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleGroup(group.options, true);
                            }}
                          >
                            {locale === 'zh-CN' ? '全选本组' : 'Select group'}
                          </Button>
                          <Button
                            size="small"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleGroup(group.options, false);
                            }}
                          >
                            {locale === 'zh-CN' ? '清空本组' : 'Clear group'}
                          </Button>
                        </Space>
                      </div>
                      <Checkbox.Group
                        value={selected}
                        onChange={(nextValue) => updateValues((nextValue as string[]) ?? [])}
                      >
                        <div className="permission-option-list">
                          {group.options.map((permission) => (
                            <label key={permission} className={`permission-option${selectedSet.has(permission) ? ' is-selected' : ''}`}>
                              <Checkbox value={permission}>
                                <span className="permission-option-label">{permissionLabels[permission] ?? permission}</span>
                              </Checkbox>
                            </label>
                          ))}
                        </div>
                      </Checkbox.Group>
                    </div>
                  ),
                };
              })}
            />
          </section>
        ))}
      </div>

      {filteredGroups.length === 0 ? (
        <Typography.Text type="secondary">
          {locale === 'zh-CN' ? '没有匹配的权限项。' : 'No matching permissions.'}
        </Typography.Text>
      ) : null}

      {feedback.errors.length > 0 ? <Alert className="permission-feedback-alert" type="error" showIcon message={feedback.errors[0]} /> : null}
      {feedback.warnings.map((warning) => (
        <Alert key={warning} className="permission-feedback-alert" type="warning" showIcon message={warning} />
      ))}
    </div>
  );
}
