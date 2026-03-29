import { cn } from "@/lib/utils";
import lotusLogoImage from "@/assets/lotus-logo.png";
import lotusIconImage from "@/assets/lotus-icon.png";

interface LotusLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  iconOnly?: boolean;
}

export const LotusLogo = ({ className, size = "md", showText = true, iconOnly = false }: LotusLogoProps) => {
  const sizeClasses = {
    sm: "h-8",
    md: "h-10",
    lg: "h-14",
  };

  return (
    <div className={cn("flex items-center", className)}>
      <img
        src={iconOnly ? lotusIconImage : lotusLogoImage}
        alt="Lótus Contabilidade"
        className={cn(sizeClasses[size], "w-auto object-contain")}
      />
    </div>
  );
};
