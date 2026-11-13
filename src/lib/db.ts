import imgBrakePads from '../assets/images/part_brake_pads_1794609496324.jpg';
import imgChainKit from '../assets/images/part_chain_kit_1794609495312.jpg';
import imgEngineOil from '../assets/images/part_engine_oil_1794609496167.jpg';
import imgSparkPlug from '../assets/images/part_spark_plug_1794609496743.jpg';
import type { InventoryItem, Quote, WorkshopSettings } from '../types/workshop';

const DB_NAME = 'rd_motos_workshop_db';
const DB_VERSION = 1;
const STORE_INVENTORY = 'inventory';
const STORE_QUOTES = 'quotes';
const STORE_SETTINGS = 'settings';
const SEED_FLAG_KEY = 'rd_motos_seeded_v1';

export const DEFAULT_SETTINGS: WorkshopSettings = {
  name: 'RD Motos',
  phone: '',
  address: 'Oficina Especializada em Motocicletas',
  document: '',
  pixKey: '',
  defaultValidityDays: 7,
  defaultNotes: 'Garantia de 90 dias para peças e serviços. Valores sujeitos a alteração após a validade.',
  nextQuoteSequence: 1,
  servicePresets: [
    { id: 'srv_oil', name: 'Troca de óleo e filtro (Mão de obra)', defaultPrice: 35 },
    { id: 'srv_chain', name: 'Troca de kit relação + lubrificação', defaultPrice: 65 },
    { id: 'srv_brake', name: 'Troca de pastilha / lona de freio', defaultPrice: 45 },
    { id: 'srv_rev_basica', name: 'Revisão básica (freios, cabos, velas e regulagem)', defaultPrice: 120 },
    { id: 'srv_rev_geral', name: 'Revisão geral completa', defaultPrice: 240 },
    { id: 'srv_eletrica', name: 'Diagnóstico e reparo elétrico', defaultPrice: 80 },
  ],
};

function getStarterInventory(): InventoryItem[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'item_oil_10w40',
      name: 'Óleo Semissintético 4T 10W-40 (1L)',
      sku: 'OLE-10W40',
      brand: 'Motul 5100',
      category: 'Óleos & Fluidos',
      compatibleBikes: 'CG 160, Fazer 250, CB 300, Lander, XRE',
      quantity: 14,
      minQuantity: 5,
      costPrice: 38,
      salePrice: 62,
      location: 'Prateleira A1',
      photoDataUrl: imgEngineOil,
      updatedAt: now,
    },
    {
      id: 'item_chain_cg160',
      name: 'Kit Relação Aço 1045 c/ Retentor (Coroa/Pinhão/Corrente)',
      sku: 'REL-CG160',
      brand: 'Vaz Xtreme',
      category: 'Transmissão',
      compatibleBikes: 'Honda CG 160 Titan / Fan / Start',
      quantity: 4,
      minQuantity: 3,
      costPrice: 118,
      salePrice: 189,
      location: 'Prateleira B2',
      photoDataUrl: imgChainKit,
      updatedAt: now,
    },
    {
      id: 'item_brake_pad',
      name: 'Pastilha de Freio Dianteira Sinterizada',
      sku: 'FRE-N940',
      brand: 'Cobreq Street',
      category: 'Freios',
      compatibleBikes: 'CG 160 Titan/Fan CBS, Bros 160, XRE 190',
      quantity: 2,
      minQuantity: 4,
      costPrice: 28,
      salePrice: 58,
      location: 'Gaveta C1',
      photoDataUrl: imgBrakePads,
      updatedAt: now,
    },
    {
      id: 'item_spark_plug',
      name: 'Vela de Ignição Iridium CR9EIX',
      sku: 'VEL-CR9E',
      brand: 'NGK Iridium',
      category: 'Motor & Ignição',
      compatibleBikes: 'Fazer 250, CB Twister 250, Lander 250, Ninja 300',
      quantity: 9,
      minQuantity: 3,
      costPrice: 46,
      salePrice: 82,
      location: 'Gaveta D3',
      photoDataUrl: imgSparkPlug,
      updatedAt: now,
    },
    {
      id: 'item_air_filter',
      name: 'Filtro de Ar Elemento Espuma / Papel',
      sku: 'FIL-CG160',
      brand: 'Vedamotors',
      category: 'Filtros',
      compatibleBikes: 'Honda CG 160 (2016 a 2025)',
      quantity: 6,
      minQuantity: 3,
      costPrice: 19,
      salePrice: 38,
      location: 'Prateleira A4',
      updatedAt: now,
    },
    {
      id: 'item_battery_5ah',
      name: 'Bateria Selada 12V 5Ah (M5)',
      sku: 'BAT-12V5A',
      brand: 'Moura Moto',
      category: 'Elétrica',
      compatibleBikes: 'CG 150/160, Biz 125, Bros 150/160, Factor 125/150',
      quantity: 3,
      minQuantity: 2,
      costPrice: 125,
      salePrice: 195,
      location: 'Bancada E1',
      updatedAt: now,
    },
  ];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_INVENTORY)) {
        db.createObjectStore(STORE_INVENTORY, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_QUOTES)) {
        db.createObjectStore(STORE_QUOTES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runTx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function initializeDatabase(): Promise<{
  inventory: InventoryItem[];
  quotes: Quote[];
  settings: WorkshopSettings;
}> {
  const [existingInventory, existingQuotes, settingsRecord] = await Promise.all([
    runTx<InventoryItem[]>(STORE_INVENTORY, 'readonly', (s) => s.getAll()),
    runTx<Quote[]>(STORE_QUOTES, 'readonly', (s) => s.getAll()),
    runTx<{ key: string; value: WorkshopSettings } | undefined>(STORE_SETTINGS, 'readonly', (s) =>
      s.get('workshop')
    ),
  ]);

  let inventory = existingInventory ?? [];
  let settings = settingsRecord?.value ?? DEFAULT_SETTINGS;

  if (!settingsRecord) {
    await saveWorkshopSettings(DEFAULT_SETTINGS);
  }

  const alreadySeeded = typeof localStorage !== 'undefined' && localStorage.getItem(SEED_FLAG_KEY) === '1';
  if (inventory.length === 0 && !alreadySeeded) {
    const starter = getStarterInventory();
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_INVENTORY, 'readwrite');
      const store = tx.objectStore(STORE_INVENTORY);
      for (const item of starter) {
        store.put(item);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SEED_FLAG_KEY, '1');
    }
    inventory = starter;
  }

  const sortedQuotes = [...(existingQuotes ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return {
    inventory: inventory.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    quotes: sortedQuotes,
    settings,
  };
}

export async function saveInventoryItem(item: InventoryItem): Promise<void> {
  await runTx(STORE_INVENTORY, 'readwrite', (s) => s.put(item));
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SEED_FLAG_KEY, '1');
  }
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await runTx(STORE_INVENTORY, 'readwrite', (s) => s.delete(id));
}

export async function saveQuote(quote: Quote): Promise<void> {
  await runTx(STORE_QUOTES, 'readwrite', (s) => s.put(quote));
}

export async function deleteQuote(id: string): Promise<void> {
  await runTx(STORE_QUOTES, 'readwrite', (s) => s.delete(id));
}

export async function saveWorkshopSettings(settings: WorkshopSettings): Promise<void> {
  await runTx(STORE_SETTINGS, 'readwrite', (s) => s.put({ key: 'workshop', value: settings }));
}

export async function exportAllData(): Promise<string> {
  const data = await initializeDatabase();
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: 'RD Motos',
      version: 1,
      ...data,
    },
    null,
    2
  );
}

export async function importAllData(jsonString: string): Promise<{
  inventory: InventoryItem[];
  quotes: Quote[];
  settings: WorkshopSettings;
}> {
  const parsed = JSON.parse(jsonString) as Partial<{
    inventory: InventoryItem[];
    quotes: Quote[];
    settings: WorkshopSettings;
  }>;

  if (!Array.isArray(parsed.inventory) || !Array.isArray(parsed.quotes)) {
    throw new Error('Arquivo de backup inválido.');
  }

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_INVENTORY, STORE_QUOTES, STORE_SETTINGS], 'readwrite');
    const invStore = tx.objectStore(STORE_INVENTORY);
    const quoteStore = tx.objectStore(STORE_QUOTES);
    const settingsStore = tx.objectStore(STORE_SETTINGS);

    invStore.clear();
    for (const item of parsed.inventory!) {
      invStore.put(item);
    }

    quoteStore.clear();
    for (const quote of parsed.quotes!) {
      quoteStore.put(quote);
    }

    if (parsed.settings) {
      settingsStore.put({ key: 'workshop', value: { ...DEFAULT_SETTINGS, ...parsed.settings } });
    }

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SEED_FLAG_KEY, '1');
  }

  return initializeDatabase();
}
