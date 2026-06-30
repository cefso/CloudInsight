import { ConfigProvider } from 'antd';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useTheme } from './hooks/useTheme';
import { darkTheme, lightTheme } from './styles/theme';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Inspections from './pages/Inspections';
import InspectionDetail from './pages/Inspections/Detail';
import Thresholds from './pages/Thresholds';
import Cron from './pages/Cron';

function App() {
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
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
