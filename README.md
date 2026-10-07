# Celebrations

Put someone you want to celebrate in the spotlight. Anyone can create a stage, design the
character on it, and share the link. Everyone who opens the link takes a seat in the audience
with their own avatar, writes a message (optionally with an action), and joins the line. The host
presses GO and the whole audience watches each message get delivered on stage.

## Run it

```bash
go run .
```

Then open the printed address.

- **`/`** – the landing page: what the app is, a button to create a stage, and the most recently
  created stages. Every stage is listed there, so anyone who visits can open any stage.
- **`/new`** – the creator: design the character (name, skin, hair, top, glasses, little visitors)
  with a live preview and create a stage.
- **`/s/{id}`** – a stage. Creating one gives you two links:
  - the **invite link** to share, and
  - a private **host link** (`?host=…`) that shows the GO button and "Clear all". The browser that
    created the stage remembers it is the host.

Flags:

| Flag | Default | What it does |
|---|---|---|
| `-addr` | `:8080` | Address to listen on |
| `-data` | `stages.json` | File every stage (audience, line, delivered messages) is saved to |
| `-dev` | off | Serve `web/` from disk instead of the copy built into the binary |

`go build` produces a single binary with the page built in.

## Sharing beyond your own Wi-Fi

The printed `http://192.168.…` address only works for people on the same network. For anyone else,
run the binary on a server with a public address, or put a tunnel in front of your machine. Invite
links are built from whatever address the page was opened at.

## Storage

Stages (the character, audience, line and delivered messages) are kept in a JSON file by default
(`-data`, `stages.json`). To keep them in MongoDB instead, set `MONGODB_URI` to the full connection
string, in `.env` locally. `deploy/deploy.sh` copies it into the live server's secure settings.

- One document per stage, in the `stages` collection of the `celebrations` database.
- The server works from memory, writes a stage to the database after each change, and reads
  everything once at start-up. If the database can't be reached at start-up the server exits
  with an error rather than quietly starting empty.
- The first time a database is used, stages from the data file are moved into it.
- With MongoDB Atlas, the server's address must be on the cluster's network access list.

## Scenes

Each stage is set in one of ten scenarios, chosen on the home page. A scenario gives the
character a set, something to wear, and a "moving prop" that plays now and then:

| Scene | Moving prop |
|---|---|
| Coder | Two little kids wander in; she dotes on them or shoos them off |
| Biker | She gets down from her motorbike, stretches, and climbs back on |
| Chef | The pancake flips out of the pan |
| DJ | The lasers come on and she dances |
| Teacher | A paper plane drifts across the classroom |
| Doctor | A little patient walks in |
| Artist | A cat strolls in to inspect the painting |
| Gardener | The flower on the bench blooms |
| Gamer | The dog turns up with a ball mid-game |
| Astronaut | A rocket (or a UFO) flies past |

The sets are hand-written SVG in `web/scenes.js`, one entry per scene, with the layers explained at
the top of the file. To add a scene, add an entry there and its name to `scenes` in `main.go`. The
server decides when each stage's prop plays and in which mood, so every screen shows the same thing.

## AI-drawn looks (optional)

**Currently switched off in the page:** the "describe them" box has been removed from the home
page for now. The server side described here is still in place for when it comes back.

On the home page you could describe the person on stage ("curly black hair in a bun, round glasses,
red scarf") and have Gemini draw their hair, accessories and colours onto the character. The box
only appears when the server has a Gemini API key:

Copy `.env.example` to `.env` and paste the key after `GEMINI_API_KEY=`. `.env` is ignored by
git. `go run .` reads it, and `deploy/deploy.sh` copies the key into the live server's secure
settings (a SecureString in Parameter Store). `GEMINI_MODEL` picks the model (default
`gemini-3.8-flash`).

How it stays safe and cheap (`avatar.go`):

- Gemini only draws into five slots (hair behind, hair in front, face, headwear, top). The body,
  face and arms stay ours, so every reaction still animates.
- Its answer is never used as markup. The server parses it into plain shapes and keeps only known
  tags and attributes with checked values; the page builds elements from that list.
- Each visitor gets 6 drawings per 10 minutes, and the whole site 400 a day.


## Deploying to AWS

```bash
deploy/deploy.sh
```

The first run creates everything; later runs ship a new build. It uses the `celebrations` AWS CLI
profile (set `AWS_PROFILE` to change that) and that profile's Region.

What it creates, as one CloudFormation stack named `celebrations` (`deploy/template.yaml`):

- one `t4g.micro` server running the binary as a systemd service, with `stages.json` on its disk;
- CloudFront in front of it, which provides the public `https://….cloudfront.net` address;
- a private S3 bucket holding the built binary;
- a fixed IP address, a role for the server, and a firewall rule that lets only CloudFront reach it.

There are no SSH keys. To look at the server, use Systems Manager Session Manager, or:

```bash
aws ssm start-session --target <ServerId from the stack outputs>
```

To remove everything, empty the bucket and delete the stack:

```bash
aws s3 rm s3://celebrations-app-<account>-<region> --recursive
aws cloudformation delete-stack --stack-name celebrations
```

Deleting the stack deletes the server and every stage saved on it.

## How it fits together

- `main.go` – the whole backend, standard library only. It keeps every stage in memory, saves them
  to the data file on every change, and pushes each stage's updates to its browsers over
  Server-Sent Events (`/api/stages/{id}/events`). Browsers act through small JSON POSTs
  (`/api/stages` to create, then `/join`, `/message`, `/go`, `/clear` under a stage).
- `avatar.go` – the optional AI-drawn looks: the Gemini call, the checks on what it returns, and
  the usage limits.
- `store.go` – where stages are kept: the JSON file or MongoDB.
- `web/index.html` – the stage (one SVG), styles and dialogs. The same page is the home page and
  every stage.
- `web/scenes.js` – the ten scenarios: sets, outfits, moving props and lines.
- `web/app.js` – draws avatars, keeps the screen in sync with the server and plays the animations.

Things worth knowing:

- Someone keeps their seat while they have the page open (plus 20 seconds, to survive a refresh).
  A message already in line stays there even if its sender closes the tab.
- The server holds up to 500 stages. When full, creating a new one retires the stage that has been
  quiet the longest, as long as nobody has it open.
