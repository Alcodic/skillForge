import { useNavigate } from "react-router-dom";

const STATUS_CONFIG = {
  UPLOADING: {
    label: "Uploading",
    description: "Uploading your material...",
    badgeClass: "border border-border bg-muted text-muted-foreground",
  },

  PROCESSING: {
    label: "Processing",
    description: "Preparing material for learning...",
    badgeClass: "border border-border bg-muted text-muted-foreground",
  },

  READY: {
    label: "Ready",
    description: "Ready to learn",
    badgeClass: "border border-border bg-muted text-foreground",
  },

  FAILED: {
    label: "Processing failed",
    description: "We couldn't prepare this material.",
    badgeClass: "border border-border bg-muted text-muted-foreground",
  },
};

function MaterialCard({ material, onRetry }) {
  const navigate = useNavigate();

  const status = STATUS_CONFIG[material.processingStatus] ?? {
    label: "Unknown",
    description: "Material status unavailable.",
    badgeClass: "border border-border bg-muted text-muted-foreground",
  };

  const isReady = material.processingStatus === "READY";
  const isProcessing = material.processingStatus === "PROCESSING";
  const isUploading = material.processingStatus === "UPLOADING";
  const isFailed = material.processingStatus === "FAILED";

  return (
    <article className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{material.title}</h2>

          <p className="mt-1 truncate text-sm text-muted-foreground">
            {material.originalFileName}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${status.badgeClass}`}
        >
          {status.label}
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {material.fileType.toUpperCase()} ·{" "}
            {(material.fileSize / 1000000).toFixed(1)} MB
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            {status.description}
          </p>
        </div>

        {isReady && (
          <button
            type="button"
            onClick={() => navigate(`/learning/${material.id}`)}
            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open
          </button>
        )}

        {isProcessing && (
          <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
            <span
              className="h-2 w-2 animate-pulse rounded-full bg-current"
              aria-hidden="true"
            />
            Preparing
          </div>
        )}

        {isUploading && (
          <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
            <span
              className="h-2 w-2 animate-pulse rounded-full bg-current"
              aria-hidden="true"
            />
            Uploading
          </div>
        )}

        {isFailed && (
          <button
            type="button"
            onClick={() => onRetry(material)}
            className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Retry
          </button>
        )}
      </div>
    </article>
  );
}

export default MaterialCard;
