# Municipal workspace draft workflow

Drafts remain local to the browser, with JSON backup export and validated import. Import requires an explicit Restore click and replaces the current draft; the previous state is available through Undo. Storage failures are shown and unreadable stored drafts are not silently overwritten. Clearing an unreadable draft is an explicit replacement.

Priorities store evidence IDs; actions store priority IDs. Editing preserves IDs. Existing action titles migrate only when a single priority matches; ambiguous legacy links remain unresolved. Removing linked evidence or priorities is blocked until references are edited. Undo restores the state before the most recent removal, clear or restore.

Evidence records capture the municipality selected when saved. Changing the planning area preserves captured evidence and warns about review; mismatched records are labelled. Legacy evidence without a captured municipality retains its location and needs review. This does not infer geographical overlap or remap old boundary versions.

The brief includes supporting evidence, linked priorities and missing owners/links. Impact, confidence and approval status remain user-entered judgements. Multi-municipality draft management, server collaboration and live source ingestion are not implemented by this change.
