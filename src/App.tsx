import { Route, Routes } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import OverviewPage from '@/pages/OverviewPage';
import DomainPage from '@/pages/DomainPage';
import DataPage from '@/pages/DataPage';
import InsightsPage from '@/pages/InsightsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="domains/clinical-outcome" element={<DomainPage domainId="clinical-outcome" />} />
        <Route path="domains/patient-safety" element={<DomainPage domainId="patient-safety" />} />
        <Route path="domains/financial-efficiency" element={<DomainPage domainId="financial-efficiency" />} />
        <Route path="domains/operational-efficiency" element={<DomainPage domainId="operational-efficiency" />} />
        <Route path="domains/hr-development" element={<DomainPage domainId="hr-development" />} />
        <Route path="data" element={<DataPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="*" element={<OverviewPage />} />
      </Route>
    </Routes>
  );
}
