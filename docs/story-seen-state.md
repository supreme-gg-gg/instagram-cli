# Story Seen State

## Data Structure

**File:** `.instagram-cli/storage/seen-stories_{username}.json`

Stored alongside session data (already uses restricted permissions). One file per account — no cross-account leaking.

```json
{
	"lastUpdated": 1712345678,
	"users": {
		"12345": {
			"seenStories": ["123456789012345_1", "123456789012345_2"]
		},
		"67890": {
			"seenStories": ["987654321098765_1"]
		}
	}
}
```

## Flow

### Tray fetch

```
Fetch reelsTray
  → For each reel, compare media_ids against local seenStories
  → If ALL media_ids match → dimmed text in sidebar
  → Otherwise → normal text
```

The tray item already contains `media_ids: string[]` — no lazy-loading needed for the dimming decision. Current code discards this, keep it.

### Select a reel

```
User selects a reel
  → Load stories via getStoriesForUser()
  → Find first story NOT in seenStories (by index order)
  → If none found → start from story 0 (replay)
  → If unseen exists → start from that index
  → The list of stories per reel are checked by order, and in case a story is not available anymore, its deleted from the local storage file.
    So for example, if we have [storyA, storyB, storyC], each item will be compared with the current reel in that order.
    Let's say story B doesn't longer exist, so when comparing storyB with current reel, its deleted from the file, and then proceed to story C.
```

### View a story

```
User views a story
  → Add story id to seenStories set
  → Persist to disk (debounced 500ms + flush on exit)
```

### Cleanup

```
On each load, before comparison:
  → Strip any user IDs not present in the fetched media_ids
```

Expired/deleted stories automatically disappear from the file.

## Display

| State                     | Sidebar     |
| ------------------------- | ----------- |
| Seen (all stories match)  | Dimmed text |
| Unseen (any story unseen) | Normal text |

Two states only — no gradient rings or partial indicators.

## Flow Diagram

flowchart TD
Start([Start CLI System]) --> LoadData[Check seen-stories JSON]

    FileCheck{File exists?}
    LoadData --> FileCheck
    FileCheck -->|No| InitJSON[Create empty JSON structure]
    FileCheck -->|Yes| ReadJSON[Read seenStories into memory]

    ReadJSON --> ValidateJSON{Is JSON<br/>malformed?}
    ValidateJSON -->|Yes| BackupJSON[Backup corrupted file<br/>as seen-stories.corrupt]
    BackupJSON --> InitJSON
    ValidateJSON -->|No| TrayFetch[Fetch reelsTray API]

    InitJSON --> TrayFetch

    subgraph Tray Fetch & Processing
        TrayFetch --> PerReel[For each reel in tray]
        PerReel --> Cleanup[Cleanup: Filter out saved IDs<br/>not in fetched media_ids]
        Cleanup --> ComputeUnseen[Compute unseen set per user<br/>using mediaIdsByUser]
        ComputeUnseen --> CompareLoop{Are ALL fetched<br/>media_ids in seenStories?}

        CompareLoop -->|Yes| MarkSeen[Mark reel as seen <br/>Set carouselIndex = 0]
        CompareLoop -->|No| MarkUnseen[Set carouselIndex = first unseen index]
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

    RenderViewer --> AutoMark[Add story ID to seenStories<br/>Debounced disk write - 500ms]
    AutoMark --> CheckSeen{Are ALL media_ids<br/>for this reel in seenStories?}
    CheckSeen -->|Yes| DimReel[Mark reel as seen]
    CheckSeen -->|No| RenderSidebar
    DimReel --> RenderSidebar

    %% Termination
    Exit --> FlushDisk[Flush pending writes to JSON]
    FlushDisk --> End([End])
