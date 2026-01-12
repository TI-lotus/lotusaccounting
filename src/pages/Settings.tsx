import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Settings as SettingsIcon, User, Bell, Shield, CreditCard, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ThemeToggle";

const Settings = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>

        {/* Profile Section */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Profile</h3>
          </div>
          <div className="flex items-start gap-6">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">JD</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input defaultValue="John" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input defaultValue="Doe" className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input defaultValue="john@lotus.com" className="rounded-xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Company Section */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Building className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Company</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input defaultValue="Lotus Financial Services" className="rounded-xl" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tax ID</Label>
                <Input defaultValue="XX-XXXXXXX" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Fiscal Year End</Label>
                <Input defaultValue="December" className="rounded-xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Preferences</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">Toggle between light and dark mode</p>
              </div>
              <ThemeToggle />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Currency</p>
                <p className="text-sm text-muted-foreground">Default display currency</p>
              </div>
              <span className="text-sm text-muted-foreground">USD ($)</span>
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Notifications</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-sm text-muted-foreground">Receive updates via email</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Payment Alerts</p>
                <p className="text-sm text-muted-foreground">Get notified for incoming payments</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Invoice Reminders</p>
                <p className="text-sm text-muted-foreground">Reminders for overdue invoices</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Security</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
              </div>
              <Button variant="outline" size="sm" className="rounded-lg">
                Enable
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Change Password</p>
                <p className="text-sm text-muted-foreground">Update your account password</p>
              </div>
              <Button variant="outline" size="sm" className="rounded-lg">
                Update
              </Button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button className="rounded-xl px-8">
            Save Changes
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
