# Homepage entry-point links

The Start with what you need cards now link to working destinations: weather model links open the homepage map, observations select the live-observation mode, atlases and tools open the Explore gallery, and municipal links open the profiler. Resource and catalogue links retain their respective pages. The community card is now Learn and contribute, linking to DS Lab and the shared Submit Data form without promising an unavailable community workflow.

Coloured theme chips are actual keyboard-accessible links with hover/focus styling. Weather/observations map links switch the displayed mode and scroll to the map, including repeated navigation within the homepage. External links open in a new tab. Unsupported hazard/export claims were removed from these entry cards.

Validation: lint, frontend Docker build and existing privacy regression tests passed. Browser checks confirmed the card destinations and observed Weather models and Observations chips changing to the correct map mode. Production acceptance pending. No backend, schema or authentication changes.
