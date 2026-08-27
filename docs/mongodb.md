# MongoDB

This app stores tenants, users, curriculum, and media metadata in MongoDB. Files under `mongo-data/` are **not** tables you can open in an editor. Use `mongosh` or MongoDB Compass to see and edit documents.

## Connection

| | |
| --- | --- |
| Host | `localhost:27017` (Compose publishes this port) |
| Database | `video_streaming` |
| URI | `mongodb://localhost:27017/video_streaming` (same as `MONGO_URI` in `.env`) |
| Auth | None in local Compose |

Start MongoDB if it is not already running:

```bash
docker compose up -d mongodb
```

## Why `mongo-data` has `.wt` files

Compose bind-mounts the database files here:

```yaml
volumes:
  - ./mongo-data:/data/db
```

MongoDB 7 uses the **WiredTiger** storage engine. Collections and indexes are stored as binary files such as:

- `*.wt` — collection and index data
- `WiredTiger*` — engine metadata
- `journal/` — write-ahead log
- `mongod.lock` — process lock while MongoDB is running

There are no JSON or SQL table files on disk. Opening or editing `.wt` files can **corrupt** the database. Always go through the MongoDB server.

## Open a shell (`mongosh`)

From the repo root:

```bash
docker compose exec mongodb mongosh video_streaming
```

You should see a prompt like:

```
video_streaming>
```

If `mongosh` is installed on the host, this is equivalent:

```bash
mongosh "mongodb://localhost:27017/video_streaming"
```

Leave the shell with `.exit`, `exit`, or `Ctrl+D`.

## Browse collections

```js
show collections
```

Count documents in every collection:

```js
db.getCollectionNames().sort().forEach((name) => {
  print(name.padEnd(24) + db.getCollection(name).estimatedDocumentCount());
});
```

Typical collections in this project:

| Collection | What it stores |
| --- | --- |
| `tenants` | Workspaces (name, slug, logo key) |
| `users` | Tenant admins and members (email, username, role, assigned departments) |
| `departments` | Departments in a tenant |
| `modules` | Modules under a department |
| `lessons` | Lessons under a module |
| `membermodules` | Extra modules assigned to a member |
| `videos` | Video metadata and storage keys |
| `audios` | Audio metadata and storage keys |
| `images` | Image metadata and storage keys |
| `pdfs` | PDF metadata and storage keys |
| `textareas` | Lesson text content |
| `quizzes` | Quizzes |
| `discussions` | Lesson discussions |
| `videoseens`, `audioseens`, `imageseens`, `pdfseens`, `textareaseens`, `quizseens` | Completion / seen records |

Mongoose stores collection names in lowercase (for example `MemberModule` → `membermodules`).

## Read documents

List a few fields:

```js
db.users.find({}, { name: 1, email: 1, username: 1, role: 1 }).pretty()
```

Find one by username:

```js
db.users.findOne({ username: "alice" })
```

Find by `_id` (must use `ObjectId`, not a plain string):

```js
db.departments.findOne({ _id: ObjectId("PASTE_ID_HERE") })
```

Limit and pretty-print:

```js
db.videos.find().limit(5).pretty()
```

Filter by tenant:

```js
db.modules.find({ tenantId: ObjectId("PASTE_TENANT_ID") }).pretty()
```

Copy `_id` values from `find` / `findOne` output. You need them for updates.

## Update documents

Changes apply immediately. The API and worker do not need a restart.

### One field

```js
db.users.updateOne(
  { _id: ObjectId("PASTE_ID_HERE") },
  { $set: { name: "New name" } }
)
```

A successful write looks like:

```
{ acknowledged: true, insertedId: null, matchedCount: 1, modifiedCount: 1, upsertedCount: 0 }
```

- `matchedCount: 1` — the filter found a document
- `modifiedCount: 1` — a field actually changed (`0` means the value was already the same)

### Several fields

```js
db.departments.updateOne(
  { _id: ObjectId("PASTE_ID_HERE") },
  { $set: { name: "Engineering", description: "Updated copy" } }
)
```

### Many documents

```js
db.users.updateMany(
  { role: "user" },
  { $set: { access: "learner" } }
)
```

### Nested / array fields

Assign departments to a member (replace the array):

```js
db.users.updateOne(
  { username: "alice" },
  { $set: { departmentIds: [ObjectId("DEPT_ID_1"), ObjectId("DEPT_ID_2")] } }
)
```

Add one department without replacing the rest:

```js
db.users.updateOne(
  { username: "alice" },
  { $addToSet: { departmentIds: ObjectId("DEPT_ID") } }
)
```

Remove one department:

```js
db.users.updateOne(
  { username: "alice" },
  { $pull: { departmentIds: ObjectId("DEPT_ID") } }
)
```

Unset a field:

```js
db.departments.updateOne(
  { _id: ObjectId("PASTE_ID_HERE") },
  { $unset: { description: "" } }
)
```

Confirm after writing:

```js
db.users.findOne({ username: "alice" })
```

## Insert and delete

Insert (only when you know the required fields; prefer the app for new users):

```js
db.discussions.insertOne({
  body: "Note",
  tenantId: ObjectId("PASTE_TENANT_ID"),
  createdAt: new Date(),
  updatedAt: new Date(),
})
```

Delete one:

```js
db.videos.deleteOne({ _id: ObjectId("PASTE_ID_HERE") })
```

Delete many (be careful):

```js
db.videoseens.deleteMany({ userId: ObjectId("PASTE_USER_ID") })
```

There is no undo. Back up first if the data matters.

## GUI: MongoDB Compass (local)

1. Install [MongoDB Compass](https://www.mongodb.com/products/compass).
2. Connect to `mongodb://localhost:27017`.
3. Open the `video_streaming` database.
4. Click a collection to view, filter, edit, or delete documents.

Compass is the same data as `mongosh`. Use whichever is easier.

## Compass on a VPS (SSH tunnel)

Do **not** connect Compass to `mongodb://YOUR_VPS_IP:27017` on the public internet. This Compose MongoDB has **no password**. Anyone who can reach port `27017` can read and change every document.

Keep MongoDB on the server bound to localhost, then tunnel from your laptop.

### 1. On the VPS: only listen on localhost

In `docker-compose.yml`, publish MongoDB on loopback instead of all interfaces:

```yaml
ports:
  - "127.0.0.1:27017:27017"
```

Then recreate the service:

```bash
docker compose up -d mongodb
```

Confirm the firewall does **not** allow `27017` from the world (`ufw`, security groups, etc.). SSH (`22`) is enough.

The API/worker on the same Compose network still use `mongodb://mongodb:27017/video_streaming`. They do not need the published port.

### 2. From your laptop: Compass built-in SSH tunnel (recommended)

1. Open Compass → **New connection**.
2. **Hostname** `127.0.0.1`, **Port** `27017` (Mongo as seen *on the VPS*, after SSH).
3. Open **Advanced connection options** → **SSH** / **Proxy / SSH Tunnel**.
4. Fill in:

   | Field | Value |
   | --- | --- |
   | SSH hostname | VPS public IP or DNS (`vps.example.com`) |
   | SSH port | `22` (unless you changed it) |
   | SSH username | your Linux user (`ubuntu`, `root`, …) |
   | SSH identity file | your private key (`~/.ssh/id_ed25519`) |

5. Connect. Open database `video_streaming`.

You authenticate to the **server** with SSH. Compass then talks to MongoDB as if it were `localhost:27017` on that server.

### 3. Alternative: tunnel in a terminal, then Compass as “local”

Leave this running in a terminal:

```bash
ssh -N -L 27018:127.0.0.1:27017 USER@YOUR_VPS_IP
```

`-L 27018:127.0.0.1:27017` means: laptop port **27018** forwards to **27017** on the VPS. Use `27018` if local Mongo is already using `27017`.

In Compass, connect with **no** SSH tab:

```
mongodb://127.0.0.1:27018/video_streaming
```

Stop the tunnel with `Ctrl+C` when you are done.

`mongosh` over the same tunnel:

```bash
mongosh "mongodb://127.0.0.1:27018/video_streaming"
```

### What not to do

- Do not set Compass hostname to the VPS public IP and open `27017` in the firewall.
- Do not use `0.0.0.0:27017:27017` on a public VPS.
- If you later add Mongo auth, still prefer the tunnel; auth is extra protection, not a reason to expose the port.

### Tunnel troubleshooting

| Symptom | What to do |
| --- | --- |
| Compass hangs / timeout | SSH as that user first: `ssh USER@YOUR_VPS_IP`. Fix keys/firewall before Compass. |
| `ECONNREFUSED` after SSH succeeds | Mongo is not listening on the VPS loopback. On the server run `docker compose ps` and check that `27017` is published. |
| Works on VPS with `docker compose exec mongodb mongosh` but not Compass | Published port missing or bound to the wrong interface. Use `127.0.0.1:27017:27017`. |
| Local Compass hits your **laptop** Mongo instead of the VPS | You used port `27017` without a tunnel, or the tunnel maps to the wrong local port. |

## Export readable JSON

If you want files you can open in an editor (this does **not** replace `mongo-data`):

```bash
docker compose exec -T mongodb mongoexport \
  --db=video_streaming \
  --collection=users \
  --jsonArray \
  --pretty
```

Write to a host file:

```bash
docker compose exec -T mongodb mongoexport \
  --db=video_streaming \
  --collection=users \
  --jsonArray \
  --pretty \
  > users.json
```

Restore later with `mongoimport`. These dumps are snapshots, not the live database.

## Safety

- Always wrap ids: `ObjectId("...")`. A string `"66c9…"` will not match `_id`.
- Do not set `passwordHash` to a plain password. The API stores bcrypt hashes. Change passwords through the app, or hash with bcrypt first.
- Unique indexes will reject duplicates: `users` is unique on `(tenantId, username)` and on email.
- Required fields (`email`, `name`, `username`, `tenantId`, and so on) should stay valid or the app will break.
- Do not change `originalStorageKey` / `hlsMasterPlaylistKey` unless the MinIO objects exist at those keys.
- Local Compose has **no** MongoDB auth. Anyone who can reach `localhost:27017` can read and write. Do not expose that port on a public network.

## Backup and restore

`mongo-data/` is the live WiredTiger directory. Copy it only while MongoDB is **stopped**, or use `mongodump`:

```bash
docker compose exec -T mongodb mongodump --db=video_streaming --archive > backup.archive
```

Restore:

```bash
docker compose exec -T mongodb mongorestore --archive --drop < backup.archive
```

Stopping MongoDB before copying `mongo-data/` is the same idea as the MinIO snapshot scripts: a consistent copy of the data directory.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| `mongosh` cannot connect | `docker compose up -d mongodb` and wait until healthy |
| `show collections` is empty | Confirm the prompt is `video_streaming>`, not `test>` (`use video_streaming`) |
| `matchedCount: 0` | Wrong `_id` or missing `ObjectId(...)` |
| `E11000 duplicate key` | Email or username already exists in that tenant |
| App still shows old data | Hard-refresh the browser; RTK Query may cache until refetch |
| Folder full of `.mongodb/mongosh` logs | Those are shell session logs, not collections; ignore them |

## Related

- Connection string: `.env` → `MONGO_URI`
- Mongoose models: `packages/shared/src/server/models/`
- Compose service: `docker-compose.yml` → `mongodb`
