import React, { useState, useEffect, useRef } from "react";
import { Calendar, AlertCircle } from "lucide-react";
import { cn } from "../../utils/cn";
import {
  parseFlexibleDate,
  formatDateToDDMMYYYY,
  formatDateToYYYYMMDD,
  type DateParseResult,
} from "../../utils/dateUtils";

export interface DatePickerInputProps {
  id?: string;
  name?: string;
  label?: string;
  value?: string; // Can be DD/MM/YYYY or YYYY-MM-DD or ISO string
  onChange: (formattedDDMMYYYY: string, parseResult: DateParseResult) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  error?: string;
  hint?: string;
  allowFutureDates?: boolean;
  minYear?: number;
  maxYear?: number;
}

export function DatePickerInput({
  id = "payment-date-input",
  name = "payment_date",
  label = "Payment Date",
  value = "",
  onChange,
  required = false,
  disabled = false,
  placeholder = "DD/MM/YYYY",
  className,
  inputClassName,
  error: externalError,
  hint,
  allowFutureDates = true,
}: DatePickerInputProps) {
  // Track the raw text typed by user to allow natural typing without clobbering
  const [inputText, setInputText] = useState(() => {
    if (!value) return "";
    const parsed = parseFlexibleDate(value);
    return parsed.isValid && parsed.formattedDDMMYYYY ? parsed.formattedDDMMYYYY : value;
  });

  const [validationError, setValidationError] = useState<string | null>(null);
  const hiddenDateInputRef = useRef<HTMLInputElement>(null);

  // Sync internal text state when external value changes
  useEffect(() => {
    if (value) {
      const parsed = parseFlexibleDate(value);
      if (parsed.isValid && parsed.formattedDDMMYYYY) {
        if (inputText !== parsed.formattedDDMMYYYY) {
          setInputText(parsed.formattedDDMMYYYY);
        }
      }
    } else if (value === "" && inputText !== "") {
      setInputText("");
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setInputText(rawVal);

    if (!rawVal.trim()) {
      setValidationError(required ? "Date is required." : null);
      onChange("", {
        isValid: false,
        date: null,
        error: required ? "Date is required." : undefined,
      });
      return;
    }

    const parseRes = parseFlexibleDate(rawVal);
    if (!parseRes.isValid) {
      setValidationError(parseRes.error || "Invalid date format. Use DD/MM/YYYY.");
      onChange(rawVal, parseRes);
      return;
    }

    // Check future date restriction if configured
    if (!allowFutureDates && parseRes.date) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (parseRes.date > today) {
        const futureErr = "Future payment dates are not permitted.";
        setValidationError(futureErr);
        onChange(rawVal, { ...parseRes, isValid: false, error: futureErr });
        return;
      }
    }

    setValidationError(null);
    onChange(parseRes.formattedDDMMYYYY || rawVal, parseRes);
  };

  const handleNativePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nativeVal = e.target.value; // Formatted as YYYY-MM-DD
    if (!nativeVal) return;

    const parseRes = parseFlexibleDate(nativeVal);
    if (parseRes.isValid && parseRes.formattedDDMMYYYY) {
      setInputText(parseRes.formattedDDMMYYYY);
      setValidationError(null);
      onChange(parseRes.formattedDDMMYYYY, parseRes);
    }
  };

  const triggerCalendarPicker = () => {
    if (disabled) return;
    if (hiddenDateInputRef.current) {
      try {
        if (typeof (hiddenDateInputRef.current as any).showPicker === "function") {
          (hiddenDateInputRef.current as any).showPicker();
        } else {
          hiddenDateInputRef.current.focus();
          hiddenDateInputRef.current.click();
        }
      } catch {
        hiddenDateInputRef.current.click();
      }
    }
  };

  // Convert current input text to YYYY-MM-DD for native picker synchronization
  const parsedCurrent = parseFlexibleDate(inputText);
  const nativePickerValue = parsedCurrent.isValid ? parsedCurrent.formattedYYYYMMDD : "";

  const displayError = externalError || validationError;

  return (
    <div className={cn("space-y-1.5 w-full", className)}>
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          id={id}
          name={name}
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          aria-invalid={!!displayError}
          className={cn(
            "w-full rounded-lg border px-3 py-2 pr-10 text-xs transition outline-none",
            "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100",
            displayError
              ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400"
              : "border-slate-300 dark:border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500",
            disabled && "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800",
            inputClassName
          )}
        />

        {/* Calendar Picker Trigger Button */}
        <button
          type="button"
          onClick={triggerCalendarPicker}
          disabled={disabled}
          title="Open calendar picker"
          aria-label="Open calendar picker"
          className={cn(
            "absolute right-1 top-1 bottom-1 px-2 flex items-center justify-center rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 transition",
            disabled && "pointer-events-none opacity-40"
          )}
        >
          <Calendar className="h-4 w-4" />
        </button>

        {/* Hidden Native Date Input for popup calendar */}
        <input
          ref={hiddenDateInputRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={nativePickerValue}
          onChange={handleNativePickerChange}
          disabled={disabled}
          className="absolute -bottom-1 right-2 opacity-0 w-0 h-0 pointer-events-none"
        />
      </div>

      {displayError ? (
        <div className="flex items-center gap-1 text-[11px] font-medium text-red-500">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span>{displayError}</span>
        </div>
      ) : hint ? (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
      ) : (
        <p className="text-[10px] text-slate-400 dark:text-slate-500">
          Enter as DD/MM/YYYY or click calendar to select
        </p>
      )}
    </div>
  );
}
