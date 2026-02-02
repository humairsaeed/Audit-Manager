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
    <div className="flex flex-col h-full bg-gray-900">
      {/* Logo */}
      <div className={clsx(
        'flex items-center h-16 bg-gray-900 border-b border-gray-800',
        isCollapsed ? 'justify-between px-2' : 'justify-between px-4'
      )}>
        <div className={clsx('flex items-center', isCollapsed && 'justify-center')}>
          <ShieldCheckIcon className="w-8 h-8 text-primary-500 flex-shrink-0" />
          {!isCollapsed && (
            <span className="ml-2 text-xl font-bold text-white">ERES AMS</span>
          )}
        </div>
        {!isCollapsed && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:inline-flex p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Collapse sidebar"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
        )}
        {isCollapsed && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:inline-flex p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Expand sidebar"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <nav className={clsx(
        'flex-1 py-4 space-y-1 overflow-y-auto',
        isCollapsed ? 'px-2' : 'px-2'
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
              className={clsx(
                'flex items-center py-2 text-sm font-medium rounded-lg transition-colors',
                isCollapsed ? 'justify-center px-2' : 'px-3',
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              {Icon && <Icon className={clsx('w-5 h-5 flex-shrink-0', !isCollapsed && 'mr-3')} />}
              {!isCollapsed && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Admin Navigation - Fixed near bottom above user info */}
      {adminNavigation.length > 0 && (
        <div className="border-t border-gray-700 pt-3 pb-2 px-2 space-y-1">
          {adminNavigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                title={isCollapsed ? item.name : undefined}
                className={clsx(
                  'flex items-center py-2 text-sm font-medium rounded-lg transition-colors',
                  isCollapsed ? 'justify-center px-2' : 'px-3',
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                )}
              >
                {Icon && <Icon className={clsx('w-5 h-5 flex-shrink-0', !isCollapsed && 'mr-3')} />}
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </div>
      )}

      {/* User Info */}
      <div className={clsx(
        'border-t border-gray-700',
        isCollapsed ? 'p-2' : 'p-4'
      )}>
        <div className={clsx(
          'flex items-center',
          isCollapsed && 'justify-center'
        )}>
          <div className="flex-shrink-0">
            <div className={clsx(
              'rounded-full bg-primary-600 flex items-center justify-center',
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
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
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
        <SidebarContent isCollapsed={collapsed} />
      </div>
    </>
  );
}
