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
  orderBy,
  runTransaction
} from 'firebase/firestore';
import { db } from './firebase';
import { Product, Store, Transfer, Sale, InventoryItem, User, PublicCatalogItem, KardexLog } from '../types';

// Helper to get a random ID when not provided
const generateId = () => doc(collection(db, 'dummy')).id;

export const createPendingQRSale = async (
  clientName: string,
  items: { productId: string, name: string, quantity: number, price: number, subtotal: number, variationType?: 'sealed' | '5ml' | '10ml' | '30ml' | 'opened' }[],
  subtotal: number,
  total: number,
  globalDiscount: number,
  userId?: string,
  userName?: string,
): Promise<string> => {
  const saleId = generateId();
  const saleRef = doc(db, 'sales', saleId);
  const now = new Date();

  await setDoc(saleRef, {
    storeId: 'bodega',
    clientName: clientName || 'Cliente Ocasional',
    userId: userId || null,
    userName: userName || null,
    items: items,
    subtotal: subtotal,
    total: total,
    discount: globalDiscount,
    globalDiscount: globalDiscount,
    paymentMethod: 'QR',
    amountCash: null,
    amountQR: total,
    date: now.toISOString(),
    timestamp: now.getTime(),
    status: 'PENDING_QR' // Special status for Beta QR
  });

  return saleId;
};

export const cancelPendingQRSale = async (saleId: string): Promise<void> => {
  await deleteDoc(doc(db, 'sales', saleId));
};

export const processPOSSale = async (
  clientName: string,
  items: { productId: string, name: string, quantity: number, price: number, subtotal: number, variationType?: 'sealed' | '5ml' | '10ml' | '30ml' | 'opened' }[],
  subtotal: number,
  total: number,
  globalDiscount: number,
  paymentMethod: 'Cash' | 'QR' | 'Mixto' | 'QR_AUTO',
  userId?: string,
  userName?: string,
  amountCash?: number,
  amountQR?: number,
  existingSaleId?: string,
  manualConfirmation?: boolean
): Promise<void> => {
  const saleId = existingSaleId || generateId();
  const saleRef = doc(db, 'sales', saleId);
  const now = new Date();

  await runTransaction(db, async (transaction) => {
    // 1. Verify stock for all items (All READS must come before any WRITES in a Firestore Transaction)
    const inventoryDocs = [];
    for (const item of items) {
      const inventoryRef = doc(db, 'inventory', item.productId);
      const inventoryDoc = await transaction.get(inventoryRef);

      if (!inventoryDoc.exists()) {
        throw new Error(`Producto ${item.name} no encontrado en el inventario.`);
      }

      const invData = inventoryDoc.data() as InventoryItem;
      let available = 0;
      let fieldToUpdate = 'units';

      if (!item.variationType || item.variationType === 'sealed') {
        available = invData.units || 0;
      } else if (item.variationType === 'opened') {
        // Technically opened bottles are sold entirely, ignoring quantity. But let's check correctly
        available = (invData.openedBottleMl && invData.openedBottleMl > 0) ? 1 : 0;
        fieldToUpdate = 'openedBottleMl';
      } else if (item.variationType === '5ml') {
        available = invData.decants5ml || 0;
        fieldToUpdate = 'decants5ml';
      } else if (item.variationType === '10ml') {
        available = invData.decants10ml || 0;
        fieldToUpdate = 'decants10ml';
      } else if (item.variationType === '30ml') {
        available = invData.decants30ml || 0;
        fieldToUpdate = 'decants30ml';
      }

      if (available < item.quantity) {
        throw new Error(`Stock insuficiente para ${item.name}. Disponible: ${available}`);
      }

      let newValue = available - item.quantity;
      if (item.variationType === 'opened') newValue = 0; // Remate sells all remaining ml

      inventoryDocs.push({
        ref: inventoryRef,
        item: item,
        fieldToUpdate,
        newValue
      });
    }

    // 2. Perform all writes (Updates and Sets)
    for (const docData of inventoryDocs) {
      // Deduct stock dynamically
      transaction.update(docData.ref, { [docData.fieldToUpdate]: docData.newValue });

      // Log to Kardex
      let logReason = 'Venta POS';
      if (docData.item.variationType && docData.item.variationType !== 'sealed') {
        logReason = `Venta POS (Decant ${docData.item.variationType})`;
        if (docData.item.variationType === 'opened') logReason = 'Venta POS (Remate botella abierta)';
      }

      const kardexRef = doc(db, 'kardex_logs', generateId());
      transaction.set(kardexRef, {
        id: kardexRef.id,
        productId: docData.item.productId,
        quantity: docData.item.variationType === 'sealed' || !docData.item.variationType ? -docData.item.quantity : 0, // Only standard units count in numeric kardex
        date: now.toISOString().split('T')[0],
        reason: logReason,
        timestamp: now.getTime(),
        type: 'SALIDA'
      });
    }

    // 3. Create or Update the Sale record
    const saleData: any = {
      storeId: 'bodega', // Hardcoded single store
      clientName: clientName || 'Cliente Ocasional',
      userId: userId || null,
      userName: userName || null,
      items: items,
      subtotal: subtotal,
      total: total,
      discount: globalDiscount, // Using alias as requested
      globalDiscount: globalDiscount,
      paymentMethod: paymentMethod === 'QR_AUTO' ? 'QR' : paymentMethod,
      amountCash: amountCash ?? null,
      amountQR: amountQR ?? null,
      status: 'PAID'
    };

    if (manualConfirmation) {
      saleData.manualConfirmation = true;
    }

    if (existingSaleId) {
       // Since it might have been marked PAID by the webhook slightly earlier, we just ensure it's finalized
       // We only update the necessary fields that are meant to be updated on finalize, though `set` with merge is safer
       transaction.set(saleRef, saleData, { merge: true });
    } else {
       saleData.date = now.toISOString();
       saleData.timestamp = now.getTime(); // Useful for queries
       transaction.set(saleRef, saleData);
    }
  });
};

export const prepareDecants = async (
  inventoryId: string,
  d5: number,
  d10: number,
  d30: number
): Promise<InventoryItem> => {
  const invRef = doc(db, 'inventory', inventoryId);
  const invSnap = await getDoc(invRef);
  if (!invSnap.exists()) throw new Error('Producto no encontrado en inventario');

  const item = invSnap.data() as InventoryItem;
  if (item.categoryType !== 'Perfumes' || !item.hasDecants) {
    throw new Error('El producto no tiene decants habilitados.');
  }

  const totalMlNeeded = (d5 * 5) + (d10 * 10) + (d30 * 30);
  let currentOpenedMl = item.openedBottleMl || 0;
  let bottlesToOpen = 0;

  const capacityMatch = item.capacity?.match(/\d+/);
  const bottleCapacity = capacityMatch ? parseInt(capacityMatch[0], 10) : 0;

  if (totalMlNeeded > currentOpenedMl) {
    if (bottleCapacity <= 0) {
      throw new Error('Capacidad del perfume inválida. No se puede calcular cuántas botellas abrir.');
    }
    const deficit = totalMlNeeded - currentOpenedMl;
    bottlesToOpen = Math.ceil(deficit / bottleCapacity);

    if (item.units < bottlesToOpen) {
      throw new Error(`Stock insuficiente. Necesitas abrir ${bottlesToOpen} botellas selladas, pero solo tienes ${item.units}.`);
    }
  }

  // Calculate new state
  const newUnits = item.units - bottlesToOpen;
  const newOpenedMl = (currentOpenedMl + (bottlesToOpen * bottleCapacity)) - totalMlNeeded;

  const updatedItem = {
    ...item,
    units: newUnits,
    openedBottleMl: newOpenedMl,
    decants5ml: (item.decants5ml || 0) + d5,
    decants10ml: (item.decants10ml || 0) + d10,
    decants30ml: (item.decants30ml || 0) + d30,
  };

  const batch = writeBatch(db);
  batch.set(invRef, updatedItem);

  // Update public catalog
  const publicItem: PublicCatalogItem = { ...updatedItem };
  delete (publicItem as any).priceBs;
  delete (publicItem as any).wholesalePrice;
  batch.set(doc(db, 'public_catalog', inventoryId), publicItem);

  // Update products collection as well to keep units in sync
  if (item.productId) {
    const prodRef = doc(db, 'products', item.productId);
    const prodSnap = await getDoc(prodRef);
    if (prodSnap.exists()) {
      batch.update(prodRef, {
        units: newUnits,
        openedBottleMl: newOpenedMl,
        decants5ml: updatedItem.decants5ml,
        decants10ml: updatedItem.decants10ml,
        decants30ml: updatedItem.decants30ml,
      });
    }
  }

  // Log Kardex if bottles were opened
  if (bottlesToOpen > 0) {
    const kardexRef = doc(db, 'kardex_logs', generateId());
    batch.set(kardexRef, {
      id: kardexRef.id,
      productId: item.productId,
      quantity: bottlesToOpen,
      date: new Date().toISOString().split('T')[0],
      reason: `Apertura para decants (${totalMlNeeded}ml)`,
      timestamp: new Date().getTime(),
      type: 'SALIDA'
    });
  }

  await batch.commit();

  if (inMemoryInventory[inventoryId]) {
    inMemoryInventory[inventoryId] = updatedItem;
  }

  return updatedItem;
};

export const adjustProductStock = async (
  productId: string,
  quantityChange: number,
  date: string,
  reason: string
): Promise<void> => {
  const inventoryRef = doc(db, 'inventory', productId);
  const kardexRef = doc(db, 'kardex_logs', generateId());

  await runTransaction(db, async (transaction) => {
    const inventoryDoc = await transaction.get(inventoryRef);
    if (!inventoryDoc.exists()) {
      throw new Error("El producto no existe en el inventario.");
    }

    const currentUnits = inventoryDoc.data().units || 0;
    const newUnits = currentUnits + quantityChange;

    if (newUnits < 0) {
      throw new Error("El stock resultante no puede ser negativo.");
    }

    // Update stock
    transaction.update(inventoryRef, { units: newUnits });

    // Create Kardex log
    transaction.set(kardexRef, {
      productId: productId,
      quantity: quantityChange,
      date: date,
      reason: reason || 'Ajuste manual',
      timestamp: new Date().getTime(),
      type: quantityChange >= 0 ? 'ENTRADA' : 'SALIDA'
    });
  });
};


export const addProduct = async (product: Omit<Product, 'id'>): Promise<Product> => {
  const newProduct = { ...product };

  // Look for existing product in Bodega
  let existingInv;

  if (newProduct.barcode) {
    // Fast path: search by barcode using a query
    const qBarcode = query(collection(db, 'inventory'), where('barcode', '==', newProduct.barcode), where('storeId', '==', 'bodega'));
    const snap = await getDocs(qBarcode);
    if (!snap.empty) {
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as InventoryItem));
      // Find the one that matches capacity exactly if multiple exist with same barcode
      existingInv = items.find(item => (item.capacity || '') === (newProduct.capacity || ''));
    }
  }

  // Fallback: search by name/brand/category/capacity if no barcode or no match by barcode
  if (!existingInv) {
    const qName = query(collection(db, 'inventory'), where('name', '==', newProduct.name), where('storeId', '==', 'bodega'));
    const nameSnap = await getDocs(qName);

    const potentialMatches = nameSnap.docs.map(d => ({...d.data(), id: d.id} as InventoryItem));

    existingInv = potentialMatches.find(item =>
      item.name.toLowerCase().trim() === newProduct.name.toLowerCase().trim() &&
      (item.brand || '') === (newProduct.brand || '') &&
      (item.category || '') === (newProduct.category || '') &&
      (item.capacity || '') === (newProduct.capacity || '')
    );
  }

  if (existingInv) {
    throw new Error('Este producto ya existe, si quieres agregar más stock ve a editarlo.');
  }

  const id = generateId();
  const newProductWithId: Product = { ...newProduct, id };
  const sanitizedNewProduct = JSON.parse(JSON.stringify(newProductWithId));
  await setDoc(doc(db, 'products', id), sanitizedNewProduct);

  // Create an initial inventory record in Bodega
  const invId = generateId();
  const invItem: InventoryItem = {
    id: invId,
    productId: id, // acts as reference to the original product that created it
    storeId: 'bodega',
    units: newProductWithId.units,
    name: newProductWithId.name,
    brand: newProductWithId.brand,
    category: newProductWithId.category,
    gender: newProductWithId.gender,
    capacity: newProductWithId.capacity,
    categoryType: newProductWithId.categoryType,
    barcode: newProductWithId.barcode,
    image: newProductWithId.image,
    priceBs: newProductWithId.priceBs,
    wholesalePrice: newProductWithId.wholesalePrice,
    sellingPrice: newProductWithId.sellingPrice,
    hasDecants: newProductWithId.hasDecants,
    decants5ml: newProductWithId.decants5ml,
    decant5mlPrice: newProductWithId.decant5mlPrice,
    decants10ml: newProductWithId.decants10ml,
    decant10mlPrice: newProductWithId.decant10mlPrice,
    decants30ml: newProductWithId.decants30ml,
    decant30mlPrice: newProductWithId.decant30mlPrice,
    openedBottleMl: newProductWithId.openedBottleMl,
  };
  const sanitizedInvItem = JSON.parse(JSON.stringify(invItem));
  await setDoc(doc(db, 'inventory', invId), sanitizedInvItem);
  await syncToPublicCatalog(sanitizedInvItem);

  // Create Kardex log for initial stock if > 0
  if (newProductWithId.units > 0) {
    const kardexRef = doc(db, 'kardex_logs', generateId());
    await setDoc(kardexRef, {
      productId: id,
      quantity: newProductWithId.units,
      date: new Date().toISOString().split('T')[0],
      reason: 'Inventario inicial',
      timestamp: new Date().getTime(),
      type: 'ENTRADA'
    });
  }

  return newProductWithId;
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
      // Filter out items that have a different capacity
      existingInvItems = existingInvItems.filter(item => (item.capacity || '') === (oldProduct.capacity || ''));
    }
  }

  if (existingInvItems.length === 0) {
    const qName = query(collection(db, 'inventory'), where('name', '==', oldProduct.name));
    const nameSnap = await getDocs(qName);
    const potentialMatches = nameSnap.docs.map(d => ({...d.data(), id: d.id} as InventoryItem));

    existingInvItems = potentialMatches.filter(item =>
      item.name.toLowerCase().trim() === oldProduct.name.toLowerCase().trim() &&
      (item.brand || '') === (oldProduct.brand || '') &&
      (item.category || '') === (oldProduct.category || '') &&
      (item.capacity || '') === (oldProduct.capacity || '')
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
      hasDecants: updatedProduct.hasDecants ?? inv.hasDecants,
      decants5ml: updatedProduct.decants5ml ?? inv.decants5ml,
      decant5mlPrice: updatedProduct.decant5mlPrice ?? inv.decant5mlPrice,
      decants10ml: updatedProduct.decants10ml ?? inv.decants10ml,
      decant10mlPrice: updatedProduct.decant10mlPrice ?? inv.decant10mlPrice,
      decants30ml: updatedProduct.decants30ml ?? inv.decants30ml,
      decant30mlPrice: updatedProduct.decant30mlPrice ?? inv.decant30mlPrice,
      openedBottleMl: updatedProduct.openedBottleMl ?? inv.openedBottleMl,
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

  if (unitDifference !== 0) {
    const kardexRef = doc(db, 'kardex_logs', generateId());
    await setDoc(kardexRef, {
      productId: updatedProduct.id,
      quantity: Math.abs(unitDifference),
      date: new Date().toISOString().split('T')[0],
      reason: 'Ajuste por edición',
      timestamp: new Date().getTime(),
      type: unitDifference > 0 ? 'ENTRADA' : 'SALIDA'
    });
  }

  return updatedProduct;
};

export const deleteProduct = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'products', id));
};

// Inventory Items

export interface PaginatedInventoryResult {
  items: InventoryItem[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
}

export const getPaginatedInventoryItems = async (
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null,
  limitCount: number = 20
): Promise<PaginatedInventoryResult> => {

  const constraints: any[] = [];

  // Ordering by name requires an index in Firestore if combined with other things, but simple order is fine.
  constraints.push(orderBy('name'));
  constraints.push(limit(limitCount));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const finalQ = query(collection(db, 'inventory'), ...constraints);

  const querySnapshot = await getDocs(finalQ);
  const items = querySnapshot.docs.map(doc => doc.data() as InventoryItem);

  return {
    items,
    lastDoc: querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null
  };
};

export const searchInventoryItems = async (searchTerm: string): Promise<InventoryItem[]> => {
  const searchLower = searchTerm.toLowerCase();

  // NOTE: This will still fetch all items but ONLY when searching.
  // A better approach for search in firestore is a specific field query, but since it's "contains" search
  // we must filter client-side. We limit the number of results to 50 to avoid crashing the UI.
  const q = query(collection(db, 'inventory'));
  const querySnapshot = await getDocs(q);
  const allItems = querySnapshot.docs.map(doc => doc.data() as InventoryItem);

  return allItems.filter(p =>
    p.name.toLowerCase().includes(searchLower) ||
    (p.barcode && p.barcode.toLowerCase().includes(searchLower)) ||
    (p.brand && p.brand.toLowerCase().includes(searchLower))
  ).slice(0, 50); // limit search results
};

export const getInventoryItems = async (): Promise<InventoryItem[]> => {
  const q = query(collection(db, 'inventory'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as InventoryItem);
};

export interface PaginatedKardexResult {
  items: KardexLog[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
}

export const getKardexLogs = async (
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null,
  limitCount: number = 50,
  startDate?: number,
  endDate?: number
): Promise<PaginatedKardexResult> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const constraints: any[] = [];

  if (startDate !== undefined) {
    constraints.push(where('timestamp', '>=', startDate));
  }
  if (endDate !== undefined) {
    constraints.push(where('timestamp', '<=', endDate));
  }

  constraints.push(orderBy('timestamp', 'desc'));
  constraints.push(limit(limitCount));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(collection(db, 'kardex_logs'), ...constraints);
  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as KardexLog));

  return {
    items,
    lastDoc: querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null
  };
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

  const finalQPublic = query(collection(db, 'public_catalog'), ...constraints);

  const querySnapshot = await getDocs(finalQPublic);

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
export const getSales = async (startDateStr?: string, endDateStr?: string): Promise<Sale[]> => {
  let q;

  if (startDateStr && endDateStr) {
    // Treat dates as local time (YYYY-MM-DD)
    const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);

    const startObj = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
    const endObj = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);

    q = query(
      collection(db, 'sales'),
      where('date', '>=', startObj.toISOString()),
      where('date', '<=', endObj.toISOString())
    );
  } else if (startDateStr) {
    // Fallback for single date (used by vendor view)
    const [year, month, day] = startDateStr.split('-').map(Number);
    const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);

    q = query(
      collection(db, 'sales'),
      where('date', '>=', startDate.toISOString()),
      where('date', '<=', endDate.toISOString())
    );
  } else {
    // All sales
    q = query(collection(db, 'sales'));
  }

  const querySnapshot = await getDocs(q);
  // Fix: explicitly inject the document ID into the returned object
  const sales = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Sale));
  return sales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const addSale = async (sale: Omit<Sale, 'id'>): Promise<Sale> => {
  const id = generateId();
  const newSale: Sale = { ...sale, id };
  await setDoc(doc(db, 'sales', id), newSale);
  return newSale;
};

export const cancelSale = async (saleId: string, items: { productId: string, name: string, quantity: number, variationType?: 'sealed' | '5ml' | '10ml' | '30ml' | 'opened' }[]): Promise<void> => {
  const saleRef = doc(db, 'sales', saleId);
  const now = new Date();

  await runTransaction(db, async (transaction) => {
    // 1. Verify all items exist and prepare writes (reads must be done first)
    const inventoryDocs = [];
    for (const item of items) {
      const inventoryRef = doc(db, 'inventory', item.productId);
      const inventoryDoc = await transaction.get(inventoryRef);

      if (inventoryDoc.exists()) {
        const invData = inventoryDoc.data() as InventoryItem;

        let fieldToUpdate = 'units';
        let currentValue = invData.units || 0;
        let newValue = currentValue + item.quantity;
        let kardexQuantity = item.quantity;

        if (item.variationType === 'opened') {
          // A sale of an opened bottle removes all ML. We can't easily know how much was in there,
          // but for cancellation logic, we'll assume there is now at least 1 remaining ML to restore
          // the opened state if it was sold as 'remate'.
          fieldToUpdate = 'openedBottleMl';
          currentValue = invData.openedBottleMl || 0;
          newValue = currentValue > 0 ? currentValue : 1;
          kardexQuantity = 0; // Doesn't affect numeric unit kardex
        } else if (item.variationType === '5ml') {
          fieldToUpdate = 'decants5ml';
          currentValue = invData.decants5ml || 0;
          newValue = currentValue + item.quantity;
          kardexQuantity = 0;
        } else if (item.variationType === '10ml') {
          fieldToUpdate = 'decants10ml';
          currentValue = invData.decants10ml || 0;
          newValue = currentValue + item.quantity;
          kardexQuantity = 0;
        } else if (item.variationType === '30ml') {
          fieldToUpdate = 'decants30ml';
          currentValue = invData.decants30ml || 0;
          newValue = currentValue + item.quantity;
          kardexQuantity = 0;
        }

        inventoryDocs.push({
          ref: inventoryRef,
          item: item,
          fieldToUpdate,
          newValue,
          kardexQuantity
        });
      }
      // If the product doesn't exist anymore, we just skip returning the stock and Kardex log.
      // This is necessary because if a dummy product was sold and then deleted, we still need
      // to be able to cancel the sale to remove the financial record.
    }

    // 2. Perform all writes
    for (const docData of inventoryDocs) {
      // Add stock back dynamically based on variation
      transaction.update(docData.ref, { [docData.fieldToUpdate]: docData.newValue });

      // Log ENTRADA to Kardex
      let logReason = 'Anulación de Venta';
      if (docData.item.variationType && docData.item.variationType !== 'sealed') {
        logReason = `Anulación de Venta (Decant ${docData.item.variationType})`;
        if (docData.item.variationType === 'opened') logReason = 'Anulación de Venta (Remate botella abierta)';
      }

      const kardexRef = doc(db, 'kardex_logs', generateId());
      transaction.set(kardexRef, {
        productId: docData.item.productId,
        quantity: docData.kardexQuantity, // Positive number or 0 for decants
        date: now.toISOString().split('T')[0],
        reason: logReason,
        timestamp: now.getTime(),
        type: 'ENTRADA'
      });
    }

    // 3. Delete the Sale record
    transaction.delete(saleRef);
  });
};

export const deleteSale = async (id: string): Promise<void> => {
  const docRef = doc(db, 'sales', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return;
  const sale = docSnap.data() as Sale;

  // Restore inventory items by querying individual products
  for (const item of sale.items) {
    // Attempt to find by ID directly first
    const invItemSnap = await getDoc(doc(db, 'inventory', item.productId));
    let invItem = invItemSnap.exists() ? (invItemSnap.data() as InventoryItem) : null;

    // If not found by ID, query by productId and storeId
    if (!invItem) {
      const q = query(
        collection(db, 'inventory'),
        where('productId', '==', item.productId),
        where('storeId', '==', sale.storeId)
      );
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        invItem = qSnap.docs[0].data() as InventoryItem;
      }
    }

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


import { RestockItem } from '../types';

export const getRestockItems = async (): Promise<RestockItem[]> => {
  const q = query(collection(db, 'restock_list'), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as RestockItem);
};

export const addRestockItem = async (item: Omit<RestockItem, 'id' | 'createdAt'>): Promise<RestockItem> => {
  const id = generateId();
  const newItem: RestockItem = {
    ...item,
    id,
    createdAt: Date.now()
  };
  await setDoc(doc(db, 'restock_list', id), newItem);
  return newItem;
};

export const updateRestockItem = async (item: RestockItem): Promise<RestockItem> => {
  await updateDoc(doc(db, 'restock_list', item.id), { ...item });
  return item;
};

export const deleteRestockItem = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'restock_list', id));
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
