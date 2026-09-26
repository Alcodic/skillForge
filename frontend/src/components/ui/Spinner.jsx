function Spinner({
  size = "medium",
  label = "Loading",
  className = "",
}) {
  const sizeStyles = {
    small: "h-4 w-4",
    medium: "h-5 w-5",
    large: "h-8 w-8",
  };

  return (
    <span
      role="status"
      aria-label={label}
      className={`
        inline-block
        animate-spin
        rounded-full
        border-2
        border-muted
        border-t-primary
        ${sizeStyles[size]}
        ${className}
      `}
    />
  );
}

export default Spinner;