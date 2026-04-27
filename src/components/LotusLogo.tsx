import { cn } from "@/lib/utils";
import lotusLogoImage from "@/assets/lotus-logo.png";
import lotusIconImage from "@/assets/lotus-icon.png";
import lotusWhiteModeImage from "@/assets/lotus-white-mode.png";
import { useTheme } from "@/hooks/useTheme";

interface LotusLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  iconOnly?: boolean;
}

export const LotusLogo = ({ className, size = "md", showText = true, iconOnly = false }: LotusLogoProps) => {
  const { theme } = useTheme();
  const sizeClasses = {
    sm: "h-8",
    md: "h-10",
    lg: "h-16",
  };

  const logoSrc = iconOnly ? lotusIconImage : theme === "light" ? lotusWhiteModeImage : lotusLogoImage;

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
