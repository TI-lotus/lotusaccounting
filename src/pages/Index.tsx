import { DashboardLayout } from "@/layouts/DashboardLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import {
  DollarSign,
  TrendingUp,
  Users,
  FileText,
} from "lucide-react";

const Index = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, John. Here's your financial overview.
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Total Revenue"
            value="$284,500"
            change={12.5}
            icon={DollarSign}
          />
          <KPICard
            title="Net Profit"
            value="$68,200"
            change={8.2}
            icon={TrendingUp}
          />
          <KPICard
            title="Active Clients"
            value="142"
            change={4.1}
            icon={Users}
          />
          <KPICard
            title="Pending Invoices"
            value="23"
            change={-15}
            changeLabel="12 due this week"
            icon={FileText}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Chart - Takes 2 columns */}
          <RevenueChart className="lg:col-span-2" />
          
          {/* Quick Stats */}
          <QuickStats />
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentTransactions />
          <AlertsPanel />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
