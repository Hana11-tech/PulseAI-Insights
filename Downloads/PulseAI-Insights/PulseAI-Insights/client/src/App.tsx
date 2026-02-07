import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarNav, MobileNav } from "@/components/SidebarNav";
import { SelectedEmployeeProvider } from "@/contexts/selected-employee";

// Pages
import Overview from "@/pages/Overview";
import EmployeeDetail from "@/pages/EmployeeDetail";
import Insights from "@/pages/Insights";
import SelfView from "@/pages/SelfView";
import Employees from "@/pages/Employees";
import NotFound from "@/pages/not-found";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex">
      <SidebarNav />
      <main className="flex-1 md:ml-64 pb-20 md:pb-0">
        <div className="max-w-7xl mx-auto p-4 md:p-8 lg:p-10">
          {children}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/">
          <Overview />
        </Route>
        <Route path="/insights">
          <Insights />
        </Route>
        <Route path="/employees">
          <Employees />
        </Route>
        <Route path="/me">
          <SelfView />
        </Route>
        <Route path="/employee/:id">
          <EmployeeDetail />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SelectedEmployeeProvider>
          <Toaster />
          <Router />
        </SelectedEmployeeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
