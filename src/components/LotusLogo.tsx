import { cn } from "@/lib/utils";

interface LotusLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export const LotusLogo = ({ className, size = "md", showText = true }: LotusLogoProps) => {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 48 48"
        fill="none"
        className={cn(sizeClasses[size], "text-primary")}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Lotus leaf outline */}
        <path
          d="M24 6C24 6 12 14 12 26C12 34 17 40 24 42C31 40 36 34 36 26C36 14 24 6 24 6Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Center vein */}
        <path
          d="M24 12V36"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.6"
        />
        {/* Left veins */}
        <path
          d="M24 20C20 22 16 26 15 30"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.4"
        />
        <path
          d="M24 28C21 29 18 32 17 35"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.4"
        />
        {/* Right veins */}
        <path
          d="M24 20C28 22 32 26 33 30"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.4"
        />
        <path
          d="M24 28C27 29 30 32 31 35"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.4"
        />
        {/* Water ripple at bottom */}
        <path
          d="M14 44C18 42 20 42 24 44C28 42 30 42 34 44"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>
      {showText && (
        <span className={cn("font-semibold tracking-tight text-foreground", textSizes[size])}>
          Lotus
        </span>
      )}
    </div>
  );
};
