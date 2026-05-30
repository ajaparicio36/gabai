'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/providers/AuthProvider';
import { OnboardingProvider } from '@/components/onboarding/OnboardingProvider';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { ADMIN_ONBOARDING_STEPS } from '@/components/onboarding/onboarding-steps';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Search, Download, ArrowLeft, Brain } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

const navItems = [
  {
    title: 'Discover',
    url: '/admin/discover',
    icon: Search,
  },
  {
    title: 'Scrape',
    url: '/admin/scrape',
    icon: Download,
  },
  {
    title: 'Model',
    url: '/admin/model',
    icon: Brain,
  },
];

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'admin')) {
      router.replace('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== 'admin') {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <OnboardingProvider
      steps={ADMIN_ONBOARDING_STEPS}
      storageKey="gavai_onboarding_admin_complete"
    >
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarContent data-ob="admin-sidebar">
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center pt-2">
                <Image
                  src="/gavai_horizontal.png"
                  alt="GAVAI"
                  width={120}
                  height={24}
                  className="h-6 w-auto"
                />
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.url}
                      >
                        <Link href={item.url}>
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
        <SidebarInset>
          <header className="flex h-14 items-center gap-4 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-6" />
            <Link
              href="/map"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Map
            </Link>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
      <OnboardingTour />
    </OnboardingProvider>
  );
}
