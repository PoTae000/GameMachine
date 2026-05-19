# Deploy SvelteKit to Cloudflare Workers

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
|---|---|
| `wrangler.toml` | Config หลักของ Cloudflare Workers (ชื่อ worker, KV binding, compatibility flags) |
| `svelte.config.js` | ต้องใช้ `@sveltejs/adapter-cloudflare` |
| `package.json` | ต้องมี dependency `@sveltejs/adapter-cloudflare` |
| `src/app.d.ts` | ประกาศ type ของ `platform.env` เพื่อเข้าถึง KV |
| `.svelte-kit/cloudflare/` | โฟลเดอร์ build output (สร้างอัตโนมัติจาก `bun run build`) |

---

## ขั้นตอนทั้งหมด

### 1. ติดตั้ง adapter

```bash
bun add -d @sveltejs/adapter-cloudflare
```

### 2. แก้ `svelte.config.js`

```js
import adapter from '@sveltejs/adapter-cloudflare';

const config = {
  kit: { adapter: adapter() }
};

export default config;
```

### 3. ประกาศ type ใน `src/app.d.ts`

```ts
declare global {
  namespace App {
    interface Platform {
      env: {
        DB: KVNamespace;  // ชื่อ binding ต้องตรงกับใน wrangler.toml
      };
    }
  }
}

export {};
```

ใน code ฝั่ง server เข้าถึง KV ผ่าน `platform.env.DB`:

```ts
// ตัวอย่าง
export async function GET({ platform }) {
  const data = await platform.env.DB.get('key');
  return new Response(data);
}
```

### 4. สร้าง `wrangler.toml`

```toml
name = "ชื่อ-worker"
main = ".svelte-kit/cloudflare/_worker.js"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = ".svelte-kit/cloudflare"

[[kv_namespaces]]
binding = "DB"
id = "ใส่ id จากขั้นตอนที่ 6"
```

- `name` = ชื่อ worker (จะเป็นส่วนหนึ่งของ URL)
- `main` = ชี้ไปที่ `_worker.js` ที่ SvelteKit build ออกมา
- `[assets]` = static files (JS, CSS, HTML)
- `nodejs_compat` = เปิดให้ใช้ Node.js API ใน Workers
- `[[kv_namespaces]]` = ผูก KV storage (เพิ่มได้หลายอัน)

### 5. Login เข้า Cloudflare

```bash
bunx wrangler login
```

เปิด browser ให้กด authorize

### 6. สร้าง KV Namespace

```bash
bunx wrangler kv namespace create DB
```

ได้ output:

```
✨ Success!
[[kv_namespaces]]
binding = "DB"
id = "abc123xxxxxxxxxxxxxxxxxxxxxxxx"
```

**เอา `id` ไปใส่ใน `wrangler.toml`**

### 7. Build

```bash
bun run build
```

สร้าง `.assetsignore` เพื่อไม่ให้ upload `_worker.js` เป็น static asset:

```bash
echo _worker.js > .svelte-kit/cloudflare/.assetsignore
```

### 8. Deploy

```bash
bunx wrangler deploy
```

ได้ URL: `https://ชื่อ-worker.xxxxxxxx.workers.dev`

---

## สรุปคำสั่งรันทั้งหมด (copy ไปวางได้เลย)

```bash
# ครั้งแรก
bun add -d @sveltejs/adapter-cloudflare
bunx wrangler login
bunx wrangler kv namespace create DB
# -> เอา id ไปใส่ wrangler.toml

# ทุกครั้งที่ deploy
bun run build
echo _worker.js > .svelte-kit/cloudflare/.assetsignore
bunx wrangler deploy
```

---

## ทดสอบ local ก่อน deploy

```bash
bun run build
bunx wrangler dev
```

เปิด `http://localhost:8787` ทดสอบได้เหมือน production (มี KV จริง)

---

## เพิ่ม KV Namespace อีกตัว

```bash
bunx wrangler kv namespace create CACHE
```

เพิ่มใน `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "id-ที่ได้มา"
```

เพิ่มใน `src/app.d.ts`:

```ts
interface Platform {
  env: {
    DB: KVNamespace;
    CACHE: KVNamespace;
  };
}
```

---

## Custom Domain (ถ้าต้องการ)

1. เข้า Cloudflare Dashboard > Workers & Pages > เลือก worker
2. Settings > Domains & Routes > Add > Custom Domain
3. ใส่ domain ที่ DNS อยู่บน Cloudflare แล้ว

หรือเพิ่มใน `wrangler.toml`:

```toml
routes = [
  { pattern = "example.com/*", zone_name = "example.com" }
]
```

---

## โครงสร้างไฟล์ขั้นต่ำ

```
project/
├── src/
│   ├── app.d.ts              # ประกาศ Platform type
│   ├── app.html
│   └── routes/
│       └── +page.svelte
├── svelte.config.js           # adapter-cloudflare
├── wrangler.toml              # Cloudflare config
├── package.json
└── tsconfig.json
```
