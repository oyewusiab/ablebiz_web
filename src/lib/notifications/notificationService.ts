import { supabase } from '../supabaseClient';
import type { CanonicalStaffRole } from '../../auth/roleConfig';
import type {
  SuiteNotification,
  StaffNotificationPreference,
  EscalationRule,
  EscalationLog,
  NotificationCategory,
  NotificationPriority,
  EscalationEventType,
} from '../../types/suitePhases15To19';

export const ABLEBIZ_OFFICIAL_EMAIL = 'hello@ablebiz.com.ng';

export const DEFAULT_CATEGORIES: NotificationCategory[] = [
  'tasks',
  'sla',
  'finance',
  'cac',
  'approvals',
  'appointments',
  'quotations',
  'compliance',
  'system',
  'backup',
];

export interface EmitNotificationInput {
  recipient_staff_id: string;
  title: string;
  message: string;
  link?: string | null;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  event_type?: string | null;
  record_id?: string | null;
  record_type?: string | null;
  action_url?: string | null;
  metadata?: Record<string, any>;
  deduplicate_window_hours?: number; // 0 = no window check
}

/**
 * Fetch staff notifications with optional category and unread filters
 */
export async function fetchStaffNotifications(
  staffId: string,
  category?: NotificationCategory | 'all',
  unreadOnly: boolean = false
): Promise<SuiteNotification[]> {
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('recipient_staff_id', staffId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[Notifications] Error fetching notifications:', error.message);
      return [];
    }
    return (data || []) as SuiteNotification[];
  } catch (err) {
    console.error('[Notifications] Unexpected fetch error:', err);
    return [];
  }
}

/**
 * Fetch unread notification count
 */
export async function fetchUnreadNotificationCount(staffId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_staff_id', staffId)
      .eq('is_read', false);

    if (error) {
      console.warn('[Notifications] Count error:', error.message);
      return 0;
    }
    return count || 0;
  } catch {
    return 0;
  }
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Mark all notifications for staff as read
 */
export async function markAllNotificationsAsRead(staffId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('recipient_staff_id', staffId)
      .eq('is_read', false);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Idempotently emit a notification, checking for duplicate events within window
 */
export async function emitNotification(input: EmitNotificationInput): Promise<SuiteNotification | null> {
  try {
    const category = input.category || 'system';
    const priority = input.priority || 'normal';
    const windowHours = input.deduplicate_window_hours ?? 24;

    // Deduplication check if event_type and record_id are provided
    if (input.event_type && input.record_id && windowHours > 0) {
      const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from('notifications')
        .select('id, created_at')
        .eq('recipient_staff_id', input.recipient_staff_id)
        .eq('event_type', input.event_type)
        .eq('record_id', input.record_id)
        .gte('created_at', since)
        .limit(1);

      if (existing && existing.length > 0) {
        // Notification already emitted within window
        return null;
      }
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        recipient_staff_id: input.recipient_staff_id,
        title: input.title,
        message: input.message,
        link: input.link || input.action_url || null,
        priority,
        category,
        event_type: input.event_type || null,
        record_id: input.record_id || null,
        record_type: input.record_type || null,
        action_url: input.action_url || input.link || null,
        metadata: input.metadata || {},
        is_read: false,
      })
      .select()
      .single();

    if (error) {
      console.warn('[Notifications] Emit error:', error.message);
      return null;
    }
    return data as SuiteNotification;
  } catch (err) {
    console.error('[Notifications] Failed to emit notification:', err);
    return null;
  }
}

/**
 * Fetch staff notification preferences
 */
export async function fetchStaffPreferences(staffId: string): Promise<StaffNotificationPreference> {
  const defaultPrefs: StaffNotificationPreference = {
    staff_id: staffId,
    in_app_enabled: true,
    email_enabled: true,
    whatsapp_enabled: true,
    subscribed_categories: [...DEFAULT_CATEGORIES],
    reminder_frequency: 'immediate',
    quiet_hours_enabled: false,
    quiet_hours_start: '20:00:00',
    quiet_hours_end: '07:00:00',
  };

  try {
    const { data, error } = await supabase
      .from('staff_notification_preferences')
      .select('*')
      .eq('staff_id', staffId)
      .single();

    if (error || !data) {
      return defaultPrefs;
    }
    return data as StaffNotificationPreference;
  } catch {
    return defaultPrefs;
  }
}

/**
 * Update staff notification preferences
 */
export async function updateStaffPreferences(
  prefs: Partial<StaffNotificationPreference> & { staff_id: string }
): Promise<StaffNotificationPreference> {
  try {
    const { data, error } = await supabase
      .from('staff_notification_preferences')
      .upsert(
        {
          ...prefs,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'staff_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data as StaffNotificationPreference;
  } catch (err) {
    console.error('[Notifications] Preferences update error:', err);
    throw err;
  }
}

/**
 * Fetch all escalation rules
 */
export async function fetchEscalationRules(): Promise<EscalationRule[]> {
  try {
    const { data, error } = await supabase
      .from('escalation_rules')
      .select('*')
      .order('name');

    if (error) {
      console.warn('[Escalation] Error fetching rules:', error.message);
      return [];
    }
    return (data || []) as EscalationRule[];
  } catch {
    return [];
  }
}

/**
 * Update or save an escalation rule
 */
export async function saveEscalationRule(rule: Partial<EscalationRule>): Promise<EscalationRule | null> {
  try {
    const { data, error } = await supabase
      .from('escalation_rules')
      .upsert({
        ...rule,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as EscalationRule;
  } catch (err) {
    console.error('[Escalation] Save rule error:', err);
    return null;
  }
}

/**
 * Fetch escalation audit logs
 */
export async function fetchEscalationLogs(): Promise<EscalationLog[]> {
  try {
    const { data, error } = await supabase
      .from('escalation_logs')
      .select('*')
      .order('triggered_at', { ascending: false })
      .limit(100);

    if (error) return [];
    return (data || []) as EscalationLog[];
  } catch {
    return [];
  }
}

/**
 * Generates an official WhatsApp click-to-chat URL with plain label.
 * NOTE: This is an operator preparation link, not automated background delivery.
 */
export function buildWhatsAppPreparationLink(phone: string, text: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const targetPhone = cleanPhone.startsWith('0')
    ? '234' + cleanPhone.slice(1)
    : cleanPhone.startsWith('234')
    ? cleanPhone
    : '234' + cleanPhone;

  return `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * Evaluates pending operational records against escalation rules.
 * Generates idempotent escalation notifications to responsible and escalated roles.
 */
export async function evaluateOperationalEscalations(): Promise<{
  evaluated: number;
  escalationsTriggered: number;
}> {
  let escalationsTriggered = 0;
  let evaluated = 0;

  try {
    const rules = await fetchEscalationRules();
    const activeRules = rules.filter((r) => r.is_active);

    // 1. Task Overdue Escalation Rule
    const taskRule = activeRules.find((r) => r.event_type === 'task_overdue');
    if (taskRule) {
      const now = new Date().toISOString();
      const { data: overdueTasks } = await supabase
        .from('tasks')
        .select('id, title, assigned_to, due_date, priority')
        .lt('due_date', now)
        .neq('status', 'completed')
        .neq('status', 'cancelled')
        .limit(20);

      if (overdueTasks) {
        evaluated += overdueTasks.length;
        // Find managers to escalate to
        const { data: managers } = await supabase
          .from('staff_profiles')
          .select('id, full_name, role')
          .in('role', ['operations_manager', 'super_admin', 'admin'])
          .eq('is_active', true);

        for (const task of overdueTasks) {
          for (const mgr of managers || []) {
            const notif = await emitNotification({
              recipient_staff_id: mgr.id,
              title: `Task Escalation: ${task.title}`,
              message: `Task is overdue past scheduled deadline. Immediate operational attention required.`,
              link: `/admin/tasks?taskId=${task.id}`,
              priority: 'high',
              category: 'tasks',
              event_type: 'task_overdue',
              record_id: task.id,
              record_type: 'task',
              deduplicate_window_hours: taskRule.repeat_interval_hours || 24,
            });

            if (notif) {
              escalationsTriggered++;
              await supabase.from('escalation_logs').insert({
                rule_id: taskRule.id,
                event_type: 'task_overdue',
                record_id: task.id,
                escalation_level: 1,
                recipient_staff_id: mgr.id,
                recipient_role: mgr.role,
                title: notif.title,
                message: notif.message,
                notification_id: notif.id,
              });
            }
          }
        }
      }
    }

    // 2. Pending Approval Stagnation Rule
    const approvalRule = activeRules.find((r) => r.event_type === 'approval_pending');
    if (approvalRule) {
      const thresholdHours = approvalRule.time_threshold_hours || 48;
      const thresholdTime = new Date(Date.now() - thresholdHours * 60 * 60 * 1000).toISOString();

      const { data: stagnantApprovals } = await supabase
        .from('approval_requests')
        .select('id, reference_number, title, created_at, requested_by')
        .eq('status', 'pending_approval')
        .lt('created_at', thresholdTime)
        .limit(10);

      if (stagnantApprovals) {
        evaluated += stagnantApprovals.length;
        const { data: execs } = await supabase
          .from('staff_profiles')
          .select('id, role')
          .in('role', ['super_admin', 'admin'])
          .eq('is_active', true);

        for (const req of stagnantApprovals) {
          for (const exec of execs || []) {
            const notif = await emitNotification({
              recipient_staff_id: exec.id,
              title: `Approval Stagnation: ${req.reference_number}`,
              message: `Approval request "${req.title}" has been awaiting review for over ${thresholdHours} hours.`,
              link: `/admin/approvals?requestId=${req.id}`,
              priority: 'normal',
              category: 'approvals',
              event_type: 'approval_pending',
              record_id: req.id,
              record_type: 'approval_request',
              deduplicate_window_hours: approvalRule.repeat_interval_hours || 48,
            });

            if (notif) {
              escalationsTriggered++;
              await supabase.from('escalation_logs').insert({
                rule_id: approvalRule.id,
                event_type: 'approval_pending',
                record_id: req.id,
                escalation_level: 1,
                recipient_staff_id: exec.id,
                recipient_role: exec.role,
                title: notif.title,
                message: notif.message,
                notification_id: notif.id,
              });
            }
          }
        }
      }
    }

    // 3. Quotation Expiring Rule
    const quoteRule = activeRules.find((r) => r.event_type === 'quotation_expiring');
    if (quoteRule) {
      const closingWindow = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      const { data: expiringQuotes } = await supabase
        .from('quotations')
        .select('id, quotation_number, client_id, valid_until, created_by')
        .in('status', ['draft', 'sent'])
        .gte('valid_until', today)
        .lte('valid_until', closingWindow)
        .limit(15);

      if (expiringQuotes) {
        evaluated += expiringQuotes.length;
        for (const q of expiringQuotes) {
          if (q.created_by) {
            const notif = await emitNotification({
              recipient_staff_id: q.created_by,
              title: `Quotation Expiring Soon: ${q.quotation_number}`,
              message: `Quotation expires on ${q.valid_until}. Please conduct client follow-up.`,
              link: `/admin/quotations`,
              priority: 'normal',
              category: 'quotations',
              event_type: 'quotation_expiring',
              record_id: q.id,
              record_type: 'quotation',
              deduplicate_window_hours: 48,
            });

            if (notif) escalationsTriggered++;
          }
        }
      }
    }
  } catch (err) {
    console.error('[Escalation] Evaluation cycle error:', err);
  }

  return { evaluated, escalationsTriggered };
}
