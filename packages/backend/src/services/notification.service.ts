import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/index.js';
import logger from '../lib/logger.js';
import {
  NotificationType,
  NotificationChannel,
  NotificationPayload,
} from '../types/index.js';

// Create email transporter
const emailTransporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
  auth: config.email.user
    ? {
        user: config.email.user,
        pass: config.email.password,
      }
    : undefined,
});

// Notification templates
const NOTIFICATION_TEMPLATES: Record<NotificationType, {
  subject: string;
  emailBody: (data: Record<string, unknown>) => string;
  teamsMessage: (data: Record<string, unknown>) => TeamsMessage;
}> = {
  PASSWORD_RESET: {
    subject: 'Reset Your Audit Management Password',
    emailBody: (data) => `
      <h2>Password Reset Requested</h2>
      <p>Hello ${data.displayName || 'User'},</p>
      <p>A password reset was requested for your account.</p>
      ${data.initiatedBy ? `<p><strong>Requested by:</strong> ${data.initiatedBy}</p>` : ''}
      <p>Click the link below to set a new password:</p>
      <p><a href="${data.resetUrl}">Reset Password</a></p>
      <p>This link will expire in 1 hour.</p>
    `,
    teamsMessage: (data) => ({
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '1976D2',
      summary: 'Password Reset Requested',
      sections: [{
        activityTitle: 'Password Reset Requested',
        facts: [
          { name: 'User', value: String(data.displayName || data.email || 'User') },
          { name: 'Requested by', value: String(data.initiatedBy || 'System') },
        ],
        markdown: true,
      }],
      potentialAction: [{
        '@type': 'OpenUri',
        name: 'Reset Password',
        targets: [{ os: 'default', uri: String(data.resetUrl) }],
      }],
    }),
  },
  OBSERVATION_ASSIGNED: {
    subject: 'New Observation Assigned: {title}',
    emailBody: (data) => `
      <h2>You have been assigned a new observation</h2>
      <p><strong>Observation:</strong> ${data.observationTitle}</p>
      <p><strong>Audit:</strong> ${data.auditName}</p>
      <p><strong>Risk Rating:</strong> ${data.riskRating}</p>
      <p><strong>Due Date:</strong> ${data.targetDate}</p>
      <p><strong>Description:</strong></p>
      <p>${data.description}</p>
      <br>
      <p><a href="${data.url}">View Observation</a></p>
    `,
    teamsMessage: (data) => ({
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '0076D7',
      summary: `New Observation Assigned: ${data.observationTitle}`,
      sections: [{
        activityTitle: `New Observation Assigned`,
        activitySubtitle: `Audit: ${data.auditName}`,
        facts: [
          { name: 'Observation', value: String(data.observationTitle) },
          { name: 'Risk Rating', value: String(data.riskRating) },
          { name: 'Due Date', value: String(data.targetDate) },
        ],
        markdown: true,
      }],
      potentialAction: [{
        '@type': 'OpenUri',
        name: 'View Observation',
        targets: [{ os: 'default', uri: String(data.url) }],
      }],
    }),
  },

  DUE_DATE_REMINDER: {
    subject: 'Reminder: Observation Due Soon - {title}',
    emailBody: (data) => `
      <h2>Observation Due Date Reminder</h2>
      <p>The following observation is due in <strong>${data.daysRemaining} days</strong>:</p>
      <p><strong>Observation:</strong> ${data.observationTitle}</p>
      <p><strong>Audit:</strong> ${data.auditName}</p>
      <p><strong>Due Date:</strong> ${data.targetDate}</p>
      <br>
      <p>Please ensure you submit evidence before the due date.</p>
      <p><a href="${data.url}">View Observation</a></p>
    `,
    teamsMessage: (data) => ({
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: 'FFA500',
      summary: `Due Date Reminder: ${data.observationTitle}`,
      sections: [{
        activityTitle: `⏰ Due Date Reminder`,
        activitySubtitle: `Due in ${data.daysRemaining} days`,
        facts: [
          { name: 'Observation', value: String(data.observationTitle) },
          { name: 'Due Date', value: String(data.targetDate) },
          { name: 'Status', value: String(data.status) },
        ],
        markdown: true,
      }],
      potentialAction: [{
        '@type': 'OpenUri',
        name: 'View Observation',
        targets: [{ os: 'default', uri: String(data.url) }],
      }],
    }),
  },

  OVERDUE_ALERT: {
    subject: '⚠️ OVERDUE: Observation Past Due Date - {title}',
    emailBody: (data) => `
      <h2 style="color: #D32F2F;">⚠️ Overdue Observation Alert</h2>
      <p>The following observation is <strong>OVERDUE</strong>:</p>
      <p><strong>Observation:</strong> ${data.observationTitle}</p>
      <p><strong>Audit:</strong> ${data.auditName}</p>
      <p><strong>Original Due Date:</strong> ${data.targetDate}</p>
      <p><strong>Days Overdue:</strong> ${data.daysOverdue}</p>
      <br>
      <p style="color: #D32F2F;">Immediate action is required.</p>
      <p><a href="${data.url}">View Observation</a></p>
    `,
    teamsMessage: (data) => ({
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: 'D32F2F',
      summary: `OVERDUE: ${data.observationTitle}`,
      sections: [{
        activityTitle: `🚨 OVERDUE ALERT`,
        activitySubtitle: `${data.daysOverdue} days overdue`,
        facts: [
          { name: 'Observation', value: String(data.observationTitle) },
          { name: 'Original Due Date', value: String(data.targetDate) },
          { name: 'Days Overdue', value: String(data.daysOverdue) },
        ],
        markdown: true,
      }],
      potentialAction: [{
        '@type': 'OpenUri',
        name: 'Take Action Now',
        targets: [{ os: 'default', uri: String(data.url) }],
      }],
    }),
  },

  EVIDENCE_SUBMITTED: {
    subject: 'Evidence Submitted for Review - {title}',
    emailBody: (data) => `
      <h2>Evidence Submitted for Review</h2>
      <p>New evidence has been submitted for the following observation:</p>
      <p><strong>Observation:</strong> ${data.observationTitle}</p>
      <p><strong>Evidence:</strong> ${data.evidenceName}</p>
      <p><strong>Submitted By:</strong> ${data.submittedBy}</p>
      <br>
      <p>Please review the evidence at your earliest convenience.</p>
      <p><a href="${data.url}">Review Evidence</a></p>
    `,
    teamsMessage: (data) => ({
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '2196F3',
      summary: `Evidence Submitted: ${data.observationTitle}`,
      sections: [{
        activityTitle: `📎 Evidence Submitted`,
        activitySubtitle: `By ${data.submittedBy}`,
        facts: [
          { name: 'Observation', value: String(data.observationTitle) },
          { name: 'Evidence', value: String(data.evidenceName) },
        ],
        markdown: true,
      }],
      potentialAction: [{
        '@type': 'OpenUri',
        name: 'Review Evidence',
        targets: [{ os: 'default', uri: String(data.url) }],
      }],
    }),
  },

  EVIDENCE_REJECTED: {
    subject: 'Evidence Rejected - {title}',
    emailBody: (data) => `
      <h2 style="color: #D32F2F;">Evidence Rejected</h2>
      <p>Your submitted evidence has been rejected:</p>
      <p><strong>Observation:</strong> ${data.observationTitle}</p>
      <p><strong>Evidence:</strong> ${data.evidenceName}</p>
      <p><strong>Rejection Reason:</strong></p>
      <p style="padding: 10px; background: #FFF3E0;">${data.rejectionReason}</p>
      <br>
      <p>Please submit updated evidence addressing the reviewer's feedback.</p>
      <p><a href="${data.url}">View Observation</a></p>
    `,
    teamsMessage: (data) => ({
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: 'D32F2F',
      summary: `Evidence Rejected: ${data.observationTitle}`,
      sections: [{
        activityTitle: `❌ Evidence Rejected`,
        activitySubtitle: data.evidenceName as string,
        facts: [
          { name: 'Observation', value: String(data.observationTitle) },
          { name: 'Reason', value: String(data.rejectionReason) },
        ],
        markdown: true,
      }],
      potentialAction: [{
        '@type': 'OpenUri',
        name: 'Submit New Evidence',
        targets: [{ os: 'default', uri: String(data.url) }],
      }],
    }),
  },

  EVIDENCE_APPROVED: {
    subject: '✓ Evidence Approved - {title}',
    emailBody: (data) => `
      <h2 style="color: #4CAF50;">Evidence Approved</h2>
      <p>Your submitted evidence has been approved:</p>
      <p><strong>Observation:</strong> ${data.observationTitle}</p>
      <p><strong>Evidence:</strong> ${data.evidenceName}</p>
      <p><strong>Reviewer Comments:</strong></p>
      <p style="padding: 10px; background: #E8F5E9;">${data.reviewerComments || 'No additional comments'}</p>
      <p><a href="${data.url}">View Observation</a></p>
    `,
    teamsMessage: (data) => ({
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '4CAF50',
      summary: `Evidence Approved: ${data.observationTitle}`,
      sections: [{
        activityTitle: `✅ Evidence Approved`,
        activitySubtitle: data.evidenceName as string,
        facts: [
          { name: 'Observation', value: String(data.observationTitle) },
        ],
        markdown: true,
      }],
      potentialAction: [{
        '@type': 'OpenUri',
        name: 'View Observation',
        targets: [{ os: 'default', uri: String(data.url) }],
      }],
    }),
  },

  OBSERVATION_CLOSED: {
    subject: '✓ Observation Closed - {title}',
    emailBody: (data) => `
      <h2 style="color: #4CAF50;">Observation Closed</h2>
      <p>The following observation has been closed:</p>
      <p><strong>Observation:</strong> ${data.observationTitle}</p>
      <p><strong>Audit:</strong> ${data.auditName}</p>
      <p><strong>Closed By:</strong> ${data.closedBy}</p>
      <p><strong>Closure Date:</strong> ${data.closureDate}</p>
      <p><a href="${data.url}">View Details</a></p>
    `,
    teamsMessage: (data) => ({
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '4CAF50',
      summary: `Observation Closed: ${data.observationTitle}`,
      sections: [{
        activityTitle: `✅ Observation Closed`,
        facts: [
          { name: 'Observation', value: String(data.observationTitle) },
          { name: 'Audit', value: String(data.auditName) },
          { name: 'Closed By', value: String(data.closedBy) },
        ],
        markdown: true,
      }],
    }),
  },

  REVIEW_REQUIRED: {
    subject: 'Review Required - {title}',
    emailBody: (data) => `
      <h2>Review Required</h2>
      <p>The following observation requires your review:</p>
      <p><strong>Observation:</strong> ${data.observationTitle}</p>
      <p><strong>Audit:</strong> ${data.auditName}</p>
      <p><strong>Evidence Count:</strong> ${data.evidenceCount}</p>
      <p><a href="${data.url}">Review Now</a></p>
    `,
    teamsMessage: (data) => ({
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '9C27B0',
      summary: `Review Required: ${data.observationTitle}`,
      sections: [{
        activityTitle: `📋 Review Required`,
        facts: [
          { name: 'Observation', value: String(data.observationTitle) },
          { name: 'Evidence to Review', value: String(data.evidenceCount) },
        ],
        markdown: true,
      }],
      potentialAction: [{
        '@type': 'OpenUri',
        name: 'Review Now',
        targets: [{ os: 'default', uri: String(data.url) }],
      }],
    }),
  },

  STATUS_CHANGED: {
    subject: 'Status Changed - {title}',
    emailBody: (data) => `
      <h2>Observation Status Changed</h2>
      <p>The status of the following observation has been updated:</p>
      <p><strong>Observation:</strong> ${data.observationTitle}</p>
      <p><strong>Previous Status:</strong> ${data.previousStatus}</p>
      <p><strong>New Status:</strong> ${data.newStatus}</p>
      <p><strong>Changed By:</strong> ${data.changedBy}</p>
      <p><a href="${data.url}">View Observation</a></p>
    `,
    teamsMessage: (data) => ({
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '607D8B',
      summary: `Status Changed: ${data.observationTitle}`,
      sections: [{
        activityTitle: `🔄 Status Changed`,
        facts: [
          { name: 'Observation', value: String(data.observationTitle) },
          { name: 'From', value: String(data.previousStatus) },
          { name: 'To', value: String(data.newStatus) },
        ],
        markdown: true,
      }],
    }),
  },

  COMMENT_ADDED: {
    subject: 'New Comment - {title}',
    emailBody: (data) => `
      <h2>New Comment Added</h2>
      <p>A new comment has been added to the following observation:</p>
      <p><strong>Observation:</strong> ${data.observationTitle}</p>
      <p><strong>Comment By:</strong> ${data.commentBy}</p>
      <p><strong>Comment:</strong></p>
      <p style="padding: 10px; background: #F5F5F5;">${data.comment}</p>
      <p><a href="${data.url}">View Observation</a></p>
    `,
    teamsMessage: (data) => ({
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '795548',
      summary: `New Comment: ${data.observationTitle}`,
      sections: [{
        activityTitle: `💬 New Comment`,
        activitySubtitle: `By ${data.commentBy}`,
        text: String(data.comment),
        markdown: true,
      }],
      potentialAction: [{
        '@type': 'OpenUri',
        name: 'View Observation',
        targets: [{ os: 'default', uri: String(data.url) }],
      }],
    }),
  },
};

interface TeamsMessage {
  '@type': string;
  '@context': string;
  themeColor: string;
  summary: string;
  sections: Array<{
    activityTitle: string;
    activitySubtitle?: string;
    text?: string;
    facts?: Array<{ name: string; value: string }>;
    markdown: boolean;
  }>;
  potentialAction?: Array<{
    '@type': string;
    name: string;
    targets: Array<{ os: string; uri: string }>;
  }>;
}

export class NotificationService {
  /**
   * Send notification via specified channels
   */
  static async sendNotification(payload: NotificationPayload): Promise<void> {
    const template = NOTIFICATION_TEMPLATES[payload.type];
    if (!template) {
      logger.warn(`No template found for notification type: ${payload.type}`);
      return;
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      logger.warn(`User not found for notification: ${payload.userId}`);
      return;
    }

    // Create in-app notification
    await this.createInAppNotification(payload, user.email);

    // Send via each channel
    for (const channel of payload.channels) {
      try {
        switch (channel) {
          case 'EMAIL':
            await this.sendEmail(user.email, template, payload.data);
            break;
          case 'TEAMS':
            await this.sendTeamsMessage(template, payload.data);
            break;
          case 'IN_APP':
            // Already created above
            break;
        }
      } catch (error) {
        logger.error(`Failed to send ${channel} notification:`, error);
      }
    }
  }

  /**
   * Create in-app notification
   */
  private static async createInAppNotification(
    payload: NotificationPayload,
    userEmail: string
  ): Promise<void> {
    const template = NOTIFICATION_TEMPLATES[payload.type];

    await prisma.notification.create({
      data: {
        userId: payload.userId,
        observationId: payload.observationId,
        type: payload.type,
        channel: 'IN_APP',
        title: this.interpolate(template.subject, payload.data),
        message: this.stripHtml(template.emailBody(payload.data)),
        data: JSON.parse(JSON.stringify(payload.data)),
      },
    });
  }

  /**
   * Send email notification
   */
  private static async sendEmail(
    to: string,
    template: typeof NOTIFICATION_TEMPLATES[NotificationType],
    data: Record<string, unknown>
  ): Promise<void> {
    if (!config.email.host) {
      logger.warn('Email not configured, skipping email notification');
      return;
    }

    const subject = this.interpolate(template.subject, data);
    const html = this.wrapEmailTemplate(template.emailBody(data));

    try {
      await emailTransporter.sendMail({
        from: `"${config.email.fromName}" <${config.email.fromEmail}>`,
        to,
        subject,
        html,
      });

      logger.info(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Send Microsoft Teams message via webhook
   */
  private static async sendTeamsMessage(
    template: typeof NOTIFICATION_TEMPLATES[NotificationType],
    data: Record<string, unknown>
  ): Promise<void> {
    if (!config.teams.webhookUrl) {
      logger.warn('Teams webhook not configured, skipping Teams notification');
      return;
    }

    const message = template.teamsMessage(data);

    try {
      const response = await fetch(config.teams.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Teams webhook responded with ${response.status}`);
      }

      logger.info('Teams notification sent successfully');
    } catch (error) {
      logger.error('Failed to send Teams notification:', error);
      throw error;
    }
  }

  /**
   * Send bulk notifications (e.g., reminders)
   */
  static async sendBulkNotifications(
    notifications: NotificationPayload[]
  ): Promise<void> {
    for (const notification of notifications) {
      try {
        await this.sendNotification(notification);
      } catch (error) {
        logger.error('Failed to send bulk notification:', error);
      }
    }
  }

  /**
   * Send due date reminders
   */
  static async sendDueDateReminders(): Promise<void> {
    const reminderDays = [7, 3, 1]; // T-7, T-3, T-1

    for (const days of reminderDays) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      targetDate.setHours(0, 0, 0, 0);

      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const observations = await prisma.observation.findMany({
        where: {
          deletedAt: null,
          status: { notIn: ['CLOSED'] },
          targetDate: {
            gte: targetDate,
            lt: nextDay,
          },
          ownerId: { not: null },
        },
        include: {
          owner: true,
          audit: { select: { name: true } },
        },
      });

      for (const obs of observations) {
        if (!obs.owner) continue;

        await this.sendNotification({
          type: 'DUE_DATE_REMINDER',
          userId: obs.owner.id,
          observationId: obs.id,
          channels: ['EMAIL', 'IN_APP'],
          data: {
            observationTitle: obs.title,
            auditName: obs.audit.name,
            targetDate: obs.targetDate.toISOString().split('T')[0],
            daysRemaining: days,
            status: obs.status,
            url: `${process.env.FRONTEND_URL}/observations/${obs.id}`,
          },
        });
      }

      logger.info(`Sent ${observations.length} due date reminders for T-${days}`);
    }
  }

  /**
   * Send overdue alerts
   */
  static async sendOverdueAlerts(): Promise<void> {
    const observations = await prisma.observation.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ['CLOSED'] },
        targetDate: { lt: new Date() },
        ownerId: { not: null },
      },
      include: {
        owner: true,
        audit: { select: { name: true } },
      },
    });

    for (const obs of observations) {
      if (!obs.owner) continue;

      const daysOverdue = Math.floor(
        (Date.now() - obs.targetDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      await this.sendNotification({
        type: 'OVERDUE_ALERT',
        userId: obs.owner.id,
        observationId: obs.id,
        channels: ['EMAIL', 'TEAMS', 'IN_APP'],
        data: {
          observationTitle: obs.title,
          auditName: obs.audit.name,
          targetDate: obs.targetDate.toISOString().split('T')[0],
          daysOverdue,
          url: `${process.env.FRONTEND_URL}/observations/${obs.id}`,
        },
      });
    }

    logger.info(`Sent ${observations.length} overdue alerts`);
  }

  /**
   * Get user's notifications
   */
  static async getUserNotifications(
    userId: string,
    options: { unreadOnly?: boolean; limit?: number; offset?: number }
  ) {
    const { unreadOnly = false, limit = 20, offset = 0 } = options;

    const where: { userId: string; channel: NotificationChannel; isRead?: boolean } = {
      userId,
      channel: 'IN_APP',
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          observation: {
            select: { id: true, globalSequence: true, title: true },
          },
        },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId, channel: 'IN_APP', isRead: false },
      }),
    ]);

    return { notifications, total, unreadCount };
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Interpolate template variables
   */
  private static interpolate(
    template: string,
    data: Record<string, unknown>
  ): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => String(data[key] || ''));
  }

  /**
   * Strip HTML tags
   */
  private static stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * Wrap email body in HTML template
   */
  private static wrapEmailTemplate(body: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          h2 { color: #1976D2; }
          a { color: #1976D2; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        ${body}
        <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
        <p style="font-size: 12px; color: #666;">
          This is an automated message from the Audit Management System.
          Please do not reply to this email.
        </p>
      </body>
      </html>
    `;
  }
}
