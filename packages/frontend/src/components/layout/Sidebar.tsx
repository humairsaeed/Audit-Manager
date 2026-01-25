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
  BellIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore, ROLES } from '@/stores/auth';
import clsx from 'clsx';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
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

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, hasAnyRole } = useAuthStore();

  const filteredNavigation = navigation.filter((item) => {
    if (item.name === 'divider') return true;
    if (item.roles.length === 0) return true;
    return hasAnyRole(...item.roles);
  });

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Logo */}
      <div className="flex items-center h-16 px-4 bg-gray-900">
        <ShieldCheckIcon className="w-8 h-8 text-primary-500" />
        <span className="ml-2 text-xl font-bold text-white">AuditMS</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {filteredNavigation.map((item, index) => {
          if (item.name === 'divider') {
            return <div key={`divider-${index}`} className="my-4 border-t border-gray-700" />;
          }

          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={clsx(
                'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              {Icon && <Icon className="w-5 h-5 mr-3" />}
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
              <span className="text-white font-medium">
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </span>
            </div>
          </div>
          <div className="ml-3 overflow-hidden">
            <p className="text-sm font-medium text-white truncate">
              {user?.displayName || `${user?.firstName} ${user?.lastName}`}
            </p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
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
                <SidebarContent />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <SidebarContent />
      </div>
    </>
  );
}
