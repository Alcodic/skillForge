function DashboardOverview({ materialCount }) {
  return (
    <section className="dashboard-overview">
      <div className="dashboard-overview__card">
        <span className="dashboard-overview__label">Learning materials</span>

        <strong className="dashboard-overview__value">{materialCount}</strong>

        <span className="dashboard-overview__description">
          Materials in your learning library
        </span>
      </div>

      <div className="dashboard-overview__card">
        <span className="dashboard-overview__label">Mastery</span>

        <strong className="dashboard-overview__value">—</strong>

        <span className="dashboard-overview__description">
          Build your learning profile through practice
        </span>
      </div>

      <div className="dashboard-overview__card">
        <span className="dashboard-overview__label">Next review</span>

        <strong className="dashboard-overview__value">—</strong>

        <span className="dashboard-overview__description">
          Reinforcement will appear here
        </span>
      </div>
    </section>
  );
}

export default DashboardOverview;
