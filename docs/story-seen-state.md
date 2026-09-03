# Story Seen State

## Data Structure

**File:** `.instagram-cli/storage/seen-stories_{username}.json`

Stored alongside session data (already uses restricted permissions). One file per account — no cross-account leaking.

Seen state is tracked per user as a single timestamp: the `taken_at` of the last viewed story — mirroring the API's per-reel `seen` value. Everything else is derived from it.

```json
{
	"lastUpdated": 1712345678,
	"users": {
		"12345": 1712345600,
		"67890": 1712345400
	}
}
```

## Deriving State

| Question            | Derivation                                         |
| ------------------- | -------------------------------------------------- |
| All stories seen?   | `seen >= latest_reel_media` (tray item field)      |
| First unseen index? | First story with `taken_at > seen` (else replay 0) |

No per-story bookkeeping: the timestamp only moves forward, and expired/deleted stories are naturally ignored (no ID pruning needed).

## Flow

### Tray fetch

```
Fetch reelsTray
  → For each reel, compare seen against latest_reel_media
  → If seen >= latest_reel_media → dimmed text in sidebar
  → Otherwise → normal text
```

The tray item already contains `latest_reel_media` (timestamp of the newest story) — no lazy-loading needed for the dimming decision. `getReelsTray` exposes it as `latestReelMediaByUser`.

### Select a reel

```
User selects a reel
  → Load stories via getStoriesForUser()
  → Find first story with taken_at > seen (by index order)
  → If none found → start from story 0 (replay)
  → If unseen exists → start from that index
```

### View a story

```
User views a story
  → seen = max(seen, story.taken_at)
  → Persist to disk (debounced 500ms + flush on exit)
```

### Cleanup

```
On each successful tray fetch:
  → Strip any user IDs no longer present in the tray
```

## Display

| State                     | Sidebar     |
| ------------------------- | ----------- |
| Seen (all stories seen)   | Dimmed text |
| Unseen (any story unseen) | Normal text |

Two states only — no gradient rings or partial indicators.

## Flow Diagram

flowchart TD
Start([Start CLI System]) --> LoadData[Check seen-stories JSON]

    FileCheck{File exists?}
    LoadData --> FileCheck
    FileCheck -->|No| InitJSON[Create empty JSON structure]
    FileCheck -->|Yes| ReadJSON[Read seen stories JSON into memory]

    ReadJSON --> ValidateJSON{Is JSON<br/>malformed?}
    ValidateJSON -->|Yes| BackupJSON[Backup corrupted file<br/>as seen-stories.corrupt]
    BackupJSON --> InitJSON
    ValidateJSON -->|No| TrayFetch[Fetch reelsTray API]

    InitJSON --> TrayFetch

    subgraph Tray Fetch & Processing
        TrayFetch --> PerReel[For each reel in tray]
        PerReel --> Cleanup[Cleanup: Strip stored users<br/>not in current tray]
        Cleanup --> CompareSeen{seen >=<br/>latest_reel_media?}

        CompareSeen -->|Yes| MarkSeen[Mark reel as seen <br/>Set carouselIndex = 0]
        CompareSeen -->|No| MarkUnseen[Set carouselIndex = first story<br/>with taken_at > seen]
    end

    MarkSeen --> PreFetch[Pre-fetch stories for first 3 users<br/>via getStoriesForUser]
    MarkUnseen --> PreFetch
    PreFetch --> RenderSidebar[Render Sidebar <br/> Display with dimmed text reels with all stories seen]

    RenderSidebar --> NavLoop{Keyboard Input}

    %% Navigation Choices
    NavLoop -->|Up / Down| SwitchReel[Step selectedIndex +/- 1 <br/> Switch selected reel]
    NavLoop -->|Left / Right| StepStory[Step carouselIndex +/- 1]
    NavLoop -->|Exit / Quit| Exit[Flush & Exit]

    %% Display & Marking
    SwitchReel --> LoadCheck{Stories loaded<br/>for this reel?}
    LoadCheck -->|No| LoadStories[Load stories via<br/>getStoriesForUser]
    LoadCheck -->|Yes| RenderViewer[Render active story]
    LoadStories --> RenderViewer

    StepStory --> RenderViewer

    RenderViewer --> AutoMark[seen = max(seen, story.taken_at)<br/>Debounced disk write - 500ms]
    AutoMark --> CheckSeen{seen >=<br/>latest_reel_media?}
    CheckSeen -->|Yes| DimReel[Mark reel as seen]
    CheckSeen -->|No| RenderSidebar
    DimReel --> RenderSidebar

    %% Termination
    Exit --> FlushDisk[Flush pending writes to JSON]
    FlushDisk --> End([End])
