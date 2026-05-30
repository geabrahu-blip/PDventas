import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  writeBatch,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { Product, Store, Transfer, Sale, InventoryItem, User, PublicCatalogItem } from '../types';

// Helper to get a random ID when not provided
const generateId = () => doc(collection(db, 'dummy')).id;


export const addProduct = async (product: Omit<Product, 'id'>): Promise<Product> => {
  const id = generateId();
  const newProduct: Product = { ...product, id };
  const sanitizedNewProduct = JSON.parse(JSON.stringify(newProduct));
  await setDoc(doc(db, 'products', id), sanitizedNewProduct);

  // Look for existing product in Bodega to merge stock instead of duplicate
  let existingInv;

  if (newProduct.barcode) {
    // Fast path: search by barcode using a query
    const qBarcode = query(collection(db, 'inventory'), where('barcode', '==', newProduct.barcode), where('storeId', '==', 'bodega'));
    const snap = await getDocs(qBarcode);
    if (!snap.empty) {
      existingInv = { ...snap.docs[0].data(), id: snap.docs[0].id } as InventoryItem;
    }
  }

  // Fallback: search by name/brand/category if no barcode or no match by barcode
  if (!existingInv) {
    // For large inventories, we could optimize this further (e.g. searching by name explicitly)
    // but without full-text search we still rely on loading the inventory or querying by exactly matching fields.
    // Querying by name directly is much faster than downloading all items.
    const qName = query(collection(db, 'inventory'), where('name', '==', newProduct.name), where('storeId', '==', 'bodega'));
    const nameSnap = await getDocs(qName);

    // Check if any returned match the other criteria (to be safe against case sensitivity or partial matches if we did complex queries)
    // The exact query on name is case sensitive in Firebase. We'll use this optimized fetch instead of getInventoryItems() to save massive reads.
    const potentialMatches = nameSnap.docs.map(d => ({...d.data(), id: d.id} as InventoryItem));

    existingInv = potentialMatches.find(item =>
      item.name.toLowerCase().trim() === newProduct.name.toLowerCase().trim() &&
      (item.brand || '') === (newProduct.brand || '') &&
      (item.category || '') === (newProduct.category || '')
    );
  }

  if (existingInv) {
    // Update existing inventory item (add units, update prices to latest)
    const updatedInv = {
      ...existingInv,
      units: existingInv.units + newProduct.units,
      priceBs: newProduct.priceBs, // Update to latest cost
      wholesalePrice: newProduct.wholesalePrice,
      sellingPrice: newProduct.sellingPrice,
      gender: newProduct.gender || existingInv.gender,
      capacity: newProduct.capacity || existingInv.capacity,
      categoryType: newProduct.categoryType || existingInv.categoryType,
      image: newProduct.image || existingInv.image, // update image if new one provided
    };
    const sanitizedUpdatedInv = JSON.parse(JSON.stringify(updatedInv));
    await setDoc(doc(db, 'inventory', existingInv.id), sanitizedUpdatedInv);
    await syncToPublicCatalog(sanitizedUpdatedInv);
  } else {
    // Create an initial inventory record in Bodega
    const invId = generateId();
    const invItem: InventoryItem = {
      id: invId,
      productId: id, // acts as reference to the original product that created it
      storeId: 'bodega',
      units: newProduct.units,
      name: newProduct.name,
      brand: newProduct.brand,
      category: newProduct.category,
      gender: newProduct.gender,
      barcode: newProduct.barcode,
      image: newProduct.image,
      priceBs: newProduct.priceBs,
      wholesalePrice: newProduct.wholesalePrice,
      sellingPrice: newProduct.sellingPrice,
    };
    const sanitizedInvItem = JSON.parse(JSON.stringify(invItem));
    await setDoc(doc(db, 'inventory', invId), sanitizedInvItem);
    await syncToPublicCatalog(sanitizedInvItem);
  }

  return newProduct;
};

export const updateProduct = async (updatedProduct: Product, updatePricesAllStores: boolean = false): Promise<Product> => {
  // First, get the old product to calculate unit differences
  const docRef = doc(db, 'products', updatedProduct.id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error("Producto original no encontrado");
  const oldProduct = docSnap.data() as Product;

  // Save updated product record
  const sanitizedUpdatedProduct = JSON.parse(JSON.stringify(updatedProduct));
  await setDoc(doc(db, 'products', updatedProduct.id), sanitizedUpdatedProduct);

  // We must update the inventory items across all stores
  let existingInvItems: InventoryItem[] = [];

  if (oldProduct.barcode) {
    const qBarcode = query(collection(db, 'inventory'), where('barcode', '==', oldProduct.barcode));
    const snap = await getDocs(qBarcode);
    if (!snap.empty) {
      existingInvItems = snap.docs.map(d => ({ ...d.data(), id: d.id } as InventoryItem));
    }
  }

  if (existingInvItems.length === 0) {
    const qName = query(collection(db, 'inventory'), where('name', '==', oldProduct.name));
    const nameSnap = await getDocs(qName);
    const potentialMatches = nameSnap.docs.map(d => ({...d.data(), id: d.id} as InventoryItem));

    existingInvItems = potentialMatches.filter(item =>
      item.name.toLowerCase().trim() === oldProduct.name.toLowerCase().trim() &&
      (item.brand || '') === (oldProduct.brand || '') &&
      (item.category || '') === (oldProduct.category || '')
    );
  }

  const unitDifference = updatedProduct.units - oldProduct.units;

  // Update all found inventory items
  for (const inv of existingInvItems) {
    const updatedInv = {
      ...inv,
      name: updatedProduct.name,
      brand: updatedProduct.brand,
      category: updatedProduct.category,
      gender: updatedProduct.gender,
      capacity: updatedProduct.capacity,
      categoryType: updatedProduct.categoryType,
      image: updatedProduct.image || inv.image,
      barcode: updatedProduct.barcode || inv.barcode,
    };

    if (inv.storeId === 'bodega') {
      updatedInv.units = Math.max(0, inv.units + unitDifference); // Adjust units only in bodega
      updatedInv.priceBs = updatedProduct.priceBs;
      updatedInv.wholesalePrice = updatedProduct.wholesalePrice;
      updatedInv.sellingPrice = updatedProduct.sellingPrice;
    } else if (updatePricesAllStores) {
      updatedInv.priceBs = updatedProduct.priceBs;
      updatedInv.wholesalePrice = updatedProduct.wholesalePrice;
      updatedInv.sellingPrice = updatedProduct.sellingPrice;
    }

    const sanitizedUpdatedInv = JSON.parse(JSON.stringify(updatedInv));
    await setDoc(doc(db, 'inventory', inv.id), sanitizedUpdatedInv);
    await syncToPublicCatalog(sanitizedUpdatedInv);
  }

  return updatedProduct;
};

export const deleteProduct = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'products', id));
};

// Inventory Items
export const getInventoryItems = async (): Promise<InventoryItem[]> => {
  const q = query(collection(db, 'inventory'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as InventoryItem);
};

export interface PaginatedResult {
  items: PublicCatalogItem[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
}

// Fetches inventory strictly from the server, 12 at a time, hiding sensitive data
export const syncToPublicCatalog = async (item: InventoryItem, isDelete: boolean = false): Promise<void> => {
  const docRef = doc(db, 'public_catalog', item.id);

  if (isDelete || item.units <= 0) {
    // If it's deleted or out of stock, remove it from the public catalog
    await deleteDoc(docRef);
  } else {
    // Otherwise, create or update the public catalog record, strictly omitting private cost prices
    const publicItem: PublicCatalogItem = {
      id: item.id,
      productId: item.productId,
      storeId: item.storeId,
      units: item.units,
      name: item.name,
      brand: item.brand,
      category: item.category,
      gender: item.gender,
      capacity: item.capacity,
      categoryType: item.categoryType,
      image: item.image,
      sellingPrice: item.sellingPrice,
    };

    // Safely strip any undefined properties to prevent Firebase "invalid-argument" crashes on older records
    const sanitizedItem = JSON.parse(JSON.stringify(publicItem));
    await setDoc(docRef, sanitizedItem);
  }
};

export const syncAllToPublicCatalog = async (): Promise<{ success: number; failed: number }> => {
  const inventoryItems = await getInventoryItems();
  let successCount = 0;
  let failedCount = 0;

  const chunkSize = 20;
  for (let i = 0; i < inventoryItems.length; i += chunkSize) {
    const chunk = inventoryItems.slice(i, i + chunkSize);

    // We handle errors on a per-item basis so one bad item doesn't crash the whole sync
    const promises = chunk.map(async (item) => {
      try {
        await syncToPublicCatalog(item);
        successCount++;
      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error);
        failedCount++;
      }
    });

    await Promise.all(promises);
  }

  return { success: successCount, failed: failedCount };
};

export const getPublicInventoryItems = async (
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null,
  genderFilter: string = 'Todos'
): Promise<PaginatedResult> => {

  let q;

  // Base query constraints
  const constraints: any[] = [where('units', '>', 0)];

  // Add gender filter if specified
  if (genderFilter !== 'Todos') {
    // Handling potential capitalization differences based on typical app usage
    if (genderFilter === 'Varón') {
      constraints.push(where('gender', 'in', ['Varón', 'varón', 'Hombre', 'hombre', 'VARÓN', 'HOMBRE']));
    } else if (genderFilter === 'Mujer') {
      constraints.push(where('gender', 'in', ['Mujer', 'mujer', 'MUJER']));
    } else if (genderFilter === 'Unisex') {
      constraints.push(where('gender', 'in', ['Unisex', 'unisex', 'UNISEX']));
    } else {
      constraints.push(where('gender', '==', genderFilter));
    }
  }

  // Order by name for consistent pagination
  // Firestore requirement: If using inequality filter (units > 0), you must order by that field first.
  constraints.push(orderBy('units', 'desc'));
  constraints.push(orderBy('name'));
  constraints.push(limit(12));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  q = query(collection(db, 'public_catalog'), ...constraints);

  const querySnapshot = await getDocs(q);

  const items = querySnapshot.docs.map(doc => doc.data() as PublicCatalogItem);

  return {
    items,
    lastDoc: querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null
  };
};

export const updateInventoryItem = async (item: InventoryItem): Promise<InventoryItem> => {
  const sanitizedItem = JSON.parse(JSON.stringify(item));
  await setDoc(doc(db, 'inventory', item.id), sanitizedItem);
  await syncToPublicCatalog(sanitizedItem);
  return item;
};

export const deleteInventoryItem = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'inventory', id));
  // We need the item to sync deletion, but if we don't have it, we just attempt to delete the public_catalog record by id
  await deleteDoc(doc(db, 'public_catalog', id));
};

export const syncOldProductsToInventory = async (): Promise<void> => {
  // Obsolete function since everything is new in Firebase, but keeping signature for safety.
  console.log("Sync not needed for Firebase initialized projects.");
};

// Users
export const getUsers = async (): Promise<User[]> => {
  const q = query(collection(db, 'users'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as User);
};

// We don't expose addUser directly for Firebase Auth flow here,
// usually you create the user in Auth first, then save to DB.
// But we keep this for backwards compatibility where the UI uses it (needs to be refactored eventually if creating users from UI)
export const addUser = async (user: Omit<User, 'id'>, uid?: string): Promise<User> => {
  const id = uid || generateId();
  const newUser: User = { ...user, id };
  await setDoc(doc(db, 'users', id), newUser);
  return newUser;
};

export const updateUser = async (user: User): Promise<User> => {
  await setDoc(doc(db, 'users', user.id), user);
  return user;
};

export const deleteUser = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'users', id));
};

export const getUserByUsername = async (username: string): Promise<User | null> => {
  const q = query(collection(db, 'users'), where('username', '==', username));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  return querySnapshot.docs[0].data() as User;
};

// Database Reset
export const clearAllData = async (): Promise<void> => {
  // Warning: This clears almost all collections, but should ONLY be used in development or testing.
  const collectionsToClear = ['products', 'inventory', 'sales', 'transfers'];

  for (const collectionName of collectionsToClear) {
    const q = query(collection(db, collectionName));
    const querySnapshot = await getDocs(q);
    const deletePromises = querySnapshot.docs.map(docSnapshot => deleteDoc(doc(db, collectionName, docSnapshot.id)));
    await Promise.all(deletePromises);
  }
};

// Stores
export const getStores = async (): Promise<Store[]> => {
  const q = query(collection(db, 'stores'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as Store);
};

export const addStore = async (store: Omit<Store, 'id'>): Promise<Store> => {
  const id = generateId();
  const newStore: Store = { ...store, id };
  await setDoc(doc(db, 'stores', id), newStore);
  return newStore;
};

export const deleteStore = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'stores', id));
};

// Transfers
export const addTransfer = async (transfer: Omit<Transfer, 'id'>): Promise<Transfer> => {
  const id = generateId();
  const newTransfer: Transfer = { ...transfer, id };
  await setDoc(doc(db, 'transfers', id), newTransfer);
  return newTransfer;
};

export const processBulkTransfer = async (
  transferCart: {item: InventoryItem, quantity: number}[],
  targetStoreId: string,
  currentProducts: InventoryItem[]
): Promise<void> => {
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  // Track dynamically updated inventory units during the batch processing
  const inMemoryInventory: Record<string, InventoryItem> = {};
  currentProducts.forEach(p => {
    inMemoryInventory[p.id] = { ...p };
  });

  for (const cartItem of transferCart) {
    const selectedProduct = inMemoryInventory[cartItem.item.id] || cartItem.item;
    const qty = cartItem.quantity;

    // 1. Record transfer
    const transferId = generateId();
    const newTransfer: Transfer = {
      id: transferId,
      productId: selectedProduct.id,
      fromStoreId: selectedProduct.storeId || 'bodega',
      toStoreId: targetStoreId,
      quantity: qty,
      date: now
    };
    batch.set(doc(db, 'transfers', transferId), newTransfer);

    // 2. Deduct from origin
    const originUpdated = {
      ...selectedProduct,
      units: selectedProduct.units - qty
    };
    batch.set(doc(db, 'inventory', selectedProduct.id), originUpdated);

    if (originUpdated.units <= 0) {
      batch.delete(doc(db, 'public_catalog', selectedProduct.id));
    } else {
      const publicOrigin: PublicCatalogItem = { ...originUpdated };
      delete (publicOrigin as any).priceBs;
      delete (publicOrigin as any).wholesalePrice;
      batch.set(doc(db, 'public_catalog', selectedProduct.id), publicOrigin);
    }

    inMemoryInventory[selectedProduct.id] = originUpdated;

    // 3. Add to destination
    // Find if the target store already has this product
    const existingInTargetId = Object.keys(inMemoryInventory).find(id => {
      const p = inMemoryInventory[id];
      return p.productId === selectedProduct.productId && p.storeId === targetStoreId;
    });

    if (existingInTargetId) {
      const existingInTarget = inMemoryInventory[existingInTargetId];
      const targetUpdated = {
        ...existingInTarget,
        units: existingInTarget.units + qty
      };
      batch.set(doc(db, 'inventory', existingInTarget.id), targetUpdated);

      const publicTarget: PublicCatalogItem = { ...targetUpdated };
      delete (publicTarget as any).priceBs;
      delete (publicTarget as any).wholesalePrice;
      batch.set(doc(db, 'public_catalog', existingInTarget.id), publicTarget);

      inMemoryInventory[existingInTarget.id] = targetUpdated;
    } else {
      const newInventoryId = crypto.randomUUID();
      const newInventoryForStore: InventoryItem = {
        ...selectedProduct,
        id: newInventoryId,
        storeId: targetStoreId,
        units: qty,
      };
      batch.set(doc(db, 'inventory', newInventoryId), newInventoryForStore);

      const publicNew: PublicCatalogItem = { ...newInventoryForStore };
      delete (publicNew as any).priceBs;
      delete (publicNew as any).wholesalePrice;
      batch.set(doc(db, 'public_catalog', newInventoryId), publicNew);

      inMemoryInventory[newInventoryId] = newInventoryForStore;
    }
  }

  await batch.commit();
};

// Sales
export const getSales = async (): Promise<Sale[]> => {
  const q = query(collection(db, 'sales'));
  const querySnapshot = await getDocs(q);
  const sales = querySnapshot.docs.map(doc => doc.data() as Sale);
  return sales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const addSale = async (sale: Omit<Sale, 'id'>): Promise<Sale> => {
  const id = generateId();
  const newSale: Sale = { ...sale, id };
  await setDoc(doc(db, 'sales', id), newSale);
  return newSale;
};

export const deleteSale = async (id: string): Promise<void> => {
  const docRef = doc(db, 'sales', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return;
  const sale = docSnap.data() as Sale;

  // Restore inventory items
  const allInventory = await getInventoryItems();
  for (const item of sale.items) {
    const invItem = allInventory.find(inv => inv.id === item.productId || inv.productId === item.productId && inv.storeId === sale.storeId);
    if (invItem) {
      await updateInventoryItem({
        ...invItem,
        units: invItem.units + item.quantity
      });
    }
  }

  // Delete the sale record
  await deleteDoc(docRef);
};


export const getAllPublicInventoryItems = async () => {
  try {
    const publicCatalogRef = collection(db, 'public_catalog');
    const q = query(publicCatalogRef);
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error fetching all public items:", error);
    throw error;
  }
};
