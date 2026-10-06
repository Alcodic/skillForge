function EmptyState({
  title,
  description,
  icon: IconComponent,
  action,
  className = "",
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 text-center ${className}`}
    >
      {IconComponent && (
        <IconComponent size={24} strokeWidth={2} aria-hidden="true" />
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-h3 text-foreground">{title}</h3>

        {description && (
          <p className="text-body text-muted-foreground">{description}</p>
        )}
      </div>

      {action && action}
    </div>
  );
}

export default EmptyState;
