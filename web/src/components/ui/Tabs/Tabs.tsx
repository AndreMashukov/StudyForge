import React, { createContext, useContext } from 'react';
import { cn } from '../../../lib/utils';
import { ITabsProps, ITabsListProps, ITabsTriggerProps, ITabsContentProps } from './ITabs';
import { tabsStyles } from './Tabs.styles';

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export const Tabs = ({ value, onValueChange, children, className }: ITabsProps) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn(tabsStyles.root, className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({ children, className }: ITabsListProps) => {
  return (
    <div className={cn(tabsStyles.list, className)}>
      {children}
    </div>
  );
};

export const TabsTrigger = ({ value, children, className }: ITabsTriggerProps) => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('TabsTrigger must be used within a Tabs component');
  }

  const { value: selectedValue, onValueChange } = context;
  const isActive = selectedValue === value;

  return (
    <button
      type="button"
      className={cn(tabsStyles.trigger, className)}
      data-state={isActive ? 'active' : 'inactive'}
      onClick={() => onValueChange(value)}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, children, className }: ITabsContentProps) => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('TabsContent must be used within a Tabs component');
  }

  const { value: selectedValue } = context;
  
  if (selectedValue !== value) {
    return null;
  }

  return (
    <div className={cn(tabsStyles.content, className)}>
      {children}
    </div>
  );
};