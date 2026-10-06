import Spinner from "../ui/Spinner";

function LoadingState({
  message = "Loading...",
  size = "medium",
  className = "",
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <Spinner size={size} label={message} />

      <span className="text-small text-muted-foreground">{message}</span>
    </div>
  );
}

export default LoadingState;
