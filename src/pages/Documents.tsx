import { DashboardLayout } from "@/layouts/DashboardLayout";
import { FileText, Plus, Download, Eye, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const documents = [
  { id: 1, name: "Invoice #1234", client: "Acme Corporation", type: "Invoice", status: "paid", amount: "$12,500", date: "Jan 12, 2026" },
  { id: 2, name: "Invoice #1231", client: "TechStart Inc", type: "Invoice", status: "pending", amount: "$8,750", date: "Jan 10, 2026" },
  { id: 3, name: "Q4 Financial Report", client: "Internal", type: "Report", status: "final", amount: "-", date: "Jan 5, 2026" },
  { id: 4, name: "Invoice #1228", client: "Global Finance", type: "Invoice", status: "paid", amount: "$15,000", date: "Jan 9, 2026" },
  { id: 5, name: "Invoice #1220", client: "Acme Corporation", type: "Invoice", status: "overdue", amount: "$5,200", date: "Dec 28, 2025" },
];

const statusColors = {
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  final: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
};

const Documents = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
            <p className="text-muted-foreground">Manage invoices, reports, and documents</p>
          </div>
          <Button className="rounded-xl gap-2">
            <Plus className="h-4 w-4" />
            Create Invoice
          </Button>
        </div>

        <div className="glass rounded-2xl overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 font-medium text-muted-foreground">Document</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Client</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Amount</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc, index) => (
                  <tr
                    key={doc.id}
                    className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">{doc.date}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell text-muted-foreground">{doc.client}</td>
                    <td className="p-4 hidden sm:table-cell text-muted-foreground">{doc.type}</td>
                    <td className="p-4">
                      <Badge className={statusColors[doc.status as keyof typeof statusColors]} variant="secondary">
                        {doc.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right font-medium">{doc.amount}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Documents;
