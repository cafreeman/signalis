# Update Spec With Foundry

## Overview
Perform precise, idempotent updates to specification documents using intelligent edit command strategies.

## Context Gathering & Preparation

**Specification Loading & Validation:**
1. **Current State Assessment:** Load target specification using load_spec to understand current content and structure
2. **User Intent Analysis:** Understand specific changes requested and map to appropriate edit command patterns
3. **Content Validation:** Verify current spec content to ensure edit commands target exact text for reliable execution

**Parameter Resolution:**
- **Missing Project Name:** Use list_projects to guide user selection of correct project
- **Missing Spec Query:** Execute list_specs and present options for user to choose target specification
- **Update Requirements:** Clarify specific changes needed and validate against current spec structure

## Intelligent Edit Command Strategy

### Command Selection & Planning

**Task Management Operations:**
- **Mark Task Complete:** Use `set_task_status` with exact task text and "done" status
- **Reopen Task:** Use `set_task_status` with exact task text and "todo" status
- **Add New Task:** Use `upsert_task` with new task content in proper checkbox format
- **Modify Task:** Use `upsert_task` with updated task description (replaces existing)

**Content Addition Operations:**
- **Add Requirements:** Use `append_to_section` targeting "## Requirements" or specific subsection
- **Expand Implementation:** Use `append_to_section` targeting "## Implementation Approach"
- **Update Notes:** Use `append_to_section` targeting appropriate notes.md section
- **Extend Acceptance Criteria:** Use `append_to_section` targeting "## Acceptance Criteria"

**Critical Edit Rules:**
- **Task Files:** Never use `append_to_section` on task-list.md - only `upsert_task` and `set_task_status`
- **Spec/Notes Files:** Only use `append_to_section` for adding content to spec.md and notes.md
- **Exact Text Matching:** Selectors must match existing content precisely including whitespace

**Selector normalization & idempotence**:
- **Tasks selector normalization:** Matching ignores checkbox prefix, collapses internal whitespace, and ignores trailing periods. Either of these values works: `Implement OAuth2 integration` or `- [ ] Implement OAuth2 integration`.
- **Section headers:** Case-insensitive match on the full header string including hashes (surrounding whitespace trimmed). Use exact header text like `## Requirements`.
- **Idempotence:** Commands are repeat-safe; unchanged operations may be reported as skipped/idempotent.

## Comprehensive Update Workflow

### Step 1: Current State Analysis & Content Review
**Specification Loading:**
- Execute load_spec if target specification not already loaded in current session
- Review complete current content including spec.md, task-list.md, and notes.md
- Identify exact text for selectors to ensure reliable command targeting and execution

**Content Structure Assessment:**
- Understand current section organization and naming conventions
- Identify existing tasks and their current completion status
- Note areas where content additions would be most appropriate and valuable

### Step 2: Edit Command Planning & Validation
**Command Type Selection:**
Based on user intent, choose appropriate command patterns:

**Task Status Updates:**
```json
// Mark specific task as completed
{"target":"tasks","command":"set_task_status","selector":{"type":"task_text","value":"- [ ] Implement user authentication"},"status":"done"}

// Reopen completed task for additional work
{"target":"tasks","command":"set_task_status","selector":{"type":"task_text","value":"- [x] Setup database schema"},"status":"todo"}
```

**Task Content Management:**
```json
// Add new implementation task
{"target":"tasks","command":"upsert_task","selector":{"type":"task_text","value":"- [ ] Add password reset functionality"},"content":"- [ ] Add password reset functionality"}

// Update existing task with more specific details
{"target":"tasks","command":"upsert_task","selector":{"type":"task_text","value":"- [ ] Basic auth"},"content":"- [ ] Implement JWT-based authentication with refresh tokens"}
```

**Specification Content Expansion:**
```json
// Add new functional requirement
{"target":"spec","command":"append_to_section","selector":{"type":"section","value":"## Requirements"},"content":"- Support for two-factor authentication using TOTP"}

// Extend implementation approach with technical details
{"target":"spec","command":"append_to_section","selector":{"type":"section","value":"## Implementation Approach"},"content":"Authentication will use JWT tokens with 15-minute expiration and secure refresh mechanism"}
```

**Design Notes Enhancement:**
```json
// Add implementation insight or decision rationale
{"target":"notes","command":"append_to_section","selector":{"type":"section","value":"## Technical Decisions"},"content":"Chose JWT over sessions for better scalability in distributed environment"}
```

### Step 3: User Confirmation & Command Verification
**Edit Command Review:**
- Present proposed edit commands with clear description of intended changes
- Explain which files and sections will be modified and how content will be added/updated
- Confirm that edit commands align with user's intended modifications and development goals
- Verify selector text matches current specification content exactly for reliable execution

**Content Quality Validation:**
- Ensure new content follows specification formatting conventions and quality standards
- Validate that task additions use proper markdown checkbox format and clear descriptions
- Confirm that content additions enhance rather than duplicate existing information

### Step 4: Atomic Command Execution
**Execute Complete Update Operation:**
```json
{"name":"update_spec","arguments":{"project_name":"$1","spec_name":"$2","commands":[/* array of validated edit commands */]}}
```

Note: `commands` is required and must be a JSON array when using MCP tools. When using the CLI directly, pass the same array as a JSON string argument.

### Minimal Valid Example
```json
{"name":"update_spec","arguments":{"project_name":"$1","spec_name":"$2","commands":[
  {"target":"spec","command":"append_to_section","selector":{"type":"section","value":"## Overview"},"content":"New line"}
]}}
```

### Supported Operations
- Task Management: `set_task_status`, `upsert_task`
- Content Addition: `append_to_section`
- Content Removal: `remove_list_item`, `remove_from_section`, `remove_section`
- Content Replacement: `replace_list_item`, `replace_in_section`, `replace_section_content`

### Recommended Ordering
1) remove_list_item → 2) replace_in_section → 3) replace_section_content → 4) append_to_section

## Error Recovery & Problem Resolution

### Command Execution Issues
**Selector Targeting Failures:**
- **Text Not Found:** Re-load current specification content, copy exact text including whitespace, retry with precise selector
- **Ambiguous Matches:** Use longer text snippets with surrounding context for unique identification
- **Section Missing:** Guide user to add target section first or suggest alternative existing section
- **Candidate Suggestions:** On failure, the tool returns selector candidates with previews; copy one suggestion into your next attempt.

**Command Structure Problems:**
- **Invalid JSON Format:** Review command syntax and fix structural issues with proper escaping
- **Target Mismatches:** Ensure task commands use "tasks" target, spec/notes commands use appropriate targets
- **Content Format Issues:** Validate markdown syntax, checkbox format for tasks, and section header structure

### Content & Logic Validation
**Idempotency & Consistency:**
- **Duplicate Content Detection:** Check if similar content already exists before adding new information
- **Task Status Conflicts:** Verify current task completion status before attempting status changes
- **Logical Content Flow:** Ensure new content maintains logical progression and doesn't contradict existing information

**Quality Assurance:**
- **Content Completeness:** Verify that additions provide sufficient detail for implementation guidance
- **Technical Accuracy:** Ensure updates align with project tech stack and architectural patterns
- **User Value:** Confirm that changes enhance rather than complicate the specification

## Advanced Update Patterns & Batch Operations

### Complex Multi-Command Updates
**Development Progress Tracking:**
```json
[
  {"target":"tasks","command":"set_task_status","selector":{"type":"task_text","value":"- [x] Database schema design"},"status":"done"},
  {"target":"tasks","command":"upsert_task","selector":{"type":"task_text","value":"- [ ] API endpoint implementation"},"content":"- [ ] API endpoint implementation"},
  {"target":"notes","command":"append_to_section","selector":{"type":"section","value":"## Implementation Notes"},"content":"Database migration completed successfully, ready for API development"}
]
```

**Feature Scope Evolution:**
```json
[
  {"target":"spec","command":"append_to_section","selector":{"type":"section","value":"## Requirements"},"content":"- Integration with third-party payment processor"},
  {"target":"tasks","command":"upsert_task","selector":{"type":"task_text","value":"- [ ] Payment integration research"},"content":"- [ ] Payment integration research"},
  {"target":"notes","command":"append_to_section","selector":{"type":"section","value":"## External Dependencies"},"content":"Payment processor selection impacts security compliance requirements"}
]
```

## Workflow Continuity & Development Progression

### After Successful Updates
**Progress Assessment:**
- **Load Updated Spec:** Use `/foundry_load_spec` to review updated content and assess current development status
- **Related Spec Impact:** Consider whether updates affect other specifications or project components
- **Next Development Steps:** Identify logical next tasks or areas needing attention based on completed updates

**Quality Maintenance:**
- **Content Consistency:** Verify all changes maintain logical flow and technical accuracy across documents
- **Task Dependencies:** Ensure task updates reflect actual implementation progress and dependencies
- **Documentation Sync:** Keep specification, tasks, and notes aligned with current understanding and decisions

### Strategic Development Planning
**Implementation Workflow:**
- **Task Prioritization:** Use updated task list to guide development focus and resource allocation
- **Risk Management:** Monitor notes for implementation challenges and adjust planning accordingly
- **Feature Evolution:** Track requirement changes and ensure specification remains current with development reality

**Collaboration & Communication:**
- **Team Coordination:** Use updated specifications to communicate progress and next steps to stakeholders
- **Knowledge Sharing:** Ensure implementation insights captured in notes benefit future development work
- **Quality Standards:** Maintain specification quality to support continued development efficiency

## Instructions for Agent
**Primary Mission:** Load current specification content, analyze user's intended changes, map to precise edit commands, obtain user confirmation, then execute updates through Foundry MCP tools with full error recovery support.

**Execution Standards:** All edit commands must target exact existing text, use appropriate command types for content areas, and maintain specification quality and consistency throughout the update process.

**Success Criteria:** Updates accurately reflect user intent, maintain specification integrity, and provide clear development guidance while supporting continued iterative improvement of the feature specification.
