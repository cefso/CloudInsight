import { ConfigProvider } from 'antd';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, useTheme } from './hooks/useTheme';
import { darkTheme, lightTheme } from './styles/theme';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Inspections from './pages/Inspections';
import InspectionDetail from './pages/Inspections/Detail';
import Thresholds from './pages/Thresholds';
import Cron from './pages/Cron';
import AiConfig from './pages/Settings/AiConfig';

function AppInner() {
  const { mode } = useTheme();
  return (
    <ConfigProvider theme={mode === 'dark' ? darkTheme : lightTheme}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="inspections" element={<Inspections />} />
            <Route path="inspections/:taskId" element={<InspectionDetail />} />
            <Route path="thresholds" element={<Thresholds />} />
            <Route path="cron" element={<Cron />} />
            <Route path="settings/ai" element={<AiConfig />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

export default App;
