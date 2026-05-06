import React from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Users,
  DoorOpen,
  CalendarPlus,
  FileBarChart,
  Lightbulb,
  AlertTriangle,
  CalendarCog,
  Archive,
  GraduationCap,
  FileText,
  ClipboardList,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarHeader
} from "@/components/ui/sidebar";

const navGroups = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Timetable", url: "/timetable", icon: CalendarDays },
    ],
  },
  {
    label: "Scheduling",
    items: [
      { title: "Schedule Builder", url: "/schedule-builder", icon: CalendarCog },
      { title: "Schedule", url: "/schedule", icon: CalendarPlus },
      { title: "Conflicts", url: "/conflicts", icon: AlertTriangle },
      { title: "AI Suggestions", url: "/ai-suggestions", icon: Lightbulb },
    ],
  },
  {
    label: "Resources",
    items: [
      { title: "Courses", url: "/courses", icon: BookOpen },
      { title: "Faculty", url: "/faculty", icon: Users },
      { title: "Rooms", url: "/rooms", icon: DoorOpen },
    ],
  },
  {
    label: "Organization",
    items: [
      { title: "School Years", url: "/school-years", icon: Archive },
      { title: "Year Levels & Sections", url: "/year-levels", icon: GraduationCap },
      { title: "Enrollment Management", url: "/enrollment", icon: ClipboardList },
      { title: "Letter of Intent (LOI)", url: "/loi", icon: FileText },
    ],
  },
  {
    label: "Analytics",
    items: [
      { title: "Reports", url: "/reports", icon: FileBarChart },
    ],
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <Sidebar className="border-r">
          <SidebarHeader className="p-4 border-b">
            <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
              <div className="bg-primary text-primary-foreground p-1.5 rounded-md">
                <CalendarDays className="h-5 w-5" />
              </div>
              <span>RegiSync</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            {navGroups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={location === item.url} tooltip={item.title}>
                          <Link href={item.url} className="flex items-center gap-3 w-full">
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
            <div className="mx-auto max-w-6xl w-full h-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
