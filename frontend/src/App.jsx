import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./features/auth/pages/Login";
import Register from "./features/auth/pages/Register";
import Dashboard from "@/features/dashboard/pages/Dashboard";
import ProtectedRoute from "./routes/ProtectedRoute";
import MyLearning from "./features/materials/pages/MyLearning";
import LearningEnvironment from "./features/materials/pages/LearningEnvironment";
import AppLayout from "./appLayout/AppLayout";
// import ErrorStateShowcase from "./components/dev/ui-showcases/ErrorStateShowcase";
// import EmptyStateShowcase from "./components/dev/ui-showcases/EmptyStateShowcase";
// import LoadingStateShowcase from "./components/dev/ui-showcases/LoadingStateShowcase.jsx";

function App() {
  return (
    <>
      {/* <LoadingStateShowcase /> */}
      {/* <EmptyStateShowcase /> */}
      {/* <ErrorStateShowcase/> */}
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/learning"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <MyLearning />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/learning/:materialId"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <LearningEnvironment />
                </AppLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
