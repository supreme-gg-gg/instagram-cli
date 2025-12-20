## Instagram Wrapped Implementation Plan

Based on my exploration of the codebase and the Instagram Private API, here's a concise implementation plan:

---

### 1. Architecture Overview

```
source/
├── commands/
│   └── wrapped.tsx              # New Pastel command entry point
├── utils/
│   └── wrapped-analytics.ts     # Data collection & aggregation logic
├── types/
│   └── wrapped.ts               # Type definitions for wrapped stats
├── ui/
│   ├── views/
│   │   └── wrapped-view.tsx     # Main orchestration view with slides
│   └── components/
│       ├── wrapped-slide.tsx    # Base slide component
│       ├── heatmap-chart.tsx    # Message frequency visualization
│       └── stat-card.tsx        # Reusable stat display component
```

---

### 2. Data Collection Strategy

#### API Endpoints to Use (via `instagram-private-api`)

| Feature                 | API Feed                                                                | Method                          | Pagination                     |
| ----------------------- | ----------------------------------------------------------------------- | ------------------------------- | ------------------------------ |
| **Messages**            | `ig.feed.directInbox()` → `ig.feed.directThread()`                      | `items()` + `isMoreAvailable()` | Cursor-based                   |
| **Followers/Following** | `ig.feed.accountFollowers(userId)` / `ig.feed.accountFollowing(userId)` | `items()` + `isMoreAvailable()` | `next_max_id`                  |
| **User's Posts**        | `ig.feed.user(userId)`                                                  | `items()` + `isMoreAvailable()` | `next_max_id`                  |
| **Liked Posts**         | `ig.feed.liked()` (LikedFeed)                                           | `items()` + `isMoreAvailable()` | `next_max_id`                  |
| **User Info**           | `ig.user.info(userId)`                                                  | Single call                     | N/A                            |
| **Media Comments**      | `ig.feed.mediaComments(mediaId)`                                        | `items()`                       | Cursor-based                   |
| **Story Viewers**       | `ig.feed.listReelMediaViewers(mediaId)`                                 | `items()`                       | N/A (only for current stories) |

#### Pagination Pattern

```typescript
async function getAllItemsFromFeed<T>(feed: Feed<any, T>): Promise<T[]> {
	const items: T[] = [];
	do {
		items.push(...(await feed.items()));
	} while (feed.isMoreAvailable());
	return items;
}
```

---

### 3. Implementation Steps

#### Phase 1: Types & Service Layer

1. **Create `source/types/wrapped.ts`** – Define interfaces:

   ```typescript
   export type WrappedStats = {
   	messaging: MessagingStats;
   	social: SocialStats;
   	media: MediaStats;
   	feed: FeedStats;
   };

   export type MessagingStats = {
   	messageFrequency: Map<string, {sent: number; received: number}>; // date → counts
   	topChatPartners: Array<{user: User; messageCount: number}>;
   	longestChatSession: {
   		partner: User;
   		durationMinutes: number;
   		messageCount: number;
   	};
   	reelsSent: number;
   	reelsReceived: number;
   };
   // ... similar for SocialStats, MediaStats, FeedStats
   ```

2. **Create `source/services/wrapped-analytics.ts`** – Core data collection:
   - `collectMessagingStats(ig, yearStart)` – Paginate through all threads and messages
   - `collectSocialStats(ig, currentUserId)` – Fetch followers/following for delta calculation
   - `collectMediaStats(ig, currentUserId, yearStart)` – User's posts + engagement
   - `collectFeedStats(ig, yearStart)` – Liked posts aggregation
   - Rate limiting via delays between paginated calls

#### Phase 2: Command & UI

3. **Create `source/commands/wrapped.tsx`** – Pastel command:

   ```typescript
   export const args = zod.tuple([]);
   export const options = zod.object({
   	year: zod
   		.number()
   		.optional()
   		.default(new Date().getFullYear() - 1),
   });
   export default function Wrapped({options}) {
   	/* ... */
   }
   ```

4. **Create `source/ui/views/wrapped-view.tsx`** – Multi-slide presentation:
   - Progress indicator during data loading
   - Keyboard navigation between slides (←/→)
   - Sections: Intro → Messaging → Social → Media → Feed → Summary

5. **Create visualization components**:
   - `heatmap-chart.tsx` – ASCII/Ink heatmap for message frequency
   - `stat-card.tsx` – Gradient-styled cards (reuse existing `ink-gradient` pattern)

#### Phase 3: Caching & Performance

6. **Add caching in `ConfigManager`**:
   - Store intermediate results in `.instagram-cli/cache/wrapped-{year}.json`
   - Allow resuming interrupted data collection
   - Add progress callbacks for UI updates

---

### 4. Key Technical Challenges & Solutions

| Challenge                   | Solution                                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Rate limiting**           | Add configurable delays (default 1-2s) between API calls; use exponential backoff on errors                    |
| **Large data volumes**      | Stream processing – aggregate as we paginate, don't store all raw messages                                     |
| **Missing historical data** | Liked feed may not go back a full year; document limitations in UI                                             |
| **Stories limitation**      | Instagram doesn't store old stories; only track count from user's media feed (`media_type === 2` for stories)  |
| **Follower delta**          | No historical API; store current snapshot and compare to future runs, or estimate from "new friends" heuristic |

---

### 5. API Limitations & Workarounds

| Metric                                                    | Limitation                         | Workaround                                                          |
| --------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------- |
| Followers/following count change                          | No historical endpoint             | Store baseline on first run; show YoY if run previously             |
| "New friends" (new followers you followed back + chatted) | Requires cross-referencing         | Intersect follower list with DM threads opened this year            |
| Most-liked story                                          | Stories expire after 24h           | Use `media_type` filter on user feed; engagement proxy via comments |
| User's top comments                                       | No direct feed for user's comments | Scrape from user's posts that they commented on (limited)           |

---

### 6. File Creation Order

1. `source/types/wrapped.ts`
2. `source/utils/wrapped-analytics.ts`
3. `source/commands/wrapped.tsx`
4. `source/ui/components/stat-card.tsx`
5. `source/ui/components/heatmap-chart.tsx`
6. `source/ui/views/wrapped-view.tsx`
7. mock-data.ts – Add mock wrapped data
8. `tests/wrapped.test.tsx` – Unit tests

---

### 7. Mock Mode Support

Add to mock-data.ts:

```typescript
export const mockWrappedStats: WrappedStats = {
	/* ... */
};
```

Update cli.mock.ts to support `--wrapped` flag.

---

### 8. Estimated Effort

| Component                           | Effort          |
| ----------------------------------- | --------------- |
| Types & interfaces                  | 1 hour          |
| Analytics service (data collection) | 4-6 hours       |
| Command & basic UI                  | 2 hours         |
| Visualization components            | 3-4 hours       |
| Caching & progress                  | 2 hours         |
| Testing & polish                    | 2-3 hours       |
| **Total**                           | **14-18 hours** |

---

### 9. Documentation

Create `docs/wrapped-design.md` following existing patterns in docs to document:

- Feature overview
- Data sources and limitations
- Caching strategy
- UI component hierarchy
