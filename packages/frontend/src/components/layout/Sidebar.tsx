'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog, Transition } from '@headlessui/react';
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  UsersIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  ShieldCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore, ROLES } from '@/stores/auth';
import clsx from 'clsx';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, roles: [] },
  { name: 'Audits', href: '/audits', icon: ClipboardDocumentListIcon, roles: [] },
  { name: 'Observations', href: '/observations', icon: ExclamationTriangleIcon, roles: [] },
  { name: 'My Observations', href: '/observations/my', icon: DocumentTextIcon, roles: [] },
  {
    name: 'Import',
    href: '/import',
    icon: ArrowUpTrayIcon,
    roles: [ROLES.SYSTEM_ADMIN, ROLES.AUDIT_ADMIN],
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: ChartBarIcon,
    roles: [ROLES.SYSTEM_ADMIN, ROLES.AUDIT_ADMIN, ROLES.COMPLIANCE_MANAGER, ROLES.EXECUTIVE],
  },
  { name: 'divider', href: '', icon: null, roles: [] },
  {
    name: 'Users',
    href: '/admin/users',
    icon: UsersIcon,
    roles: [ROLES.SYSTEM_ADMIN, ROLES.AUDIT_ADMIN],
  },
  {
    name: 'Roles',
    href: '/admin/roles',
    icon: ShieldCheckIcon,
    roles: [ROLES.SYSTEM_ADMIN],
  },
  {
    name: 'Entities',
    href: '/admin/entities',
    icon: BuildingOfficeIcon,
    roles: [ROLES.SYSTEM_ADMIN, ROLES.AUDIT_ADMIN],
  },
  {
    name: 'Settings',
    href: '/admin/settings',
    icon: Cog6ToothIcon,
    roles: [ROLES.SYSTEM_ADMIN],
  },
];

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { user, hasAnyRole } = useAuthStore();

  const filteredNavigation = navigation.filter((item) => {
    if (item.name === 'divider') return true;
    if (item.roles.length === 0) return true;
    return hasAnyRole(...item.roles);
  });

  const adminItems = ['Users', 'Roles', 'Entities', 'Settings'];
  const primaryNavigation = filteredNavigation.filter(
    (item) => item.name !== 'divider' && !adminItems.includes(item.name)
  );
  const adminNavigation = filteredNavigation.filter((item) =>
    adminItems.includes(item.name)
  );

  const SidebarContent = ({ isCollapsed = false }: { isCollapsed?: boolean }) => (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      {/* Logo */}
      <div className={clsx(
        'flex items-center h-16 border-b border-slate-800/70',
        isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
      )}>
        <div className={clsx('flex items-center gap-2', isCollapsed && 'justify-center')}>
          <ShieldCheckIcon className="w-7 h-7 text-primary-400 flex-shrink-0" />
          {!isCollapsed && (
            <span className="text-lg font-semibold tracking-wide text-white">ERES AMS</span>
          )}
        </div>
      </div>

      {/* Main Navigation */}
      <nav className={clsx(
        'flex-1 py-4 space-y-1 overflow-y-auto',
        isCollapsed ? 'px-2' : 'px-3'
      )}>
        {primaryNavigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              title={isCollapsed ? item.name : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={clsx(
                'group relative flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60',
                isCollapsed ? 'justify-center px-2' : 'px-3',
                isActive
                  ? 'bg-slate-800/80 text-white'
                  : 'text-slate-300 hover:bg-slate-900/60 hover:text-white'
              )}
            >
              {isActive && (
                <span
                  className={clsx(
                    'absolute left-0 top-2 h-6 w-1 rounded-full bg-primary-400',
                    isCollapsed && 'left-1/2 -translate-x-1/2'
                  )}
                  aria-hidden="true"
                />
              )}
              {Icon && <Icon className="w-5 h-5 flex-shrink-0 text-slate-400 group-hover:text-white" />}
              {!isCollapsed && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Admin Navigation - Fixed near bottom above user info */}
      {adminNavigation.length > 0 && (
        <div className={clsx(
          'border-t border-slate-800/70 pt-4 pb-2 space-y-1',
          isCollapsed ? 'px-2' : 'px-3'
        )}>
          {!isCollapsed && (
            <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Administration
            </p>
          )}
          {adminNavigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                title={isCollapsed ? item.name : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  'group relative flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60',
                  isCollapsed ? 'justify-center px-2' : 'px-3',
                  isActive
                    ? 'bg-slate-800/80 text-white'
                    : 'text-slate-300 hover:bg-slate-900/60 hover:text-white'
                )}
              >
                {isActive && (
                  <span
                    className={clsx(
                      'absolute left-0 top-2 h-6 w-1 rounded-full bg-primary-400',
                      isCollapsed && 'left-1/2 -translate-x-1/2'
                    )}
                    aria-hidden="true"
                  />
                )}
                {Icon && <Icon className="w-5 h-5 flex-shrink-0 text-slate-400 group-hover:text-white" />}
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </div>
      )}

      {/* User Info */}
      <div className={clsx(
        'border-t border-slate-800/70',
        isCollapsed ? 'p-2' : 'p-4'
      )}>
        <div className={clsx(
          'flex items-center',
          isCollapsed && 'justify-center'
        )}>
          <div className="flex-shrink-0">
            <div className={clsx(
              'rounded-full bg-primary-500/90 flex items-center justify-center',
              isCollapsed ? 'w-8 h-8' : 'w-10 h-10'
            )}>
              <span className={clsx('text-white font-medium', isCollapsed && 'text-xs')}>
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </span>
            </div>
          </div>
          {!isCollapsed && (
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">
                {user?.displayName || `${user?.firstName} ${user?.lastName}`}
              </p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile sidebar */}
      <Transition.Root show={open} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={onClose}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/80" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                    <button type="button" className="-m-2.5 p-2.5" onClick={onClose}>
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>
                <SidebarContent isCollapsed={false} />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Desktop sidebar */}
      <div className={clsx(
        'hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300',
        collapsed ? 'lg:w-16' : 'lg:w-64'
      )}>
        <button
          onClick={onToggleCollapse}
          className="hidden lg:inline-flex items-center justify-center absolute -right-3 top-4 h-7 w-7 rounded-full border border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
        </button>
        <SidebarContent isCollapsed={collapsed} />
      </div>
    </>
  );
}
