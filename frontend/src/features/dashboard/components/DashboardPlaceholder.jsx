function DashboardPlaceholder({ title, description }) {
  return (
    <section className="dashboard-section">
      <div className="dashboard-section__header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      <div className="dashboard-placeholder">
        <span className="dashboard-placeholder__icon">—</span>

        <h3>Not available yet</h3>

        <p>
          This part of your learning profile will appear as you learn and
          practice.
        </p>
      </div>
    </section>
  );
}

export default DashboardPlaceholder;
