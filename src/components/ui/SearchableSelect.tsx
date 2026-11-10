import React, { useState, useRef, useEffect, useMemo, useId } from "react";
import { Search, ChevronDown, X, Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "../../utils/cn";

export interface SearchableSelectOption<T = string> {
  value: T;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeTone?: "default" | "success" | "warning" | "danger" | "info";
  disabled?: boolean;
  keywords?: string[];
}

export interface SearchableSelectProps<T = string> {
  id?: string;
  name?: string;
  label?: string;
  options: SearchableSelectOption<T>[];
  value?: T | null;
  onChange: (value: T) => void;
  onClear?: () => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  loading?: boolean;
  loadingMessage?: string;
  errorMessage?: string;
  disabled?: boolean;
  required?: boolean;
  allowClear?: boolean;
  className?: string;
  buttonClassName?: string;
  hint?: string;
  error?: string;
  placement?: "auto" | "bottom" | "top";
}

export function SearchableSelect<T = string>({
  id: customId,
  name,
  label,
  options,
  value,
  onChange,
  onClear,
  placeholder = "Select an option...",
  searchPlaceholder = "Type to search...",
  emptyMessage = "No matching results found",
  loading = false,
  loadingMessage = "Loading options...",
  errorMessage,
  disabled = false,
  required = false,
  allowClear = true,
  className,
  buttonClassName,
  hint,
  error: externalError,
  placement = "auto",
}: SearchableSelectProps<T>) {
  const generatedId = useId();
  const selectId = customId || generatedId;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [dropDirection, setDropDirection] = useState<"down" | "up">("down");

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    if (value === undefined || value === null) return null;
    return options.find((opt) => opt.value === value) || null;
  }, [options, value]);

  // Filter options dynamically
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase().trim();
    return options.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(query);
      const matchSublabel = opt.sublabel?.toLowerCase().includes(query) ?? false;
      const matchBadge = opt.badge?.toLowerCase().includes(query) ?? false;
      const matchKeywords = opt.keywords?.some((k) => k.toLowerCase().includes(query)) ?? false;
      return matchLabel || matchSublabel || matchBadge || matchKeywords;
    });
  }, [options, searchQuery]);

  // Handle smart drop direction (auto flip up if close to viewport bottom)
  useEffect(() => {
    if (isOpen && placement === "auto" && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // If less than 240px below and more space above, open upwards
      if (spaceBelow < 240 && spaceAbove > spaceBelow) {
        setDropDirection("up");
      } else {
        setDropDirection("down");
      }
    } else if (placement !== "auto") {
      setDropDirection(placement === "top" ? "up" : "down");
    }
  }, [isOpen, placement]);

  // Auto focus and clear search query when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setHighlightedIndex(-1);
      // Small timeout to allow element to render before focusing
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle outside clicks to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isOpen]);

  // Keep highlighted item in view during keyboard navigation
  useEffect(() => {
    if (highlightedIndex >= 0 && listboxRef.current) {
      const highlightedEl = listboxRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex]);

  const handleSelectOption = (opt: SearchableSelectOption<T>) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClear) {
      onClear();
    } else {
      onChange("" as unknown as T);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev + 1;
          return next >= filteredOptions.length ? 0 : next;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev - 1;
          return next < 0 ? filteredOptions.length - 1 : next;
        });
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          const opt = filteredOptions[highlightedIndex];
          if (!opt.disabled) {
            handleSelectOption(opt);
          }
        } else if (filteredOptions.length === 1 && !filteredOptions[0].disabled) {
          handleSelectOption(filteredOptions[0]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case "Tab":
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  const displayError = externalError || errorMessage;

  return (
    <div className={cn("space-y-1.5 w-full", className)} ref={containerRef}>
      {label && (
        <label htmlFor={selectId} className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Dropdown Trigger Button */}
        <button
          id={selectId}
          name={name}
          type="button"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={`${selectId}-listbox`}
          aria-invalid={!!displayError}
          disabled={disabled || loading}
          onClick={() => !disabled && !loading && setIsOpen((prev) => !prev)}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition outline-none",
            "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100",
            isOpen
              ? "border-amber-500 ring-1 ring-amber-500"
              : displayError
              ? "border-red-400 focus:border-red-500"
              : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 focus:border-amber-500",
            disabled && "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800",
            buttonClassName
          )}
        >
          <div className="flex-1 truncate pr-2">
            {selectedOption ? (
              <div className="flex items-center gap-2 truncate">
                <span className="font-medium truncate">{selectedOption.label}</span>
                {selectedOption.badge && (
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 uppercase tracking-wider",
                      selectedOption.badgeTone === "success" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
                      selectedOption.badgeTone === "warning" && "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
                      selectedOption.badgeTone === "danger" && "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
                      selectedOption.badgeTone === "info" && "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
                      (!selectedOption.badgeTone || selectedOption.badgeTone === "default") && "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    )}
                  >
                    {selectedOption.badge}
                  </span>
                )}
                {selectedOption.sublabel && (
                  <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
                    ({selectedOption.sublabel})
                  </span>
                )}
              </div>
            ) : (
              <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 text-slate-400">
            {allowClear && selectedOption && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleClear(e as any);
                  }
                }}
                title="Clear selection"
                className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
            ) : (
              <ChevronDown
                className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180 text-amber-500")}
              />
            )}
          </div>
        </button>

        {/* Dropdown Floating Panel */}
        {isOpen && (
          <div
            className={cn(
              "absolute left-0 right-0 z-50 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden",
              dropDirection === "up" ? "bottom-full mb-1" : "top-full mt-1"
            )}
          >
            {/* Embedded Search Input */}
            <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 rounded"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Options List */}
            <ul
              ref={listboxRef}
              id={`${selectId}-listbox`}
              role="listbox"
              tabIndex={-1}
              className="max-h-60 overflow-y-auto p-1 text-xs divide-y divide-slate-50 dark:divide-slate-800/50"
            >
              {loading ? (
                <li className="p-4 text-center text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                  <span>{loadingMessage}</span>
                </li>
              ) : filteredOptions.length === 0 ? (
                <li className="p-4 text-center text-slate-400">
                  <p className="font-medium text-slate-600 dark:text-slate-300">{emptyMessage}</p>
                  {searchQuery && (
                    <p className="text-[11px] text-slate-400 mt-1">No options match "{searchQuery}"</p>
                  )}
                </li>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = selectedOption?.value === opt.value;
                  const isHighlighted = highlightedIndex === idx;

                  return (
                    <li
                      key={String(opt.value)}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled}
                      onClick={() => handleSelectOption(opt)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition select-none",
                        opt.disabled && "opacity-40 cursor-not-allowed pointer-events-none",
                        isSelected
                          ? "bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 font-medium"
                          : isHighlighted
                          ? "bg-slate-100 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      )}
                    >
                      <div className="flex flex-col gap-0.5 truncate pr-2">
                        <div className="flex items-center gap-2 truncate">
                          <span className={cn("truncate", isSelected && "font-semibold")}>
                            {opt.label}
                          </span>
                          {opt.badge && (
                            <span
                              className={cn(
                                "px-1.5 py-0.2 rounded text-[10px] font-semibold shrink-0 uppercase tracking-wider",
                                opt.badgeTone === "success" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
                                opt.badgeTone === "warning" && "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
                                opt.badgeTone === "danger" && "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
                                opt.badgeTone === "info" && "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
                                (!opt.badgeTone || opt.badgeTone === "default") && "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              )}
                            >
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {opt.sublabel && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                            {opt.sublabel}
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <Check className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 ml-2" />
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>

      {displayError ? (
        <div className="flex items-center gap-1 text-[11px] font-medium text-red-500">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span>{displayError}</span>
        </div>
      ) : hint ? (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}
