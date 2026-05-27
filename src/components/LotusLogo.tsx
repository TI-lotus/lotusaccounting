import { cn } from "@/lib/utils";
import lotusLogoImage from "@/assets/lotus-logo.png";
import lotusIconImage from "@/assets/lotus-icon.png";

interface LotusLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  iconOnly?: boolean;
  forceDarkLogo?: boolean;
}

export const LotusLogo = ({ className, size = "md", iconOnly = false }: LotusLogoProps) => {
  const sizeClasses = {
    sm: "h-7",
    md: "h-9",
    lg: "h-12",
  };

  const logoSrc = iconOnly ? lotusIconImage : lotusLogoImage;

  return (
    <div className={cn("flex items-center", className)}>
      <img
        src={logoSrc}
        alt="Lótus Contabilidade"
        className={cn(sizeClasses[size], "w-auto object-contain")}
      />
    </div>
  );
};
