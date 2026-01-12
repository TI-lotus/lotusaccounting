import { DashboardLayout } from "@/layouts/DashboardLayout";
import { MessageSquare, Send, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const conversations = [
  { id: 1, name: "Sarah Johnson", role: "Accountant", message: "The quarterly report is ready for review", time: "2m ago", unread: true },
  { id: 2, name: "Mike Chen", role: "CFO", message: "Can we discuss the budget forecast?", time: "1h ago", unread: true },
  { id: 3, name: "System", role: "Notification", message: "Invoice #1234 has been paid", time: "3h ago", unread: true },
  { id: 4, name: "Lisa Williams", role: "Client Manager", message: "New client onboarding complete", time: "Yesterday", unread: false },
  { id: 5, name: "System", role: "Alert", message: "Bank sync completed successfully", time: "Yesterday", unread: false },
];

const Messages = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="text-muted-foreground">Internal communications and notifications</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-220px)]">
          {/* Conversations List */}
          <div className="glass rounded-2xl p-4 animate-fade-in overflow-hidden flex flex-col">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search messages..." className="pl-10 rounded-xl" />
            </div>
            <div className="space-y-2 overflow-y-auto flex-1">
              {conversations.map((conv, index) => (
                <div
                  key={conv.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors",
                    conv.unread ? "bg-primary/5" : "hover:bg-accent/50"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className={cn(
                      "font-medium",
                      conv.name === "System" 
                        ? "bg-primary/10 text-primary" 
                        : "bg-accent text-accent-foreground"
                    )}>
                      {conv.name === "System" ? <MessageSquare className="h-4 w-4" /> : conv.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={cn("font-medium text-sm truncate", conv.unread && "text-foreground")}>
                        {conv.name}
                      </p>
                      <span className="text-xs text-muted-foreground shrink-0">{conv.time}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{conv.message}</p>
                  </div>
                  {conv.unread && (
                    <div className="w-2 h-2 bg-primary rounded-full shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Message Thread */}
          <div className="glass rounded-2xl p-6 lg:col-span-2 animate-fade-in flex flex-col">
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-accent">SJ</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">Sarah Johnson</p>
                <p className="text-sm text-muted-foreground">Accountant • Online</p>
              </div>
            </div>
            
            <div className="flex-1 py-6 space-y-4 overflow-y-auto">
              <div className="flex justify-start">
                <div className="bg-accent rounded-2xl rounded-tl-md px-4 py-2 max-w-[80%]">
                  <p className="text-sm">Hi John, the quarterly report is ready for your review. I've included all the revenue breakdowns and expense analysis.</p>
                  <span className="text-xs text-muted-foreground mt-1 block">10:30 AM</span>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-4 py-2 max-w-[80%]">
                  <p className="text-sm">Thanks Sarah! I'll take a look at it this afternoon.</p>
                  <span className="text-xs text-primary-foreground/70 mt-1 block">10:32 AM</span>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-accent rounded-2xl rounded-tl-md px-4 py-2 max-w-[80%]">
                  <p className="text-sm">Great! Let me know if you have any questions or need any clarifications.</p>
                  <span className="text-xs text-muted-foreground mt-1 block">10:33 AM</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <Input placeholder="Type a message..." className="rounded-xl flex-1" />
              <Button size="icon" className="rounded-xl h-10 w-10">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Messages;
