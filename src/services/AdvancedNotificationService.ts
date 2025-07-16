import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { NotificationService } from './NotificationService';
import { ContributionService } from './ContributionService';

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  type: 'amount_threshold' | 'time_based' | 'member_activity' | 'goal_progress' | 'inactivity';
  conditions: AlertCondition[];
  actions: AlertAction[];
  schedule?: ScheduleConfig;
  cooldown?: number; // Minutes between same alert
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  lastTriggered?: string;
}

export interface AlertCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'between';
  value: any;
  timeframe?: number; // Hours
}

export interface AlertAction {
  type: 'whatsapp' | 'push' | 'email' | 'webhook';
  template: string;
  recipients?: string[];
  webhookUrl?: string;
}

export interface ScheduleConfig {
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  time: string; // HH:MM format
  days?: number[]; // 0-6 for weekly, 1-31 for monthly
  timezone: string;
  enabled: boolean;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'contribution' | 'report' | 'alert' | 'reminder';
  subject: string;
  body: string;
  variables: string[];
  createdAt: string;
}

export interface ScheduledNotification {
  id: string;
  type: 'daily_report' | 'weekly_summary' | 'monthly_report' | 'custom_alert';
  schedule: ScheduleConfig;
  template: string;
  recipients: string[];
  enabled: boolean;
  lastSent?: string;
  nextScheduled: string;
}

class AdvancedNotificationServiceClass {
  private alertRules: AlertRule[] = [];
  private templates: NotificationTemplate[] = [];
  private scheduledNotifications: ScheduledNotification[] = [];
  private activeAlerts: Map<string, number> = new Map(); // Rule ID -> last triggered timestamp

  private readonly ALERT_RULES_KEY = 'alertRules';
  private readonly TEMPLATES_KEY = 'notificationTemplates';
  private readonly SCHEDULED_KEY = 'scheduledNotifications';

  async initialize() {
    await this.loadAlertRules();
    await this.loadTemplates();
    await this.loadScheduledNotifications();
    await this.setupDefaultTemplates();
    await this.scheduleAllNotifications();
    
    // Start monitoring for rule triggers
    this.startRuleMonitoring();
    
    console.log('AdvancedNotificationService initialized');
  }

  // Alert Rules Management
  async createAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt'>): Promise<string> {
    const newRule: AlertRule = {
      ...rule,
      id: `rule_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    this.alertRules.push(newRule);
    await this.saveAlertRules();
    
    if (newRule.enabled) {
      await this.activateRule(newRule.id);
    }

    return newRule.id;
  }

  async updateAlertRule(id: string, updates: Partial<AlertRule>) {
    const index = this.alertRules.findIndex(rule => rule.id === id);
    if (index === -1) throw new Error('Alert rule not found');

    const wasEnabled = this.alertRules[index].enabled;
    this.alertRules[index] = { ...this.alertRules[index], ...updates };
    
    await this.saveAlertRules();

    // Handle enable/disable state changes
    if (wasEnabled && !this.alertRules[index].enabled) {
      await this.deactivateRule(id);
    } else if (!wasEnabled && this.alertRules[index].enabled) {
      await this.activateRule(id);
    }
  }

  async deleteAlertRule(id: string) {
    await this.deactivateRule(id);
    this.alertRules = this.alertRules.filter(rule => rule.id !== id);
    await this.saveAlertRules();
  }

  async getAlertRules(): Promise<AlertRule[]> {
    return [...this.alertRules];
  }

  // Template Management
  async createTemplate(template: Omit<NotificationTemplate, 'id' | 'createdAt'>): Promise<string> {
    const newTemplate: NotificationTemplate = {
      ...template,
      id: `template_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    this.templates.push(newTemplate);
    await this.saveTemplates();
    return newTemplate.id;
  }

  async updateTemplate(id: string, updates: Partial<NotificationTemplate>) {
    const index = this.templates.findIndex(template => template.id === id);
    if (index === -1) throw new Error('Template not found');

    this.templates[index] = { ...this.templates[index], ...updates };
    await this.saveTemplates();
  }

  async deleteTemplate(id: string) {
    this.templates = this.templates.filter(template => template.id !== id);
    await this.saveTemplates();
  }

  async getTemplates(): Promise<NotificationTemplate[]> {
    return [...this.templates];
  }

  // Scheduled Notifications Management
  async createScheduledNotification(notification: Omit<ScheduledNotification, 'id' | 'nextScheduled'>): Promise<string> {
    const nextScheduled = this.calculateNextSchedule(notification.schedule);
    const newNotification: ScheduledNotification = {
      ...notification,
      id: `scheduled_${Date.now()}`,
      nextScheduled: nextScheduled.toISOString(),
    };

    this.scheduledNotifications.push(newNotification);
    await this.saveScheduledNotifications();
    
    if (newNotification.enabled) {
      await this.scheduleNotification(newNotification);
    }

    return newNotification.id;
  }

  async updateScheduledNotification(id: string, updates: Partial<ScheduledNotification>) {
    const index = this.scheduledNotifications.findIndex(notif => notif.id === id);
    if (index === -1) throw new Error('Scheduled notification not found');

    const wasEnabled = this.scheduledNotifications[index].enabled;
    this.scheduledNotifications[index] = { ...this.scheduledNotifications[index], ...updates };
    
    // Recalculate next schedule if schedule config changed
    if (updates.schedule) {
      this.scheduledNotifications[index].nextScheduled = 
        this.calculateNextSchedule(this.scheduledNotifications[index].schedule).toISOString();
    }

    await this.saveScheduledNotifications();

    // Handle enable/disable state changes
    if (wasEnabled && !this.scheduledNotifications[index].enabled) {
      await this.cancelScheduledNotification(id);
    } else if (!wasEnabled && this.scheduledNotifications[index].enabled) {
      await this.scheduleNotification(this.scheduledNotifications[index]);
    }
  }

  async deleteScheduledNotification(id: string) {
    await this.cancelScheduledNotification(id);
    this.scheduledNotifications = this.scheduledNotifications.filter(notif => notif.id !== id);
    await this.saveScheduledNotifications();
  }

  // Rule Processing
  private startRuleMonitoring() {
    // Check rules every minute
    setInterval(async () => {
      await this.processAlertRules();
    }, 60000);

    // Also check immediately
    this.processAlertRules();
  }

  private async processAlertRules() {
    const enabledRules = this.alertRules.filter(rule => rule.enabled);
    
    for (const rule of enabledRules) {
      try {
        if (await this.shouldTriggerRule(rule)) {
          await this.triggerRule(rule);
        }
      } catch (error) {
        console.error(`Error processing rule ${rule.id}:`, error);
      }
    }
  }

  private async shouldTriggerRule(rule: AlertRule): Promise<boolean> {
    // Check cooldown
    const lastTriggered = this.activeAlerts.get(rule.id);
    if (lastTriggered && rule.cooldown) {
      const cooldownMs = rule.cooldown * 60 * 1000;
      if (Date.now() - lastTriggered < cooldownMs) {
        return false;
      }
    }

    // Check conditions
    for (const condition of rule.conditions) {
      if (!(await this.evaluateCondition(condition))) {
        return false;
      }
    }

    return true;
  }

  private async evaluateCondition(condition: AlertCondition): Promise<boolean> {
    const contributions = await ContributionService.getRecentContributions(
      condition.timeframe || 24
    );

    switch (condition.field) {
      case 'total_amount':
        const totalAmount = contributions.reduce((sum, c) => sum + c.amount, 0);
        return this.compareValues(totalAmount, condition.operator, condition.value);

      case 'contribution_count':
        return this.compareValues(contributions.length, condition.operator, condition.value);

      case 'average_amount':
        const avgAmount = contributions.length > 0 
          ? contributions.reduce((sum, c) => sum + c.amount, 0) / contributions.length 
          : 0;
        return this.compareValues(avgAmount, condition.operator, condition.value);

      case 'unique_contributors':
        const uniqueCount = new Set(contributions.map(c => c.memberId)).size;
        return this.compareValues(uniqueCount, condition.operator, condition.value);

      case 'platform_usage':
        const platformCount = contributions.filter(c => c.platform === condition.value).length;
        return this.compareValues(platformCount, condition.operator, condition.value);

      case 'member_activity':
        const memberContributions = contributions.filter(c => c.memberId === condition.value);
        return this.compareValues(memberContributions.length, condition.operator, condition.value);

      case 'time_since_last':
        if (contributions.length === 0) return true;
        const lastContribution = new Date(contributions[0].date);
        const hoursSince = (Date.now() - lastContribution.getTime()) / (1000 * 60 * 60);
        return this.compareValues(hoursSince, condition.operator, condition.value);

      default:
        return false;
    }
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'greater_than':
        return actual > expected;
      case 'less_than':
        return actual < expected;
      case 'contains':
        return String(actual).toLowerCase().includes(String(expected).toLowerCase());
      case 'between':
        return actual >= expected.min && actual <= expected.max;
      default:
        return false;
    }
  }

  private async triggerRule(rule: AlertRule) {
    console.log(`Triggering rule: ${rule.name}`);
    
    // Update last triggered
    this.activeAlerts.set(rule.id, Date.now());
    rule.lastTriggered = new Date().toISOString();
    await this.saveAlertRules();

    // Execute actions
    for (const action of rule.actions) {
      try {
        await this.executeAction(action, rule);
      } catch (error) {
        console.error(`Error executing action for rule ${rule.id}:`, error);
      }
    }
  }

  private async executeAction(action: AlertAction, rule: AlertRule) {
    const message = await this.processTemplate(action.template, rule);

    switch (action.type) {
      case 'whatsapp':
        await NotificationService.sendWhatsAppAlert(message, 'alert');
        break;

      case 'push':
        await NotificationService.sendPushNotification(
          `Alert: ${rule.name}`,
          message,
          { ruleId: rule.id, priority: rule.priority }
        );
        break;

      case 'webhook':
        if (action.webhookUrl) {
          await fetch(action.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rule: rule.name,
              message,
              priority: rule.priority,
              timestamp: new Date().toISOString(),
            }),
          });
        }
        break;
    }
  }

  private async processTemplate(templateId: string, rule: AlertRule): Promise<string> {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return `Alert triggered: ${rule.name}`;

    let message = template.body;
    const contributions = await ContributionService.getRecentContributions(24);
    
    // Replace variables
    const variables = {
      '{rule_name}': rule.name,
      '{timestamp}': new Date().toLocaleString(),
      '{total_amount}': contributions.reduce((sum, c) => sum + c.amount, 0).toFixed(2),
      '{contribution_count}': contributions.length.toString(),
      '{unique_contributors}': new Set(contributions.map(c => c.memberId)).size.toString(),
      '{latest_contribution}': contributions.length > 0 ? 
        `$${contributions[0].amount} from ${contributions[0].memberName}` : 'None',
    };

    for (const [variable, value] of Object.entries(variables)) {
      message = message.replace(new RegExp(variable, 'g'), value);
    }

    return message;
  }

  // Scheduling Logic
  private calculateNextSchedule(schedule: ScheduleConfig): Date {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    
    let nextDate = new Date(now);
    nextDate.setHours(hours, minutes, 0, 0);

    switch (schedule.type) {
      case 'daily':
        if (nextDate <= now) {
          nextDate.setDate(nextDate.getDate() + 1);
        }
        break;

      case 'weekly':
        if (schedule.days && schedule.days.length > 0) {
          const currentDay = now.getDay();
          let nextDay = schedule.days.find(day => day > currentDay) || schedule.days[0];
          
          if (nextDay <= currentDay && nextDate <= now) {
            nextDay = schedule.days[0];
            nextDate.setDate(nextDate.getDate() + (7 - currentDay + nextDay));
          } else if (nextDay > currentDay) {
            nextDate.setDate(nextDate.getDate() + (nextDay - currentDay));
          } else if (nextDate <= now) {
            nextDate.setDate(nextDate.getDate() + 7);
          }
        }
        break;

      case 'monthly':
        if (schedule.days && schedule.days.length > 0) {
          const currentDate = now.getDate();
          let nextDay = schedule.days.find(day => day > currentDate) || schedule.days[0];
          
          if (nextDay <= currentDate && nextDate <= now) {
            nextDate.setMonth(nextDate.getMonth() + 1, nextDay);
          } else if (nextDay > currentDate) {
            nextDate.setDate(nextDay);
          } else if (nextDate <= now) {
            nextDate.setMonth(nextDate.getMonth() + 1);
          }
        }
        break;
    }

    return nextDate;
  }

  private async scheduleNotification(notification: ScheduledNotification) {
    const nextSchedule = new Date(notification.nextScheduled);
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `TRUEFAM ${notification.type.replace('_', ' ').toUpperCase()}`,
        body: 'Scheduled notification ready',
        data: { 
          scheduledId: notification.id,
          type: notification.type,
        },
      },
      trigger: {
        date: nextSchedule,
      },
      identifier: `scheduled_${notification.id}`,
    });

    console.log(`Scheduled notification ${notification.id} for ${nextSchedule}`);
  }

  private async cancelScheduledNotification(id: string) {
    await Notifications.cancelScheduledNotificationAsync(`scheduled_${id}`);
  }

  private async scheduleAllNotifications() {
    const enabled = this.scheduledNotifications.filter(n => n.enabled);
    
    for (const notification of enabled) {
      await this.scheduleNotification(notification);
    }
  }

  // Default Templates Setup
  private async setupDefaultTemplates() {
    if (this.templates.length === 0) {
      const defaultTemplates: Omit<NotificationTemplate, 'id' | 'createdAt'>[] = [
        {
          name: 'High Amount Alert',
          type: 'alert',
          subject: 'Large Contribution Received',
          body: '🚨 HIGH AMOUNT ALERT\n\nRule: {rule_name}\nTime: {timestamp}\n\nLatest: {latest_contribution}\nTotal Today: ${total_amount}\nContributions: {contribution_count}',
          variables: ['{rule_name}', '{timestamp}', '{latest_contribution}', '{total_amount}', '{contribution_count}'],
        },
        {
          name: 'Daily Summary',
          type: 'report',
          subject: 'Daily Contribution Summary',
          body: '📊 DAILY SUMMARY\n\nTotal Amount: ${total_amount}\nContributions: {contribution_count}\nUnique Contributors: {unique_contributors}\n\nGenerated: {timestamp}',
          variables: ['{total_amount}', '{contribution_count}', '{unique_contributors}', '{timestamp}'],
        },
        {
          name: 'Inactivity Alert',
          type: 'alert',
          subject: 'No Recent Contributions',
          body: '⚠️ INACTIVITY ALERT\n\nNo contributions received recently.\nLast contribution: {latest_contribution}\n\nTime: {timestamp}',
          variables: ['{latest_contribution}', '{timestamp}'],
        },
        {
          name: 'Goal Progress',
          type: 'alert',
          subject: 'Goal Progress Update',
          body: '🎯 GOAL PROGRESS\n\nCurrent Total: ${total_amount}\nContributions: {contribution_count}\nActive Members: {unique_contributors}\n\nUpdated: {timestamp}',
          variables: ['{total_amount}', '{contribution_count}', '{unique_contributors}', '{timestamp}'],
        },
      ];

      for (const template of defaultTemplates) {
        await this.createTemplate(template);
      }
    }
  }

  // Storage Methods
  private async saveAlertRules() {
    await AsyncStorage.setItem(this.ALERT_RULES_KEY, JSON.stringify(this.alertRules));
  }

  private async loadAlertRules() {
    try {
      const stored = await AsyncStorage.getItem(this.ALERT_RULES_KEY);
      if (stored) {
        this.alertRules = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading alert rules:', error);
    }
  }

  private async saveTemplates() {
    await AsyncStorage.setItem(this.TEMPLATES_KEY, JSON.stringify(this.templates));
  }

  private async loadTemplates() {
    try {
      const stored = await AsyncStorage.getItem(this.TEMPLATES_KEY);
      if (stored) {
        this.templates = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }

  private async saveScheduledNotifications() {
    await AsyncStorage.setItem(this.SCHEDULED_KEY, JSON.stringify(this.scheduledNotifications));
  }

  private async loadScheduledNotifications() {
    try {
      const stored = await AsyncStorage.getItem(this.SCHEDULED_KEY);
      if (stored) {
        this.scheduledNotifications = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading scheduled notifications:', error);
    }
  }

  // Utility Methods
  async activateRule(ruleId: string) {
    console.log(`Activating rule: ${ruleId}`);
    // Rule is now active and will be checked in the monitoring loop
  }

  async deactivateRule(ruleId: string) {
    console.log(`Deactivating rule: ${ruleId}`);
    this.activeAlerts.delete(ruleId);
  }

  async getAlertHistory(limit: number = 50): Promise<any[]> {
    // In a real implementation, you'd store alert history
    return this.alertRules
      .filter(rule => rule.lastTriggered)
      .sort((a, b) => new Date(b.lastTriggered!).getTime() - new Date(a.lastTriggered!).getTime())
      .slice(0, limit)
      .map(rule => ({
        ruleId: rule.id,
        ruleName: rule.name,
        triggeredAt: rule.lastTriggered,
        priority: rule.priority,
      }));
  }

  async testRule(ruleId: string): Promise<boolean> {
    const rule = this.alertRules.find(r => r.id === ruleId);
    if (!rule) throw new Error('Rule not found');

    return await this.shouldTriggerRule(rule);
  }

  async getScheduledNotifications(): Promise<ScheduledNotification[]> {
    return [...this.scheduledNotifications];
  }
}

export const AdvancedNotificationService = new AdvancedNotificationServiceClass();
