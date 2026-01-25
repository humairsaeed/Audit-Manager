# Enterprise Audit & Compliance Observation Management System

A production-grade, secure, and scalable system for managing audits, observations, corrective actions, evidence, and regulatory compliance across large enterprises.

## 🎯 Overview

This system provides a centralized platform for:
- Managing multiple audits (Internal, External, ISO, SOC, ISR, Financial, IT)
- Tracking audit observations with full lifecycle management
- Assigning observations to responsible users with RBAC enforcement
- Collecting and reviewing evidence with versioning
- Enforcing due dates and SLAs with automated notifications
- Providing executive dashboards and compliance reporting
- Importing observations from Excel files with intelligent mapping

## 🏗️ Architecture

### Technology Stack

#### Backend Technologies

| Technology | Purpose |
|------------|---------|
| **Node.js 20** | Runtime environment |
| **Express.js** | Web framework with middleware support |
| **TypeScript** | Type-safe development |
| **Prisma ORM** | Database access & migrations |
| **PostgreSQL 16** | Primary relational database |
| **Redis** | Caching & session management |
| **JWT** | Stateless authentication tokens |
| **Zod** | Runtime request validation |
| **Winston** | Structured logging |
| **Nodemailer** | Email notifications |
| **ExcelJS** | Excel file processing |

#### Frontend Technologies

| Technology | Purpose |
|------------|---------|
| **Next.js 14** | React framework with App Router |
| **TypeScript** | Type-safe development |
| **TailwindCSS** | Utility-first CSS framework |
| **React Query** | Server state management & caching |
| **Zustand** | Client state management |
| **React Hook Form** | Form handling with validation |
| **Zod** | Client-side validation schemas |
| **Heroicons** | SVG icon library |
| **Headless UI** | Accessible UI components |

#### Infrastructure

| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **Docker Compose** | Multi-container orchestration |
| **Nginx** | Reverse proxy & SSL termination |
| **MinIO** | S3-compatible object storage |

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   Web Browser   │  │  Mobile App     │  │  API Clients    │              │
│  │   (Next.js)     │  │  (Future)       │  │  (Integration)  │              │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │
└───────────┼─────────────────────┼─────────────────────┼─────────────────────┘
            │                     │                     │
            └─────────────────────┼─────────────────────┘
                                  │ HTTPS
┌─────────────────────────────────┼───────────────────────────────────────────┐
│                        PRESENTATION LAYER                                    │
├─────────────────────────────────┼───────────────────────────────────────────┤
│                    ┌────────────▼────────────┐                              │
│                    │      Nginx Proxy        │                              │
│                    │   (SSL Termination,     │                              │
│                    │    Rate Limiting)       │                              │
│                    └────────────┬────────────┘                              │
└─────────────────────────────────┼───────────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼───────────────────────────────────────────┐
│                         APPLICATION LAYER                                    │
├─────────────────────────────────┼───────────────────────────────────────────┤
│  ┌──────────────────────────────┼──────────────────────────────────────┐    │
│  │                    ┌─────────▼─────────┐                            │    │
│  │                    │   Express.js API   │                           │    │
│  │                    │     Server         │                           │    │
│  │                    └─────────┬─────────┘                            │    │
│  │                              │                                      │    │
│  │  ┌───────────────┬───────────┼───────────┬───────────────┐         │    │
│  │  │               │           │           │               │         │    │
│  │  ▼               ▼           ▼           ▼               ▼         │    │
│  │ ┌────┐        ┌────┐      ┌────┐      ┌────┐         ┌────┐       │    │
│  │ │Auth│        │RBAC│      │Audit│     │Error│        │Rate│       │    │
│  │ │ MW │        │ MW │      │Log  │     │Handler      │Limit│       │    │
│  │ └────┘        └────┘      └────┘      └────┘         └────┘       │    │
│  │                              │                                      │    │
│  │                    ┌─────────▼─────────┐                            │    │
│  │                    │    Controllers     │                           │    │
│  │                    └─────────┬─────────┘                            │    │
│  │                              │                                      │    │
│  │                    ┌─────────▼─────────┐                            │    │
│  │                    │     Services       │                           │    │
│  │                    │  (Business Logic)  │                           │    │
│  │                    └─────────┬─────────┘                            │    │
│  └──────────────────────────────┼──────────────────────────────────────┘    │
└─────────────────────────────────┼───────────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼───────────────────────────────────────────┐
│                           DATA LAYER                                         │
├─────────────────────────────────┼───────────────────────────────────────────┤
│         ┌───────────────────────┼───────────────────────────┐               │
│         │                       │                           │               │
│         ▼                       ▼                           ▼               │
│  ┌─────────────┐       ┌───────────────┐          ┌─────────────┐          │
│  │ PostgreSQL  │       │     Redis     │          │  MinIO/S3   │          │
│  │  (Primary)  │       │   (Cache/     │          │  (Object    │          │
│  │             │       │   Sessions)   │          │   Storage)  │          │
│  └─────────────┘       └───────────────┘          └─────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Layered Architecture Pattern

```
┌────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                         │
│  • React Components      • Pages          • Hooks               │
│  • State Management      • Form Handling  • API Integration     │
├────────────────────────────────────────────────────────────────┤
│                         API LAYER                               │
│  • Route Handlers        • Request Validation                   │
│  • Response Formatting   • Error Handling                       │
├────────────────────────────────────────────────────────────────┤
│                       SERVICE LAYER                             │
│  • Business Logic        • Domain Rules                         │
│  • Transaction Management• External Integrations                │
├────────────────────────────────────────────────────────────────┤
│                    DATA ACCESS LAYER                            │
│  • Prisma ORM            • Query Building                       │
│  • Soft Deletes          • Audit Logging                        │
├────────────────────────────────────────────────────────────────┤
│                     INFRASTRUCTURE                              │
│  • Database              • File Storage                         │
│  • Cache                 • Email/Notifications                  │
└────────────────────────────────────────────────────────────────┘
```

### Observation Status Workflow

```
┌──────────┐    ┌─────────────┐    ┌────────────────────┐
│   OPEN   │───>│ IN_PROGRESS │───>│ EVIDENCE_SUBMITTED │
└──────────┘    └─────────────┘    └──────────┬─────────┘
                                              │
                     ┌────────────────────────┤
                     │                        ▼
                     │               ┌───────────────┐
                     │               │ UNDER_REVIEW  │
                     │               └───────┬───────┘
                     │                       │
                     │         ┌─────────────┴─────────────┐
                     │         ▼                           ▼
                     │    ┌──────────┐              ┌──────────┐
                     └────│ REJECTED │              │  CLOSED  │
                          └──────────┘              └──────────┘
```

## 👥 Role-Based Access Control (RBAC)

### Predefined Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| System Admin | Full system access | All permissions |
| Audit Admin | Manage audits and users | Create/Edit audits, import, manage users |
| Compliance Manager | Review and approve | Approve evidence, generate reports |
| Auditor | Create observations | Create/Edit observations |
| Reviewer | Review evidence | Approve/Reject evidence |
| Observation Owner | Manage assigned items | Update own observations, upload evidence |
| Executive | Read-only dashboards | View reports and dashboards |

### Permission System

Permissions follow the pattern: `resource:action:scope`
- **Resources**: audit, observation, evidence, user, entity, import, report, dashboard
- **Actions**: create, read, update, delete, approve, assign, export
- **Scopes**: all, entity, team, own

## 📂 Database Schema (ERD)

### Core Entities

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│    User     │────<│  UserRole   │>────│      Role       │
└─────────────┘     └─────────────┘     └────────┬────────┘
      │                                          │
      │                                 ┌────────▼────────┐
      │                                 │ RolePermission  │
      │                                 └────────┬────────┘
      │                                          │
      │                                 ┌────────▼────────┐
      │                                 │   Permission    │
      │                                 └─────────────────┘
      │
      │         ┌─────────────┐
      └────────>│    Audit    │
                └──────┬──────┘
                       │
                ┌──────▼──────┐
                │ Observation │─────────>┌─────────────┐
                └──────┬──────┘          │   Entity    │
                       │                 └─────────────┘
          ┌────────────┼────────────┐
          │            │            │
   ┌──────▼──────┐ ┌───▼───┐ ┌─────▼─────┐
   │  Evidence   │ │Comment│ │ReviewCycle│
   └─────────────┘ └───────┘ └───────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd audit-management
   ```

2. **Start infrastructure services**
   ```bash
   docker-compose up -d postgres redis minio
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Setup environment variables**
   ```bash
   cp packages/backend/.env.example packages/backend/.env
   # Edit .env with your settings
   ```

5. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

6. **Seed the database**
   ```bash
   npm run db:seed
   ```

7. **Start development servers**
   ```bash
   npm run dev
   ```

8. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001/api/v1
   - MinIO Console: http://localhost:9001

### Default Credentials

| User | Email | Password | Role |
|------|-------|----------|------|
| Admin | admin@auditms.local | Admin@123456 | System Admin |
| Auditor | auditor@auditms.local | Demo@123456 | Auditor |
| Reviewer | reviewer@auditms.local | Demo@123456 | Reviewer |
| Owner | owner@auditms.local | Demo@123456 | Observation Owner |
| Executive | executive@auditms.local | Demo@123456 | Executive |

## 🐳 Docker Deployment

### Production Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Environment Variables

```env
# Database
DB_USER=postgres
DB_PASSWORD=secure_password
DB_NAME=audit_management

# JWT (generate secure random strings)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars

# MinIO
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Email (optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASSWORD=password

# Teams Webhook (optional)
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...
```

## 📥 Excel Import Feature

### Supported Formats
- .xlsx, .xls
- Up to 10,000 rows per import

### Auto-Detection

The system automatically detects and maps common column headers:

| Excel Header Examples | Maps To |
|----------------------|---------|
| NC Ref, Finding Ref, Observation Ref | externalReference |
| Finding, Observation Description | description |
| Risk, Severity, Priority | riskRating |
| Responsible, Owner, Assigned To | responsibleParty |
| Due Date, Target Date, Deadline | targetDate |
| Review Comments Q4 2024 | reviewCycle |

### Import Workflow

1. Upload Excel file
2. System auto-detects columns
3. Review/adjust mapping
4. Preview data validation
5. Execute import
6. View import results

## 📊 API Documentation

### Authentication Endpoints

```
POST /api/v1/auth/login        - User login
POST /api/v1/auth/logout       - User logout
POST /api/v1/auth/refresh      - Refresh access token
GET  /api/v1/auth/me           - Get current user
POST /api/v1/auth/change-password - Change password
```

### Audit Endpoints

```
GET    /api/v1/audits          - List audits
POST   /api/v1/audits          - Create audit
GET    /api/v1/audits/:id      - Get audit
PUT    /api/v1/audits/:id      - Update audit
DELETE /api/v1/audits/:id      - Delete audit
PATCH  /api/v1/audits/:id/status - Update status
```

### Observation Endpoints

```
GET    /api/v1/observations         - List observations
POST   /api/v1/observations         - Create observation
GET    /api/v1/observations/:id     - Get observation
PUT    /api/v1/observations/:id     - Update observation
DELETE /api/v1/observations/:id     - Delete observation
PATCH  /api/v1/observations/:id/status - Update status
POST   /api/v1/observations/:id/assign-owner - Assign owner
POST   /api/v1/observations/:id/comments - Add comment
```

### Evidence Endpoints

```
GET    /api/v1/evidence/observation/:id  - List evidence
POST   /api/v1/evidence                  - Upload evidence
GET    /api/v1/evidence/:id/download     - Get download URL
POST   /api/v1/evidence/:id/review       - Review evidence
```

### Import Endpoints

```
POST /api/v1/import/upload           - Upload Excel file
POST /api/v1/import/:jobId/validate  - Validate import
POST /api/v1/import/:jobId/execute   - Execute import
GET  /api/v1/import/:jobId/status    - Get import status
POST /api/v1/import/:jobId/rollback  - Rollback import
```

## 🔐 Security Features

- **Authentication**: JWT-based with refresh tokens
- **Authorization**: Fine-grained RBAC
- **Password Policy**: Configurable complexity requirements
- **Account Lockout**: After failed login attempts
- **Session Management**: Secure session handling
- **Audit Logging**: Complete audit trail
- **File Security**: No public URLs, signed downloads
- **Input Validation**: Zod schema validation
- **SQL Injection**: Prevented via Prisma ORM
- **XSS Protection**: React's built-in escaping + CSP headers

## 🔔 Notifications

### Notification Types
- Observation assigned
- Due date reminders (T-7, T-3, T-1)
- Overdue alerts
- Evidence submitted
- Evidence approved/rejected
- Observation closed
- Status changes
- Comments added

### Channels
- In-app notifications
- Email (SMTP)
- Microsoft Teams (Webhook)

## 📁 Project Structure

```
audit-management/
├── packages/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/         # Configuration
│   │   │   ├── lib/            # Database, logger
│   │   │   ├── middleware/     # Auth, RBAC, error handling
│   │   │   ├── routes/         # API routes
│   │   │   ├── services/       # Business logic
│   │   │   ├── types/          # TypeScript types
│   │   │   └── index.ts        # Entry point
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Database schema
│   │   │   └── seed.ts         # Database seeding
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── frontend/
│       ├── src/
│       │   ├── app/            # Next.js app router pages
│       │   ├── components/     # React components
│       │   ├── lib/            # API client
│       │   └── stores/         # Zustand stores
│       ├── Dockerfile
│       └── package.json
│
├── docker-compose.yml          # Container orchestration
├── package.json                # Monorepo root
└── README.md                   # This file
```

## 🔧 Development Commands

```bash
# Start all services
npm run dev

# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend

# Database commands
npm run db:migrate      # Run migrations
npm run db:seed         # Seed database
npm run db:studio       # Open Prisma Studio

# Build
npm run build

# Docker
npm run docker:build    # Build images
npm run docker:up       # Start containers
npm run docker:down     # Stop containers
```

## 📈 Monitoring & Logging

### Log Files
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- `logs/audit.log` - Security audit trail

### Health Checks
- Backend: `GET /health`
- All Docker containers include health checks

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and feature requests, please use the GitHub issue tracker.

---

Built with ❤️ for enterprise audit and compliance teams.
