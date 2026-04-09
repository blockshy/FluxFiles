import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { Segmented } from 'antd';
import { useI18n } from '../i18n/LocaleProvider';
import { useThemeMode } from './ThemeProvider';

export function ThemeToggle() {
  const { themeMode, setThemeMode } = useThemeMode();
  const { t } = useI18n();

  return (
    <Segmented
      className="theme-toggle"
      size="middle"
      value={themeMode}
      onChange={(value) => setThemeMode(value as 'light' | 'dark')}
      options={[
        {
          label: (
            <span className="theme-toggle-option">
              <SunOutlined />
              <span>{t('theme.light')}</span>
            </span>
          ),
          value: 'light',
        },
        {
          label: (
            <span className="theme-toggle-option">
              <MoonOutlined />
              <span>{t('theme.dark')}</span>
            </span>
          ),
          value: 'dark',
        },
      ]}
    />
  );
}
