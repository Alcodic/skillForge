function Divider({ orientation = "horizontal", className = "" }) {
  const orientationStyles = {
    horizontal: "h-px w-full",
    vertical: "h-full w-px",
  };

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={`
        shrink-0
        bg-border
        ${orientationStyles[orientation]}
        ${className}
      `}
    />
  );
}

export default Divider;
