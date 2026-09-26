import { useId } from "react";

function Input({
  id,
  type = "text",
  label,
  error,
  helperText,
  disabled = false,
  required = false,
  ...props
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const messageId = `${inputId}-message`;

  return (
    <div className="flex w-full flex-col gap-2">
      {label && (
        <label
          htmlFor={inputId}
          className="text-small font-medium text-foreground"
        >
          {label}
          {required && " *"}
        </label>
      )}

      <input
        {...props}
        id={inputId}
        type={type}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error || helperText ? messageId : undefined}
        className={`
          h-11
          w-full
          rounded-md
          border
          bg-background
          px-3
          text-body
          text-foreground
          outline-none
          transition-colors
          placeholder:text-muted-foreground

          ${
            error
              ? "border-destructive focus-visible:ring-2 focus-visible:ring-destructive/30"
              : "border-border focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          }

          disabled:cursor-not-allowed
          disabled:opacity-50
        `}
      />

      {(error || helperText) && (
        <p
          id={messageId}
          className={`text-small ${
            error ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
}

export default Input;
