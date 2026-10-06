import { useNavigate } from "react-router-dom";

function ContinueLearning({ materials }) {
  const navigate = useNavigate();

  if (materials.length === 0) {
    return (
      <section className="dashboard-section">
        <div className="dashboard-section__header">
          <div>
            <h2>Continue learning</h2>
            <p>Pick up where you left off.</p>
          </div>
        </div>

        <div className="dashboard-empty">
          <h3>Your learning workspace is empty</h3>

          <p>
            Upload your first learning material to start building your
            personalized learning journey.
          </p>

          <button
            type="button"
            onClick={() => navigate("/learning")}
            className="dashboard__button"
          >
            Add material
          </button>
        </div>
      </section>
    );
  }

  const recentMaterials = materials.slice(0, 3);

  return (
    <section className="dashboard-section">
      <div className="dashboard-section__header">
        <div>
          <h2>Continue learning</h2>
          <p>Return to your learning materials.</p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/learning")}
          className="dashboard__secondary-button"
        >
          View all
        </button>
      </div>

      <div className="dashboard-materials">
        {recentMaterials.map((material) => (
          <article
            key={material.id}
            className="dashboard-material"
          >
            <div className="dashboard-material__content">
              <div className="dashboard-material__top">
                <h3>{material.title}</h3>

                <span
                  className={`dashboard-material__status dashboard-material__status--${material.processingStatus}`}
                >
                  {material.processingStatus}
                </span>
              </div>

              <p>
                {material.fileType?.toUpperCase()} ·{" "}
                {formatFileSize(material.fileSize)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/learning/${material.id}`)}
              className="dashboard__button"
            >
              Open
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatFileSize(bytes) {
  if (!bytes) return "0 MB";

  const megabytes = bytes / (1024 * 1024);

  return `${megabytes.toFixed(1)} MB`;
}

export default ContinueLearning;