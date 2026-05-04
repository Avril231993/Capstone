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
  AlertTriangle 
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

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Timetable", url: "/timetable", icon: CalendarDays },
  { title: "Courses", url: "/courses", icon: BookOpen },
  { title: "Faculty", url: "/faculty", icon: Users },
  { title: "Rooms", url: "/rooms", icon: DoorOpen },
  { title: "Schedule", url: "/schedule", icon: CalendarPlus },
  { title: "Reports", url: "/reports", icon: FileBarChart },
  { title: "AI Suggestions", url: "/ai-suggestions", icon: Lightbulb },
  { title: "Conflicts", url: "/conflicts", icon: AlertTriangle },
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
            <SidebarGroup>
              <SidebarGroupLabel>Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
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
