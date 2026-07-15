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
