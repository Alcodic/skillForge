import { cn } from "../../lib/utils.js";

const baseStyles =
  "inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

const variants = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",

  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70",

  outline:
    "border border-border bg-transparent text-foreground hover:bg-accent active:bg-accent/80",

  ghost: "bg-transparent text-foreground hover:bg-accent active:bg-accent/80",

  destructive:
    "bg-destructive text-white hover:bg-destructive/90 active:bg-destructive/80",
};

const sizes = {
  small: "h-8 px-3 text-small rounded-medium",
  medium: "h-10 px-4 text-body rounded-medium",
  large: "h-12 px-6 text-body rounded-large",
};

function Button({
  children,
  variant = "primary",
  size = "medium",
  loading = false,
  disabled = false,
  type = "button",
  onClick,
  className,
  ...props
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading ? "Loading..." : children}
    </button>
  );
}

export default Button;
