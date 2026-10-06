import Button from "../ui/Button";

function ErrorState({
  title = "Something went wrong",
  message = "Please try again.",
  onRetry,
  retryLabel = "Try again",
  className = "",
}) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-4 text-center ${className}`}
    >
      <div className="flex flex-col gap-2">
        <h3 className="text-h3 text-foreground">{title}</h3>

        <p className="text-body text-muted-foreground">{message}</p>
      </div>

      {onRetry && (
        <Button variant="primary" size="medium" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

export default ErrorState;
