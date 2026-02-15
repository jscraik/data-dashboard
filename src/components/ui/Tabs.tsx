import * as React from "react";
import { clsx } from "clsx";

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  "aria-label"?: string;
}

export function Tabs({ value, onValueChange, children, "aria-label": ariaLabel }: TabsProps) {
  return (
    <div className="w-full" aria-label={ariaLabel}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement, {
            selectedValue: value,
            onValueChange,
          });
        }
        return child;
      })}
    </div>
  );
}

interface TabsListProps {
  children: React.ReactNode;
  selectedValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  "aria-label"?: string;
}

export function TabsList({ children, selectedValue, onValueChange, className, "aria-label": ariaLabel }: TabsListProps) {
  return (
    <div 
      role="tablist" 
      aria-label={ariaLabel || "Dashboard navigation"}
      className={clsx("inline-flex h-10 items-center justify-center rounded-lg bg-slate-100 p-1 relative", className)}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement, {
            selectedValue,
            onValueChange,
          });
        }
        return child;
      })}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  selectedValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function TabsTrigger({ value, children, selectedValue, onValueChange, className }: TabsTriggerProps) {
  const isSelected = selectedValue === value;
  
  return (
    <button
      role="tab"
      aria-selected={isSelected}
      aria-controls={`panel-${value}`}
      id={`tab-${value}`}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => onValueChange?.(value)}
      className={clsx(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative z-10",
        isSelected
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50",
        className
      )}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  selectedValue?: string;
  className?: string;
}

export function TabsContent({ value, children, selectedValue, className }: TabsContentProps) {
  const isSelected = selectedValue === value;
  const [isVisible, setIsVisible] = React.useState(isSelected);
  const [shouldRender, setShouldRender] = React.useState(isSelected);
  
  React.useEffect(() => {
    if (isSelected) {
      setShouldRender(true);
      // Small delay to allow DOM to mount before animating in
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      // Wait for transition to finish before unmounting
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isSelected]);
  
  if (!shouldRender) return null;
  
  return (
    <div 
      role="tabpanel"
      id={`panel-${value}`}
      aria-labelledby={`tab-${value}`}
      className={clsx(
        "mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition-all duration-fast ease-out",
        isVisible 
          ? "opacity-100 translate-y-0" 
          : "opacity-0 translate-y-2 pointer-events-none",
        className
      )}
    >
      {children}
    </div>
  );
}