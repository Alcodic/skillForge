function Badge({ children, variant = "neutral", className = "" }) {
  const variantStyles = {
    neutral: "bg-muted text-muted-foreground",

    primary: "bg-primary text-primary-foreground",

    success: "bg-success text-success-foreground",

    warning: "bg-warning text-warning-foreground",

    error: "bg-destructive text-primary-foreground",

    info: "bg-info text-info-foreground",
  };

  return (
    <span
      className={`
        inline-flex
        items-center
        rounded-full
        px-2
        py-1
        text-caption
        font-medium
        leading-none
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

export default Badge;
