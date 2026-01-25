import { PrismaClient, UserStatus, RiskRating } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create Permissions
  console.log('Creating permissions...');
  const permissions = [
    // Audit permissions
    { resource: 'audit', action: 'create', scope: 'all', description: 'Create audits' },
    { resource: 'audit', action: 'read', scope: 'all', description: 'Read all audits' },
    { resource: 'audit', action: 'read', scope: 'entity', description: 'Read audits in own entity' },
    { resource: 'audit', action: 'update', scope: 'all', description: 'Update all audits' },
    { resource: 'audit', action: 'delete', scope: 'all', description: 'Delete audits' },

    // Observation permissions
    { resource: 'observation', action: 'create', scope: 'all', description: 'Create observations' },
    { resource: 'observation', action: 'read', scope: 'all', description: 'Read all observations' },
    { resource: 'observation', action: 'read', scope: 'own', description: 'Read own observations' },
    { resource: 'observation', action: 'update', scope: 'all', description: 'Update all observations' },
    { resource: 'observation', action: 'update', scope: 'own', description: 'Update own observations' },
    { resource: 'observation', action: 'delete', scope: 'all', description: 'Delete observations' },
    { resource: 'observation', action: 'assign', scope: 'all', description: 'Assign observations' },
    { resource: 'observation', action: 'approve', scope: 'all', description: 'Approve observations' },

    // Evidence permissions
    { resource: 'evidence', action: 'create', scope: 'all', description: 'Upload evidence' },
    { resource: 'evidence', action: 'read', scope: 'all', description: 'Read all evidence' },
    { resource: 'evidence', action: 'read', scope: 'own', description: 'Read own evidence' },
    { resource: 'evidence', action: 'delete', scope: 'all', description: 'Delete evidence' },
    { resource: 'evidence', action: 'approve', scope: 'all', description: 'Approve/reject evidence' },

    // User permissions
    { resource: 'user', action: 'create', scope: 'all', description: 'Create users' },
    { resource: 'user', action: 'read', scope: 'all', description: 'Read all users' },
    { resource: 'user', action: 'update', scope: 'all', description: 'Update users' },
    { resource: 'user', action: 'delete', scope: 'all', description: 'Delete users' },

    // Entity permissions
    { resource: 'entity', action: 'create', scope: 'all', description: 'Create entities' },
    { resource: 'entity', action: 'read', scope: 'all', description: 'Read entities' },
    { resource: 'entity', action: 'update', scope: 'all', description: 'Update entities' },
    { resource: 'entity', action: 'delete', scope: 'all', description: 'Delete entities' },

    // Import permissions
    { resource: 'import', action: 'create', scope: 'all', description: 'Import observations' },
    { resource: 'import', action: 'read', scope: 'all', description: 'View import jobs' },

    // Report permissions
    { resource: 'report', action: 'read', scope: 'all', description: 'View all reports' },
    { resource: 'report', action: 'export', scope: 'all', description: 'Export reports' },

    // Dashboard permissions
    { resource: 'dashboard', action: 'read', scope: 'all', description: 'View management dashboard' },

    // System config permissions
    { resource: 'system_config', action: 'read', scope: 'all', description: 'Read system configuration' },
    { resource: 'system_config', action: 'update', scope: 'all', description: 'Update system configuration' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: {
        resource_action_scope: {
          resource: perm.resource,
          action: perm.action,
          scope: perm.scope,
        },
      },
      update: {},
      create: perm,
    });
  }

  // Create Roles
  console.log('Creating roles...');
  const roles = [
    {
      name: 'system_admin',
      displayName: 'System Administrator',
      description: 'Full system access with all permissions',
      isSystemRole: true,
      level: 100,
      permissions: permissions.map((p) => `${p.resource}:${p.action}:${p.scope}`),
    },
    {
      name: 'audit_admin',
      displayName: 'Audit Administrator',
      description: 'Manage audits, observations, users, and imports',
      isSystemRole: true,
      level: 90,
      permissions: [
        'audit:create:all', 'audit:read:all', 'audit:update:all', 'audit:delete:all',
        'observation:create:all', 'observation:read:all', 'observation:update:all', 'observation:delete:all', 'observation:assign:all', 'observation:approve:all',
        'evidence:create:all', 'evidence:read:all', 'evidence:delete:all', 'evidence:approve:all',
        'user:create:all', 'user:read:all', 'user:update:all',
        'entity:create:all', 'entity:read:all', 'entity:update:all',
        'import:create:all', 'import:read:all',
        'report:read:all', 'report:export:all',
        'dashboard:read:all',
      ],
    },
    {
      name: 'compliance_manager',
      displayName: 'Compliance Manager',
      description: 'Manage observations, review evidence, generate reports',
      isSystemRole: true,
      level: 70,
      permissions: [
        'audit:read:all',
        'observation:read:all', 'observation:update:all', 'observation:assign:all', 'observation:approve:all',
        'evidence:read:all', 'evidence:approve:all',
        'user:read:all',
        'entity:read:all',
        'report:read:all', 'report:export:all',
        'dashboard:read:all',
      ],
    },
    {
      name: 'auditor',
      displayName: 'Auditor',
      description: 'Create and manage observations, view reports',
      isSystemRole: true,
      level: 60,
      permissions: [
        'audit:read:all',
        'observation:create:all', 'observation:read:all', 'observation:update:all',
        'evidence:read:all',
        'user:read:all',
        'entity:read:all',
        'report:read:all',
      ],
    },
    {
      name: 'reviewer',
      displayName: 'Reviewer',
      description: 'Review and approve evidence',
      isSystemRole: true,
      level: 50,
      permissions: [
        'audit:read:all',
        'observation:read:all', 'observation:approve:all',
        'evidence:read:all', 'evidence:approve:all',
        'user:read:all',
        'entity:read:all',
      ],
    },
    {
      name: 'observation_owner',
      displayName: 'Observation Owner',
      description: 'Manage assigned observations and upload evidence',
      isSystemRole: true,
      level: 40,
      permissions: [
        'audit:read:entity',
        'observation:read:own', 'observation:update:own',
        'evidence:create:all', 'evidence:read:own',
        'entity:read:all',
      ],
    },
    {
      name: 'executive',
      displayName: 'Executive',
      description: 'View dashboards and reports (read-only)',
      isSystemRole: true,
      level: 30,
      permissions: [
        'audit:read:all',
        'observation:read:all',
        'evidence:read:all',
        'entity:read:all',
        'report:read:all',
        'dashboard:read:all',
      ],
    },
  ];

  for (const roleData of roles) {
    const { permissions: permNames, ...roleInfo } = roleData;

    const role = await prisma.role.upsert({
      where: { name: roleInfo.name },
      update: roleInfo,
      create: roleInfo,
    });

    // Assign permissions to role
    for (const permName of permNames) {
      const [resource, action, scope] = permName.split(':');
      const permission = await prisma.permission.findUnique({
        where: { resource_action_scope: { resource, action, scope } },
      });

      if (permission) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }
  }

  // Create Risk Levels
  console.log('Creating risk levels...');
  const riskLevels = [
    { rating: 'CRITICAL' as RiskRating, name: 'Critical', colorCode: '#dc2626', slaDays: 14, sortOrder: 1 },
    { rating: 'HIGH' as RiskRating, name: 'High', colorCode: '#ea580c', slaDays: 30, sortOrder: 2 },
    { rating: 'MEDIUM' as RiskRating, name: 'Medium', colorCode: '#ca8a04', slaDays: 60, sortOrder: 3 },
    { rating: 'LOW' as RiskRating, name: 'Low', colorCode: '#16a34a', slaDays: 90, sortOrder: 4 },
    { rating: 'INFORMATIONAL' as RiskRating, name: 'Informational', colorCode: '#64748b', slaDays: 180, sortOrder: 5 },
  ];

  for (const level of riskLevels) {
    await prisma.riskLevel.upsert({
      where: { rating: level.rating },
      update: level,
      create: level,
    });
  }

  // Create Sample Entities
  console.log('Creating sample entities...');
  const entities = [
    { code: 'HQ', name: 'Headquarters', description: 'Corporate Headquarters', level: 0 },
    { code: 'IT', name: 'Information Technology', description: 'IT Department', level: 1 },
    { code: 'FIN', name: 'Finance', description: 'Finance Department', level: 1 },
    { code: 'HR', name: 'Human Resources', description: 'HR Department', level: 1 },
    { code: 'OPS', name: 'Operations', description: 'Operations Department', level: 1 },
    { code: 'SALES', name: 'Sales', description: 'Sales Department', level: 1 },
  ];

  const createdEntities: Record<string, string> = {};
  for (const entity of entities) {
    const created = await prisma.entity.upsert({
      where: { code: entity.code },
      update: entity,
      create: entity,
    });
    createdEntities[entity.code] = created.id;
  }

  // Update parent relationships
  await prisma.entity.updateMany({
    where: { code: { in: ['IT', 'FIN', 'HR', 'OPS', 'SALES'] } },
    data: { parentId: createdEntities['HQ'] },
  });

  // Create Control Domains (ISO 27001 as example)
  console.log('Creating control domains...');
  const controlDomains = [
    { code: 'A.5', name: 'Information Security Policies', framework: 'ISO 27001' },
    { code: 'A.6', name: 'Organization of Information Security', framework: 'ISO 27001' },
    { code: 'A.7', name: 'Human Resource Security', framework: 'ISO 27001' },
    { code: 'A.8', name: 'Asset Management', framework: 'ISO 27001' },
    { code: 'A.9', name: 'Access Control', framework: 'ISO 27001' },
    { code: 'A.10', name: 'Cryptography', framework: 'ISO 27001' },
    { code: 'A.11', name: 'Physical and Environmental Security', framework: 'ISO 27001' },
    { code: 'A.12', name: 'Operations Security', framework: 'ISO 27001' },
    { code: 'A.13', name: 'Communications Security', framework: 'ISO 27001' },
    { code: 'A.14', name: 'System Acquisition, Development and Maintenance', framework: 'ISO 27001' },
    { code: 'A.15', name: 'Supplier Relationships', framework: 'ISO 27001' },
    { code: 'A.16', name: 'Information Security Incident Management', framework: 'ISO 27001' },
    { code: 'A.17', name: 'Business Continuity Management', framework: 'ISO 27001' },
    { code: 'A.18', name: 'Compliance', framework: 'ISO 27001' },
  ];

  for (let i = 0; i < controlDomains.length; i++) {
    await prisma.controlDomain.upsert({
      where: { code: controlDomains[i].code },
      update: { ...controlDomains[i], sortOrder: i },
      create: { ...controlDomains[i], sortOrder: i },
    });
  }

  // Create Default Admin User
  console.log('Creating default admin user...');
  const adminPassword = await bcrypt.hash('Admin@123456', 12);

  const adminRole = await prisma.role.findUnique({ where: { name: 'system_admin' } });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@auditms.local' },
    update: {},
    create: {
      email: 'admin@auditms.local',
      passwordHash: adminPassword,
      firstName: 'System',
      lastName: 'Administrator',
      displayName: 'System Administrator',
      status: 'ACTIVE' as UserStatus,
      emailVerified: true,
      mustChangePassword: true,
    },
  });

  if (adminRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId_entityId: {
          userId: adminUser.id,
          roleId: adminRole.id,
          entityId: null as any,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    });
  }

  // Create Demo Users
  console.log('Creating demo users...');
  const demoUsers = [
    { email: 'auditor@auditms.local', firstName: 'Demo', lastName: 'Auditor', role: 'auditor' },
    { email: 'reviewer@auditms.local', firstName: 'Demo', lastName: 'Reviewer', role: 'reviewer' },
    { email: 'owner@auditms.local', firstName: 'Demo', lastName: 'Owner', role: 'observation_owner' },
    { email: 'executive@auditms.local', firstName: 'Demo', lastName: 'Executive', role: 'executive' },
  ];

  const demoPassword = await bcrypt.hash('Demo@123456', 12);

  for (const demoUser of demoUsers) {
    const role = await prisma.role.findUnique({ where: { name: demoUser.role } });

    const user = await prisma.user.upsert({
      where: { email: demoUser.email },
      update: {},
      create: {
        email: demoUser.email,
        passwordHash: demoPassword,
        firstName: demoUser.firstName,
        lastName: demoUser.lastName,
        displayName: `${demoUser.firstName} ${demoUser.lastName}`,
        status: 'ACTIVE' as UserStatus,
        emailVerified: true,
        mustChangePassword: false,
      },
    });

    if (role) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId_entityId: {
            userId: user.id,
            roleId: role.id,
            entityId: null as any,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: role.id,
        },
      });
    }
  }

  // Create SLA Rules
  console.log('Creating SLA rules...');
  const slaRules = [
    { name: 'Critical Default', riskRating: 'CRITICAL' as RiskRating, baseDays: 14, warningDays: 7, criticalDays: 3, escalationDays: 1, priority: 0 },
    { name: 'High Default', riskRating: 'HIGH' as RiskRating, baseDays: 30, warningDays: 14, criticalDays: 7, escalationDays: 3, priority: 0 },
    { name: 'Medium Default', riskRating: 'MEDIUM' as RiskRating, baseDays: 60, warningDays: 21, criticalDays: 14, escalationDays: 7, priority: 0 },
    { name: 'Low Default', riskRating: 'LOW' as RiskRating, baseDays: 90, warningDays: 30, criticalDays: 14, escalationDays: 7, priority: 0 },
    { name: 'Informational Default', riskRating: 'INFORMATIONAL' as RiskRating, baseDays: 180, warningDays: 30, criticalDays: 14, escalationDays: 7, priority: 0 },
  ];

  for (const rule of slaRules) {
    await prisma.sLARule.create({
      data: rule,
    });
  }

  console.log('✅ Database seed completed successfully!');
  console.log('');
  console.log('Default Admin Credentials:');
  console.log('  Email: admin@auditms.local');
  console.log('  Password: Admin@123456 (must be changed on first login)');
  console.log('');
  console.log('Demo User Credentials (password: Demo@123456):');
  console.log('  - auditor@auditms.local');
  console.log('  - reviewer@auditms.local');
  console.log('  - owner@auditms.local');
  console.log('  - executive@auditms.local');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
