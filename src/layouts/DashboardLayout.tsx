import { ReactNode } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { AIAgentButton } from "@/components/AIAgentButton";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  className?: string;
}

export const DashboardLayout = ({ children, className }: DashboardLayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <TopBar />
      <AppSidebar />
      <main className={cn("flex-1 p-6", className)}>
        {children}
      </main>
      <AIAgentButton />
    </div>
  );
};
