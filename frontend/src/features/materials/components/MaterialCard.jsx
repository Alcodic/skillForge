import { useNavigate } from "react-router-dom";

function MaterialCard({ material, onRetry }) {
  const navigate = useNavigate();

  const statusLabel = {
    UPLOADING: "Uploading",
    PROCESSING: "Processing",
    READY: "Ready",
    FAILED: "Processing failed",
  };

  return (
    <article className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className="text-lg font-semibold">{material.title}</h2>

          <p className="mt-1 text-sm text-muted-foreground">
            {material.originalFileName}
          </p>
        </div>

        <span className="text-sm font-medium">
          {statusLabel[material.processingStatus]}
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {material.fileType.toUpperCase()} ·{" "}
          {(material.fileSize / 1000000).toFixed(1)} MB
        </p>

        {material.processingStatus === "READY" && (
          <button
            onClick={() => navigate(`/learning/${material.id}`)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Open
          </button>
        )}

        {material.processingStatus === "PROCESSING" && (
          <span className="text-sm text-muted-foreground">
            Preparing material...
          </span>
        )}

        {material.processingStatus === "UPLOADING" && (
          <span className="text-sm text-muted-foreground">Uploading...</span>
        )}

        {material.processingStatus === "FAILED" && (
          <button
            onClick={() => onRetry(material)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
          >
            Retry
          </button>
        )}
      </div>
    </article>
  );
}

export default MaterialCard;
