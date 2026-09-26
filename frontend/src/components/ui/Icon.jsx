function Icon({
  icon: IconComponent,
  size = "medium",
  className = "",
  ariaLabel,
}) {
  const sizeMap = {
    small: 16,
    medium: 20,
    large: 24,
  };

  return (
    <IconComponent
      size={sizeMap[size]}
      strokeWidth={2}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      className={className}
    />
  );
}

export default Icon;
