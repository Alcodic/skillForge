import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import DashboardOverview from "../components/DashboardOverview";
import ContinueLearning from "../components/ContinueLearning";
import DashboardPlaceholder from "../components/DashboardPlaceholder";

import "./Dashboard.css";

function Dashboard() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const token = localStorage.getItem("token");

      const response = await fetch("http://localhost:5001/api/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch dashboard");
      }

      if (!data.success) {
        throw new Error(data.message || "Failed to fetch dashboard");
      }

      return data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="dashboard">
        <div className="dashboard__content">
          <div className="dashboard-state">
            <h1>Loading your workspace...</h1>
            <p>Preparing your learning dashboard.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="dashboard__content">
          <div className="dashboard-state dashboard-state--error">
            <h1>Something went wrong</h1>
            <p>{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const materials = data?.materials ?? [];

  return (
    <div className="dashboard">
      <div className="dashboard__content">
        <header className="dashboard-header">
          <div>
            <h1 className="dashboard__title">Dashboard</h1>

            <p className="dashboard-header__description">
              Your learning overview and next steps.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/learning")}
            className="dashboard__button"
          >
            My Learning
          </button>
        </header>

        <DashboardOverview materialCount={materials.length} />

        <ContinueLearning materials={materials} />

        <DashboardPlaceholder
          title="Your mastery"
          description="Understand what you know and where you need more practice."
        />

        <DashboardPlaceholder
          title="Learning activity"
          description="Your learning history and progress will appear here."
        />
      </div>
    </div>
  );
}

export default Dashboard;
