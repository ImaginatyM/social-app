import "../global.css";
import {BrowserRouter, Navigate, Route, Routes} from "react-router-dom";

import AppLayout from "#/components/layout/AppLayout";
import WalletDashboard from "#/screens/WalletDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/wallet" replace />} />
        <Route
          path="/wallet"
          element=
            {
              <AppLayout>
                <WalletDashboard />
              </AppLayout>
            }
        />
      </Routes>
    </BrowserRouter>
  );
}
