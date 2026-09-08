import React, { createContext, useContext, useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { getInventoryItems, searchInventoryItems } from '../services/db';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

interface InventoryContextType {
  inventory: InventoryItem[];
  isLoading: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  refreshInventory: () => Promise<void>;
  loadMoreInventory: () => Promise<void>;
  searchInventory: (term: string) => Promise<void>;
  updateLocalInventoryItem: (item: InventoryItem) => void;
  removeLocalInventoryItem: (id: string) => void;
  updateMultipleLocalInventoryItems: (items: InventoryItem[]) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load ALL items up front as desired, ignoring pagination logic to restore smooth functionality
      const items = await getInventoryItems();
      setInventory(items);
      setLastDoc(null);
      setHasMore(false);
    } catch (error) {
      console.error("Error initial loading inventory:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshInventory = async () => {
    await loadData();
  };

  const loadMoreInventory = async () => {
    if (!hasMore || isFetchingMore) return;

    setIsFetchingMore(true);
    try {
      // Paginated load is disabled in favor of full initial load
    } catch (error) {
      console.error("Error fetching more inventory:", error);
    } finally {
      setIsFetchingMore(false);
    }
  };

  const searchInventory = async (term: string) => {
    setIsLoading(true);
    try {
      if (!term.trim()) {
        await loadData(); // Reset to default paginated list
        return;
      }

      // La búsqueda en db.ts ahora usa >= y <=
      // Desactiva la paginación tradicional mientras se busca
      const searchResults = await searchInventoryItems(term);
      setInventory(searchResults);
      setHasMore(false);
      setLastDoc(null);
    } catch (error) {
      console.error("Error searching inventory:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateLocalInventoryItem = (updatedItem: InventoryItem) => {
    setInventory((prev = []) => {
      const safePrev = prev || [];
      const exists = safePrev.find(item => item.id === updatedItem.id);
      if (exists) {
        return safePrev.map(item => item.id === updatedItem.id ? updatedItem : item);
      }
      return [...safePrev, updatedItem];
    });
  };

  const removeLocalInventoryItem = (id: string) => {
    setInventory((prev = []) => {
      const safePrev = prev || [];
      return safePrev.filter(item => item.id !== id);
    });
  };

  const updateMultipleLocalInventoryItems = (items: InventoryItem[]) => {
    setInventory((prev = []) => {
      const safePrev = prev || [];
      const newInventory = [...safePrev];
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
        isFetchingMore,
        hasMore,
        refreshInventory,
        loadMoreInventory,
        searchInventory,
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
