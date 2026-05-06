import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route, Redirect } from "wouter";
import { Layout } from "@/components/layout";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import Timetable from "@/pages/timetable";
import ScheduleBuilder from "@/pages/schedule-builder";
import Courses from "@/pages/courses";
import Faculty from "@/pages/faculty";
import Rooms from "@/pages/rooms";
import Schedule from "@/pages/schedule";
import Reports from "@/pages/reports";
import AiSuggestions from "@/pages/ai-suggestions";
import Conflicts from "@/pages/conflicts";
import SchoolYears from "@/pages/school-years";
import YearLevels from "@/pages/year-levels";
import LoiPage from "@/pages/loi";
import Enrollment from "@/pages/enrollment";
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
        <Route path="/schedule-builder" component={ScheduleBuilder} />
        <Route path="/courses" component={Courses} />
        <Route path="/faculty" component={Faculty} />
        <Route path="/rooms" component={Rooms} />
        <Route path="/schedule" component={Schedule} />
        <Route path="/reports" component={Reports} />
        <Route path="/ai-suggestions" component={AiSuggestions} />
        <Route path="/conflicts" component={Conflicts} />
        <Route path="/school-years" component={SchoolYears} />
        <Route path="/year-levels" component={YearLevels} />
        <Route path="/loi" component={LoiPage} />
        <Route path="/enrollment" component={Enrollment} />
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
