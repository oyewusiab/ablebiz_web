import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "./supabaseClient";
import { useAuth } from "../auth/AuthContext";
import {
  type BusinessProfile,
  type BusinessBankAccount,
  type PublicBusinessProfile,
  DEFAULT_BUSINESS_PROFILE,
  DEFAULT_BANK_ACCOUNTS,
} from "../types/businessProfile";

interface BusinessProfileContextType {
  profile: BusinessProfile;
  bankAccounts: BusinessBankAccount[];
  defaultBankAccount: BusinessBankAccount | null;
  publicProfile: PublicBusinessProfile;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateProfile: (profile: Partial<BusinessProfile>) => Promise<{ success: boolean; error?: string }>;
  updateBankAccounts: (accounts: BusinessBankAccount[]) => Promise<{ success: boolean; error?: string }>;
}

const BusinessProfileContext = createContext<BusinessProfileContextType | null>(null);

export function BusinessProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<BusinessProfile>(DEFAULT_BUSINESS_PROFILE);
  const [bankAccounts, setBankAccounts] = useState<BusinessBankAccount[]>(DEFAULT_BANK_ACCOUNTS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setError(null);
      
      // If user is authenticated active staff, load full profile and bank accounts
      if (user) {
        const [profileRes, bankRes] = await Promise.all([
          supabase.from("business_profile").select("*").eq("id", 1).maybeSingle(),
          supabase.from("business_bank_accounts").select("*").order("account_slot", { ascending: true }),
        ]);

        if (profileRes.data) {
          setProfile(profileRes.data as BusinessProfile);
        }

        if (bankRes.data && bankRes.data.length > 0) {
          setBankAccounts(bankRes.data as BusinessBankAccount[]);
        }
      } else {
        // Public anonymous: load public_business_profile view (zero bank details)
        const { data } = await supabase.from("public_business_profile").select("*").maybeSingle();
        if (data) {
          setProfile((prev) => ({
            ...prev,
            ...data,
          }));
        }
      }
    } catch (err: any) {
      console.warn("[BusinessProfile] Using fallback defaults:", err?.message || err);
      setError(err?.message || "Failed to load business profile");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = async (updates: Partial<BusinessProfile>): Promise<{ success: boolean; error?: string }> => {
    try {
      const merged = {
        ...profile,
        ...updates,
        id: 1,
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null,
      };

      const { error: saveErr } = await supabase
        .from("business_profile")
        .upsert(merged, { onConflict: "id" });

      if (saveErr) throw saveErr;

      // Audit log entry
      if (user?.id) {
        try {
          await supabase.from("audit_logs").insert({
            staff_id: user.id,
            staff_email: user.email,
            action: "update_business_profile",
            entity_type: "business_profile",
            old_values: profile,
            new_values: merged,
          });
        } catch (auditErr) {
          console.warn("[AuditLog] Non-critical error:", auditErr);
        }
      }

      setProfile(merged);
      return { success: true };
    } catch (err: any) {
      console.error("[BusinessProfile] Update failed:", err);
      return { success: false, error: err.message || "Failed to update business profile" };
    }
  };

  const updateBankAccounts = async (accounts: BusinessBankAccount[]): Promise<{ success: boolean; error?: string }> => {
    try {
      // Validate accounts
      const activeAccounts = accounts.filter((a) => a.is_active);
      const defaultAccounts = accounts.filter((a) => a.is_default && a.is_active);

      if (accounts.some((a) => a.is_active && !a.bank_name.trim())) {
        return { success: false, error: "Active bank accounts must have a Bank Name." };
      }
      if (accounts.some((a) => a.is_active && !a.account_name.trim())) {
        return { success: false, error: "Active bank accounts must have an Account Name." };
      }
      if (accounts.some((a) => a.is_active && !/^\d{10}$/.test(a.account_number.trim()))) {
        return { success: false, error: "Active bank accounts must have a valid 10-digit NUBAN account number." };
      }

      if (activeAccounts.length > 0 && defaultAccounts.length !== 1) {
        return { success: false, error: "Exactly one active bank account must be designated as the default settlement account." };
      }

      const recordsToSave = accounts.map((acc, idx) => ({
        business_profile_id: 1,
        account_slot: (idx + 1) as 1 | 2,
        bank_name: acc.bank_name.trim(),
        account_name: acc.account_name.trim(),
        account_number: acc.account_number.trim(),
        account_type: acc.account_type.trim() || "Corporate Current",
        is_active: acc.is_active,
        is_default: acc.is_default && acc.is_active,
        notes: acc.notes?.trim() || "",
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null,
      }));

      const { data, error: bankErr } = await supabase
        .from("business_bank_accounts")
        .upsert(recordsToSave, { onConflict: "account_slot" })
        .select();

      if (bankErr) throw bankErr;

      // Audit log entry
      if (user?.id) {
        try {
          await supabase.from("audit_logs").insert({
            staff_id: user.id,
            staff_email: user.email,
            action: "update_business_bank_accounts",
            entity_type: "business_bank_accounts",
            old_values: bankAccounts,
            new_values: recordsToSave,
          });
        } catch (auditErr) {
          console.warn("[AuditLog] Non-critical error:", auditErr);
        }
      }

      if (data && data.length > 0) {
        setBankAccounts(data as BusinessBankAccount[]);
      } else {
        setBankAccounts(recordsToSave as BusinessBankAccount[]);
      }

      return { success: true };
    } catch (err: any) {
      console.error("[BusinessProfile] Bank accounts update failed:", err);
      return { success: false, error: err.message || "Failed to update bank accounts" };
    }
  };

  const defaultBankAccount = bankAccounts.find((a) => a.is_active && a.is_default) ||
    bankAccounts.find((a) => a.is_active && a.account_number) ||
    null;

  const publicProfile: PublicBusinessProfile = {
    legal_name: profile.legal_name,
    trading_name: profile.trading_name,
    tagline: profile.tagline,
    business_description: profile.business_description,
    year_established: profile.year_established,
    award_badge: profile.award_badge,
    primary_phone: profile.primary_phone,
    secondary_phone: profile.secondary_phone,
    whatsapp_number: profile.whatsapp_number,
    whatsapp_number_intl: profile.whatsapp_number_intl,
    primary_email: profile.primary_email,
    secondary_email: profile.secondary_email,
    support_email: profile.support_email,
    website_url: profile.website_url,
    address_line_1: profile.address_line_1,
    address_line_2: profile.address_line_2,
    city: profile.city,
    lga: profile.lga,
    state: profile.state,
    country: profile.country,
    logo_url: profile.logo_url,
    document_disclaimer: profile.document_disclaimer,
  };

  return (
    <BusinessProfileContext.Provider
      value={{
        profile,
        bankAccounts,
        defaultBankAccount,
        publicProfile,
        isLoading,
        error,
        refetch: fetchProfile,
        updateProfile,
        updateBankAccounts,
      }}
    >
      {children}
    </BusinessProfileContext.Provider>
  );
}

export function useBusinessProfile() {
  const ctx = useContext(BusinessProfileContext);
  if (!ctx) {
    // Return graceful fallback state if accessed outside provider
    return {
      profile: DEFAULT_BUSINESS_PROFILE,
      bankAccounts: DEFAULT_BANK_ACCOUNTS,
      defaultBankAccount: DEFAULT_BANK_ACCOUNTS[0],
      publicProfile: DEFAULT_BUSINESS_PROFILE,
      isLoading: false,
      error: null,
      refetch: async () => {},
      updateProfile: async () => ({ success: false, error: "Provider not mounted" }),
      updateBankAccounts: async () => ({ success: false, error: "Provider not mounted" }),
    };
  }
  return ctx;
}
