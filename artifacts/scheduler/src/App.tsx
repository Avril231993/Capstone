import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route, Redirect } from "wouter";
import { Layout } from "@/components/layout";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import Timetable from "@/pages/timetable";
import Courses from "@/pages/courses";
import Faculty from "@/pages/faculty";
import Rooms from "@/pages/rooms";
import Schedule from "@/pages/schedule";
import Reports from "@/pages/reports";
import AiSuggestions from "@/pages/ai-suggestions";
import Conflicts from "@/pages/conflicts";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/">
          {() => <Redirect to="/dashboard" />}
        </Route>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/timetable" component={Timetable} />
        <Route path="/courses" component={Courses} />
        <Route path="/faculty" component={Faculty} />
        <Route path="/rooms" component={Rooms} />
        <Route path="/schedule" component={Schedule} />
        <Route path="/reports" component={Reports} />
        <Route path="/ai-suggestions" component={AiSuggestions} />
        <Route path="/conflicts" component={Conflicts} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
