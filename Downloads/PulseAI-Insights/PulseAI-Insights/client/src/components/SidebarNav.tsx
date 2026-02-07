import { Link, useLocation } from "wouter";
import { LayoutDashboard, Lightbulb, UserCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSelectedEmployee } from "@/contexts/selected-employee";
import { useEmployee, useMlPrediction } from "@/hooks/use-pulse-data";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export function SidebarNav() {
  const [location] = useLocation();
  const { selectedEmployeeId } = useSelectedEmployee();
  const { data: employee } = useEmployee(selectedEmployeeId || 0);
  const { data: prediction } = useMlPrediction(selectedEmployeeId || 0);

  const navItems = [
    { icon: LayoutDashboard, label: "Overview", href: "/" },
    { icon: Users, label: "Employees", href: "/employees" },
    { icon: Lightbulb, label: "Insights", href: "/insights" },
    { icon: UserCircle, label: "My Pulse", href: "/me" },
  ];

  return (
    <div className="w-64 border-r border-border bg-card h-screen flex flex-col fixed left-0 top-0 z-50 shadow-sm hidden md:flex">
      <div className="p-8 pb-4">
        <h1 className="text-2xl font-bold font-display text-primary tracking-tight">
          PulseAI
        </h1>
        <p className="text-xs text-muted-foreground mt-1 font-medium">Performance Intelligence</p>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
              isActive 
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}>
              <item.icon className={cn("w-5 h-5", isActive ? "stroke-2" : "stroke-1.5")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-border/50">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            P
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">PulseAI Demo</p>
            <p className="text-xs text-muted-foreground">Local access</p>
          </div>
        </div>
        {selectedEmployeeId && (
          <div className="mt-3 px-4">
            <div className="text-xs text-muted-foreground">Selected Employee</div>
            <div className="text-sm font-semibold truncate">{employee?.name || `Employee ${selectedEmployeeId}`}</div>
            {prediction?.createdAt ? (
              <Badge variant="secondary" className="mt-2 text-[10px]">
                Updated {format(new Date(prediction.createdAt), "MMM d, h:mm a")}
              </Badge>
            ) : (
              <Badge variant="outline" className="mt-2 text-[10px]">
                No prediction yet
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function MobileNav() {
  const [location] = useLocation();
  
  const navItems = [
    { icon: LayoutDashboard, label: "Overview", href: "/" },
    { icon: Users, label: "Employees", href: "/employees" },
    { icon: Lightbulb, label: "Insights", href: "/insights" },
    { icon: UserCircle, label: "Me", href: "/me" },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border z-50 pb-safe">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
           const isActive = location === item.href;
           return (
             <Link key={item.href} href={item.href} className={cn(
               "flex flex-col items-center justify-center w-full h-full gap-1",
               isActive ? "text-primary" : "text-muted-foreground"
             )}>
               <item.icon className={cn("w-6 h-6", isActive && "fill-current/10")} />
               <span className="text-[10px] font-medium">{item.label}</span>
             </Link>
           );
        })}
      </div>
    </div>
  );
}
