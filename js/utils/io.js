// 読み込みと IndexedDB ストレージ操作

/**
 * Phaser プラグイン: アセット一括ロード
 * @param {Phaser.Loader.LoaderPlugin} loader
 * @param {{images?:[], audios?:[]}} manifest
 */
export function loadAssets(loader, manifest) {
  const { images = [], audios = [] } = manifest;
  images.forEach(({ key, url }) => loader.image(key, url));
  audios.forEach(({ key, url }) => loader.audio(key, url));
}

/**
 * テキストファイルをフェッチして内容を返す
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function readTextFile(url) {
  const res = await fetch(url,{cache: 'reload'});
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  return res.text();
}

/**
 * File オブジェクトを dataURL に変換
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = e => reject(e);
    reader.readAsDataURL(file);
  });
}

// IndexedDB 用定数
const DB_NAME = 'ChatMonDB';
const DB_VERSION = 1;
const STORE_NAME = 'storage';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject('IndexedDB open error');
    req.onsuccess = e => resolve(e.target.result);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

/** save key/value to IndexedDB */
export async function saveStorageData(key, value) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.put({ key, data: value });
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej('IndexedDB save error');
  });
}

/** load value by key from IndexedDB */
export async function loadStorageData(key) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const req = store.get(key);
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result?.data ?? null);
    req.onerror = () => rej('IndexedDB load error');
  });
}

/** remove key from IndexedDB */
export async function removeStorageData(key) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(key);
  return new Promise(res => { tx.oncomplete = () => res(); });
}

/** check if key exists in IndexedDB */
export async function existsStorageData(key) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const req = tx.objectStore(STORE_NAME).get(key);
  return new Promise(res => {
    req.onsuccess = () => res(req.result !== undefined);
    req.onerror = () => res(false);
  });
}
