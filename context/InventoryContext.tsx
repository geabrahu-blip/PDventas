import React, { createContext, useContext, useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { getInventoryItems } from '../services/db';

interface InventoryContextType {
  inventory: InventoryItem[];
  isLoading: boolean;
  refreshInventory: () => Promise<void>;
  updateLocalInventoryItem: (item: InventoryItem) => void;
  removeLocalInventoryItem: (id: string) => void;
  updateMultipleLocalInventoryItems: (items: InventoryItem[]) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    // Intentionally skipped to avoid loading all inventory items into memory on startup.
    // Individual pages (POS, Inventory) will fetch their own paginated data.
    // Context is now only used for caching/local updates if needed, though mostly obsolete.
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshInventory = async () => {
    // No-op for global refresh
  };

  const updateLocalInventoryItem = (updatedItem: InventoryItem) => {
    setInventory(prev => {
      const exists = prev.find(item => item.id === updatedItem.id);
      if (exists) {
        return prev.map(item => item.id === updatedItem.id ? updatedItem : item);
      }
      return [...prev, updatedItem];
    });
  };

  const removeLocalInventoryItem = (id: string) => {
    setInventory(prev => prev.filter(item => item.id !== id));
  };

  const updateMultipleLocalInventoryItems = (items: InventoryItem[]) => {
    setInventory(prev => {
      const newInventory = [...prev];
      items.forEach(updatedItem => {
        const index = newInventory.findIndex(item => item.id === updatedItem.id);
        if (index !== -1) {
          newInventory[index] = updatedItem;
        } else {
          newInventory.push(updatedItem);
        }
      });
      return newInventory;
    });
  };

  return (
    <InventoryContext.Provider
      value={{
        inventory,
        isLoading,
        refreshInventory,
        updateLocalInventoryItem,
        removeLocalInventoryItem,
        updateMultipleLocalInventoryItems
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
}
