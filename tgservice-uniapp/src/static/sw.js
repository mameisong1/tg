// 天宫国际 PWA Service Worker
const CACHE_NAME = 'tgservice-v1.2.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/manifest.json',
  '/static/icon-192.png',
  '/static/icon-512.png'
];

// 安装事件 - 缓存静态资源
self.addEventListener('install', (event) => {
  console.log('[SW] 安装中...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] 缓存静态资源');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] 安装完成');
        return self.skipWaiting();
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] 激活中...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] 删除旧缓存:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] 激活完成');
      return self.clients.claim();
    })
  );
});

// 请求拦截 - 网络优先策略（API请求），缓存优先策略（静态资源）
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // API请求：网络优先
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // 网络失败时返回离线提示
          return new Response(JSON.stringify({ error: '网络不可用' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }
  
  // 静态资源：缓存优先
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).then((fetchResponse) => {
          // 缓存新资源
          if (fetchResponse && fetchResponse.status === 200) {
            const responseToCache = fetchResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return fetchResponse;
        });
      })
  );
});