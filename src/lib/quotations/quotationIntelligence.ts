import { supabase } from '../supabaseClient';
import { createApprovalRequest } from '../approvals/approvalService';
import type {
  ServiceBundle,
  ServiceRecommendation,
  QuotationFinancialSummary,
} from '../../types/suitePhases15To19';

/**
 * Fetch active service bundles
 */
export async function fetchServiceBundles(): Promise<ServiceBundle[]> {
  try {
    const { data, error } = await supabase
      .from('service_bundles')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.warn('[QuotationIntelligence] Bundle fetch error:', error.message);
      return [];
    }
    return (data || []) as ServiceBundle[];
  } catch {
    return [];
  }
}

/**
 * Save or update a service bundle
 */
export async function saveServiceBundle(bundle: Partial<ServiceBundle>): Promise<ServiceBundle | null> {
  try {
    const { data, error } = await supabase
      .from('service_bundles')
      .upsert({
        ...bundle,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as ServiceBundle;
  } catch (err) {
    console.error('[QuotationIntelligence] Save bundle error:', err);
    return null;
  }
}

/**
 * Intelligent Complementary Service Recommendations
 * Recommends relevant post-incorporation, compliance, or tax services based on selected services
 */
export async function getComplementaryRecommendations(
  selectedServiceIds: string[]
): Promise<ServiceRecommendation[]> {
  if (!selectedServiceIds || selectedServiceIds.length === 0) return [];

  try {
    const { data: allServices } = await supabase
      .from('services_catalog')
      .select('id, name, category, default_fee_ngn, slug');

    const fallbackCatalog = [
      { id: 'svc-ltd', name: 'Private Limited Company Registration', category: 'Corporate Registration', default_fee_ngn: 65000, slug: 'company-ltd' },
      { id: 'svc-tin', name: 'Tax Identification Number (TIN) & FIRS Registration', category: 'Tax & Compliance', default_fee_ngn: 25000, slug: 'tin-registration' },
      { id: 'svc-seal', name: 'Official Company Statutory Seal', category: 'Corporate Services', default_fee_ngn: 15000, slug: 'company-seal' },
      { id: 'svc-bn', name: 'Business Name Registration', category: 'Enterprise', default_fee_ngn: 35000, slug: 'business-name' },
      { id: 'svc-annual-return', name: 'Annual Return CAC Statutory Filing', category: 'Compliance', default_fee_ngn: 30000, slug: 'annual-return' },
      { id: 'svc-ngo', name: 'Incorporated Trustee / NGO Registration', category: 'Non-Profit', default_fee_ngn: 120000, slug: 'ngo-registration' },
      { id: 'svc-scuml', name: 'SCUML Anti-Money Laundering Certificate', category: 'Regulatory Compliance', default_fee_ngn: 45000, slug: 'scuml-certificate' },
    ];

    const servicesList = (allServices && allServices.length > 0) ? allServices : fallbackCatalog;

    const selected = servicesList.filter((s) =>
      selectedServiceIds.includes(s.id) ||
      selectedServiceIds.some((idOrName) =>
        s.name.toLowerCase().includes(idOrName.toLowerCase()) ||
        (s.slug && s.slug.toLowerCase().includes(idOrName.toLowerCase()))
      )
    );
    const recommendations: ServiceRecommendation[] = [];

    const selectedSlugs = (selected.length > 0 ? selected : servicesList.filter(s => selectedServiceIds.some(id => id.toLowerCase().includes('company') || id.toLowerCase().includes('ltd')))).map(
      (s) => s.slug?.toLowerCase() || s.name.toLowerCase()
    );
    const isCompanyReg = selectedSlugs.some((s) => s.includes('company') || s.includes('ltd') || s.includes('limited'));
    const isBusinessName = selectedSlugs.some((s) => s.includes('business-name') || s.includes('enterprise'));
    const isNgo = selectedSlugs.some((s) => s.includes('ngo') || s.includes('trustee') || s.includes('foundation'));

    for (const service of servicesList) {
      // Don't recommend services already in the quotation
      if (selectedServiceIds.includes(service.id)) continue;

      const slug = service.slug?.toLowerCase() || service.name.toLowerCase();

      if (isCompanyReg) {
        if (slug.includes('tax') || slug.includes('tin') || slug.includes('firs')) {
          recommendations.push({
            service_id: service.id,
            name: service.name,
            category: service.category,
            default_fee_ngn: Number(service.default_fee_ngn || 0),
            reason: 'Mandatory post-incorporation tax identification and company income tax clearance.',
          });
        } else if (slug.includes('seal') || slug.includes('post-incorporation')) {
          recommendations.push({
            service_id: service.id,
            name: service.name,
            category: service.category,
            default_fee_ngn: Number(service.default_fee_ngn || 0),
            reason: 'Official company statutory seal required for corporate bank account mandates and contracts.',
          });
        }
      }

      if (isBusinessName) {
        if (slug.includes('annual-return') || slug.includes('compliance')) {
          recommendations.push({
            service_id: service.id,
            name: service.name,
            category: service.category,
            default_fee_ngn: Number(service.default_fee_ngn || 0),
            reason: 'Annual return filing requirement within 12 months to maintain CAC active status.',
          });
        }
      }

      if (isNgo) {
        if (slug.includes('scuml') || slug.includes('money-laundering')) {
          recommendations.push({
            service_id: service.id,
            name: service.name,
            category: service.category,
            default_fee_ngn: Number(service.default_fee_ngn || 0),
            reason: 'Statutory SCUML registration mandatory for non-profit and charitable bank accounts.',
          });
        }
      }
    }

    return recommendations.slice(0, 4);
  } catch (err) {
    console.warn('[QuotationIntelligence] Recommendation error:', err);
    return [];
  }
}

/**
 * Computes exact financial breakdown, margins, statutory fee separation, and approval prerequisites
 */
export function computeQuotationFinancials(
  items: Array<{
    unit_price: number;
    quantity: number;
    statutory_fee?: number;
    internal_cost?: number;
    min_fee_ngn?: number;
  }>,
  discountAmount: number = 0,
  taxRatePercent: number = 0
): QuotationFinancialSummary {
  let subtotal = 0;
  let statutoryFeesTotal = 0;
  let internalCostTotal = 0;
  const approvalReasons: string[] = [];

  for (const item of items) {
    const qty = Math.max(1, item.quantity || 1);
    const unitPrice = Number(item.unit_price || 0);
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;

    const statFee = Number(item.statutory_fee || 0) * qty;
    statutoryFeesTotal += statFee;

    const intCost = Number(item.internal_cost || 0) * qty;
    internalCostTotal += intCost;

    if (item.min_fee_ngn && unitPrice < item.min_fee_ngn) {
      approvalReasons.push(`Unit fee of ₦${unitPrice.toLocaleString()} is below minimum allowable fee (₦${item.min_fee_ngn.toLocaleString()}).`);
    }
  }

  const effectiveDiscount = Math.max(0, Math.min(discountAmount, subtotal));
  const discountedSubtotal = subtotal - effectiveDiscount;
  const taxAmount = (discountedSubtotal * Math.max(0, taxRatePercent)) / 100;
  const totalAmount = discountedSubtotal + taxAmount;

  // ABLEBIZ Gross Margin excludes third-party statutory fees passed through to regulators
  // Margin = (Total Professional Revenue - Statutory Fees - Internal Direct Delivery Costs)
  const professionalRevenue = discountedSubtotal - statutoryFeesTotal;
  const marginAmount = professionalRevenue - internalCostTotal;
  const marginPercentage = professionalRevenue > 0
    ? Math.round((marginAmount / professionalRevenue) * 10000) / 100
    : 0;

  // Check discount threshold (Discounts > 10% or > ₦15,000 require commercial approval)
  if (effectiveDiscount > 15000 || (subtotal > 0 && (effectiveDiscount / subtotal) > 0.10)) {
    approvalReasons.push(`Quotation discount of ₦${effectiveDiscount.toLocaleString()} exceeds authorized commercial limits (10% or ₦15,000).`);
  }

  // Check negative margin safeguard
  if (marginAmount < 0) {
    approvalReasons.push(`Operating margin is negative (₦${marginAmount.toLocaleString()}). Executive commercial review required.`);
  }

  const requiresApproval = approvalReasons.length > 0;

  return {
    subtotal,
    discount_amount: effectiveDiscount,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    statutory_fees_total: statutoryFeesTotal,
    internal_cost_total: internalCostTotal,
    margin_amount: marginAmount,
    margin_percentage: marginPercentage,
    requires_approval: requiresApproval,
    approval_reasons: approvalReasons,
  };
}

/**
 * Safely converts an accepted quotation into an official invoice.
 * Preserves the exact frozen price snapshot and prevents duplicate conversion.
 */
export async function convertQuotationToInvoiceSafe(
  quoteId: string,
  operatorStaffId: string,
  defaultPaymentTerms?: string
): Promise<{ success: boolean; invoiceId?: string; invoiceNumber?: string; error?: string }> {
  try {
    // 1. Fetch quotation with lock check
    const { data: quote, error: qErr } = await supabase
      .from('quotations')
      .select('*, client:clients(id, full_name)')
      .eq('id', quoteId)
      .single();

    if (qErr || !quote) {
      return { success: false, error: 'Quotation record not found.' };
    }

    if (quote.status === 'converted' && quote.converted_invoice_id) {
      return {
        success: false,
        error: `Quotation has already been converted to Invoice. Duplicate conversion blocked.`,
      };
    }

    if (quote.requires_approval && quote.status === 'draft') {
      return {
        success: false,
        error: 'Quotation requires executive approval before invoice conversion.',
      };
    }

    // 2. Fetch line items
    const { data: items, error: itErr } = await supabase
      .from('quotation_items')
      .select('*')
      .eq('quotation_id', quote.id);

    if (itErr || !items || items.length === 0) {
      return { success: false, error: 'Quotation does not have valid line items to convert.' };
    }

    // 3. Generate sequential invoice number: INV-YYYYMM-XXXX
    const date = new Date();
    const ym = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `INV-${ym}-`;

    const { data: lastInv } = await supabase
      .from('invoices')
      .select('invoice_number')
      .ilike('invoice_number', `${prefix}%`)
      .order('invoice_number', { ascending: false })
      .limit(1);

    let invNumber = `${prefix}0001`;
    if (lastInv && lastInv.length > 0 && lastInv[0].invoice_number) {
      const parts = lastInv[0].invoice_number.split('-');
      const lastSeq = parseInt(parts[2], 10);
      const nextSeq = isNaN(lastSeq) ? 1 : lastSeq + 1;
      invNumber = `${prefix}${String(nextSeq).padStart(4, '0')}`;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    // 4. Create Invoice Header with frozen values
    const { data: newInv, error: invErr } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invNumber,
        quotation_id: quote.id,
        service_request_id: quote.service_request_id || null,
        client_id: quote.client_id,
        business_id: quote.business_id || null,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        subtotal: quote.subtotal,
        discount: quote.discount_amount,
        tax: quote.tax_amount,
        total_amount: quote.total_amount,
        amount_paid: 0.00,
        balance_due: quote.total_amount,
        status: 'draft',
        payment_terms: defaultPaymentTerms || 'Payment due within 7 days of invoice issuance. Remit to designated official settlement account.',
        notes: `Converted from Quotation ${quote.quotation_number}. Frozen pricing snapshot applied.`,
      })
      .select()
      .single();

    if (invErr || !newInv) {
      throw invErr || new Error('Failed to insert invoice header.');
    }

    // 5. Create Invoice Line Items with frozen snapshot prices
    const invItems = items.map((qi: any) => ({
      invoice_id: newInv.id,
      service_id: qi.service_id || null,
      description: qi.description,
      quantity: qi.quantity,
      unit_price: qi.unit_price,
      total_price: qi.total_price,
    }));

    const { error: insItErr } = await supabase.from('invoice_items').insert(invItems);
    if (insItErr) throw insItErr;

    // 6. Update Quotation Status to Converted & link back
    await supabase
      .from('quotations')
      .update({
        status: 'converted',
        converted_invoice_id: newInv.id,
        converted_at: new Date().toISOString(),
        converted_by: operatorStaffId,
      })
      .eq('id', quote.id);

    // 7. Log activity timeline
    await supabase.from('activity_timeline').insert({
      entity_type: 'quotation',
      entity_id: quote.id,
      actor_type: 'staff',
      actor_id: operatorStaffId,
      event_type: 'quotation_converted',
      event_title: `Quotation ${quote.quotation_number} converted into Invoice ${invNumber}`,
      metadata: {
        quotation_number: quote.quotation_number,
        invoice_id: newInv.id,
        invoice_number: invNumber,
        total_amount: quote.total_amount,
      },
    });

    return {
      success: true,
      invoiceId: newInv.id,
      invoiceNumber: invNumber,
    };
  } catch (err: any) {
    console.error('[QuotationIntelligence] Conversion error:', err);
    return { success: false, error: err.message || 'Failed to convert quotation to invoice.' };
  }
}
