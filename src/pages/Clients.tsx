import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Users, Plus, Search, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const clients = [
  { id: 1, name: "Acme Corporation", email: "billing@acme.com", status: "active", revenue: "$45,200", invoices: 12 },
  { id: 2, name: "TechStart Inc", email: "finance@techstart.io", status: "active", revenue: "$32,100", invoices: 8 },
  { id: 3, name: "Global Finance Ltd", email: "accounts@globalfinance.com", status: "pending", revenue: "$28,500", invoices: 15 },
  { id: 4, name: "Innovation Labs", email: "hello@innovationlabs.co", status: "active", revenue: "$18,900", invoices: 5 },
  { id: 5, name: "Sunrise Media", email: "billing@sunrisemedia.net", status: "inactive", revenue: "$12,400", invoices: 3 },
];

const Clients = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
            <p className="text-muted-foreground">Manage your client relationships</p>
          </div>
          <Button className="rounded-xl gap-2">
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        </div>

        <div className="glass rounded-2xl p-6 animate-fade-in">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search clients..." className="pl-10 rounded-xl" />
            </div>
          </div>

          <div className="space-y-3">
            {clients.map((client, index) => (
              <div
                key={client.id}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-accent/50 transition-colors"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Avatar className="h-11 w-11">
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {client.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{client.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{client.email}</p>
                </div>
                <div className="hidden md:block text-right">
                  <p className="font-semibold">{client.revenue}</p>
                  <p className="text-xs text-muted-foreground">{client.invoices} invoices</p>
                </div>
                <Badge
                  variant={client.status === 'active' ? 'default' : client.status === 'pending' ? 'secondary' : 'outline'}
                  className="capitalize"
                >
                  {client.status}
                </Badge>
                <Button variant="ghost" size="icon" className="rounded-lg">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Clients;
