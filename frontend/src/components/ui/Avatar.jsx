function Avatar({ src, alt = "", initials, size = "medium", className = "" }) {
  const sizeStyles = {
    small: "h-8 w-8 text-caption",
    medium: "h-10 w-10 text-small",
    large: "h-14 w-14 text-body",
  };

  return (
    <div
      className={`
        flex
        shrink-0
        items-center
        justify-center
        overflow-hidden
        rounded-full
        bg-muted
        text-muted-foreground
        font-medium
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </div>
  );
}

export default Avatar;
