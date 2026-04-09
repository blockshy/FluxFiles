import { GlobalOutlined } from '@ant-design/icons';
import { Segmented } from 'antd';
import { useI18n } from './LocaleProvider';

export function LocaleToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <Segmented
      size="middle"
      value={locale}
      onChange={(value) => setLocale(value as 'zh-CN' | 'en-US')}
      options={[
        {
          label: (
            <span className="theme-toggle-option">
              <GlobalOutlined />
              <span>{t('lang.zh')}</span>
            </span>
          ),
          value: 'zh-CN',
        },
        {
          label: (
            <span className="theme-toggle-option">
              <GlobalOutlined />
              <span>{t('lang.en')}</span>
            </span>
          ),
          value: 'en-US',
        },
      ]}
    />
  );
}
