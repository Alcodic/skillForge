// import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import "./Dashboard.css";

//Fundamental way
// function Dashboard() {
//   const [dashboardData, setDashboardData] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   useEffect(() => {
//     async function fetchDashboard() {
//       try {
//         const token = localStorage.getItem("token");

//         const response = await fetch("http://localhost:5001/api/dashboard", {
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         });
//         const data = await response.json();
//         if (!response.ok) {
//           throw new Error(data.message || "Failed to fetch dashboard");
//         }
//         if (!data.success) {
//           throw new Error(data.message || "Failed to fetch dashboard");
//         }
//         setDashboardData(data.data);
//         console.log("chekcing dash data: ", data);
//       } catch (error) {
//         setError(error.message);
//       } finally {
//         setLoading(false);
//       }
//     }
//     fetchDashboard();
//   }, []);

//using TanStack query which handles all the above things which we handled manually below :
// useState(loading)
// useState(data)
// useState(error)

// useEffect()

// fetch()

// try/catch

// response handling

// loading management

// error management

//2nd approach below using tanstack react query
function Dashboard() {
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
    return <h1>Loading dashboard...</h1>;
  }
  if (error) {
    return <h1>Error: {error.message}</h1>;
  }

  if (data.materials.length === 0) {
    return (
      <div className="dashboard">
        <div className="dashboard__content">
          <h1 className="dashboard__title">Dashboard</h1>

          <div className="dashboard__empty-state">
            <h2>Start your learning journey</h2>
            <p>You dont have any learning material yet.</p>
            <button className="dashboard__button">Add Material</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="dashboard">
      <div className="dashboard__content">
        <h1 className="dashboard__title">Dashboard</h1>
        <p>Materials: {data.materials.length}</p>
      </div>
    </div>
  );
}

export default Dashboard;
