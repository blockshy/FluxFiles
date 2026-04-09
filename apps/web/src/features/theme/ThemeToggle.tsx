import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { Segmented } from 'antd';
import { useThemeMode } from './ThemeProvider';

export function ThemeToggle() {
  const { themeMode, setThemeMode } = useThemeMode();

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
              <span>Light</span>
            </span>
          ),
          value: 'light',
        },
        {
          label: (
            <span className="theme-toggle-option">
              <MoonOutlined />
              <span>Dark</span>
            </span>
          ),
          value: 'dark',
        },
      ]}
    />
  );
}
