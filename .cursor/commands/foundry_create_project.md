# Create Foundry Project

## Overview
Create a new Foundry project with comprehensive context documents through collaborative design process.

## Context Gathering Phase

**Project Portfolio Management:**
1. **Foundry System Check:** Use list_projects to avoid naming conflicts and understand existing project portfolio
2. **Project Name Validation:** Ensure kebab-case format for consistency across Foundry system
3. **Scope Definition:** Establish clear boundaries and initial feature set for focused development

## Comprehensive Interview Workflow

### Phase 1: Problem & Market Context
**Core Problem Analysis:**
- What specific user pain point or business problem does this project address?
- How do users currently solve this problem, and what are the limitations?
- What would success look like for both users and the business?
- Are there existing solutions, and how would this be different/better?

**Target Audience Deep Dive:**
- Who are the primary users and what are their technical skill levels?
- What are their key workflows and usage patterns?
- What are their most important requirements and constraints?
- How do they currently discover and adopt new solutions?

### Phase 2: Technical Foundation
**Technology Preferences & Constraints:**
- What programming languages and frameworks are preferred by the team?
- Are there existing infrastructure or platform requirements to consider?
- What are the performance, security, or compliance constraints?
- What is the team's technical expertise and preferred development tools?

**Architecture & Integration:**
- Will this integrate with existing systems or be standalone?
- What are the expected scale and performance requirements?
- Are there specific API or data integration requirements?
- What deployment environments are planned (cloud, on-premise, hybrid)?

### Phase 3: Project Planning
**Development Approach:**
- What is the development timeline and resource availability?
- Should this be built in phases, and what would the MVP include?
- What are the key risks and how might they be mitigated?
- How will success be measured and validated?

## Document Creation Process

### Vision Document (200+ chars minimum)
**Structure & Content:**
- **Problem Statement:** Clear description of user pain points and market opportunity
- **Target Users:** Specific audience definition with user personas and use cases
- **Value Proposition:** Unique benefits and competitive advantages
- **Success Metrics:** Measurable outcomes and key performance indicators
- **Roadmap Priorities:** High-level development phases and key milestones

### Tech Stack Document (150+ chars minimum)
**Comprehensive Technical Decisions:**
- **Core Technologies:** Primary languages, frameworks, and development tools with rationale
- **Infrastructure Choices:** Hosting, database, caching, and storage decisions with reasoning
- **Development Workflow:** Testing frameworks, CI/CD, code quality, and deployment processes
- **External Dependencies:** Third-party services, APIs, and integration requirements
- **Architecture Patterns:** Design patterns, scalability approach, and security considerations

### Summary Document (100+ chars minimum)
**Quick Context Loading:**
- **Essence Capture:** 2-3 sentences that immediately convey project purpose and approach
- **AI Assistant Enablement:** Content that allows future AI assistants to understand context instantly
- **Key Differentiators:** Brief mention of what makes this project unique or valuable

## Collaborative Review & Refinement

### Multi-Round Feedback Process
**Initial Draft Review:**
- Present all three documents together for comprehensive evaluation
- Identify gaps, inconsistencies, or areas needing expansion
- Validate technical assumptions and business logic
- Ensure content meets minimum length and quality requirements

**Iterative Improvement:**
- Address specific feedback on technical approach and market positioning
- Refine language for clarity and add concrete examples where needed
- Validate that all stakeholder concerns and requirements are captured
- Confirm alignment between vision, technical choices, and success criteria

### Quality Validation Checklist
- [ ] All documents meet minimum character requirements
- [ ] Technical decisions include clear rationale and context
- [ ] Vision articulates clear value proposition and success metrics
- [ ] Content is specific enough for implementation guidance
- [ ] Documents work together as cohesive project foundation

## MCP Integration & Execution

**Create Project with Finalized Content:**
```json
{"name":"create_project","arguments":{"project_name":"$1","vision":"<final_vision>","tech_stack":"<final_tech_stack>","summary":"<final_summary>"}}
```

## Error Recovery & Problem Solving

**Content Development Issues:**
- **Vague requirements:** Use targeted follow-up questions to get specific details
- **Technical uncertainty:** Suggest research phases or prototype validation approaches
- **Scope too broad:** Help break down into focused initial version with clear expansion path
- **Conflicting priorities:** Facilitate decision-making through trade-off analysis

**Validation Failures:**
- **Length insufficient:** Guide user to add concrete examples, metrics, and detailed explanations
- **Generic content:** Request specific technology versions, architectural patterns, and business context
- **Inconsistent information:** Highlight conflicts and work with user to resolve contradictions

**System Integration Issues:**
- **Project name conflicts:** Suggest alternatives that maintain semantic meaning
- **Invalid naming format:** Provide kebab-case suggestions while preserving intent
- **MCP connectivity problems:** Guide user through Foundry installation verification

## Workflow Continuity

**After Successful Project Creation:**
- **Immediate next step:** Use `/foundry_create_spec` to define first feature or core capability
- **Context verification:** Consider `/foundry_load_project` to review created documents and ensure completeness
- **Development planning:** Begin systematic feature specification process for structured development approach

**Long-term Development Strategy:**
- **Feature prioritization:** Use project vision to guide specification creation order
- **Technical validation:** Ensure each new spec aligns with established tech stack decisions
- **Progress tracking:** Maintain project coherence as specifications and features evolve

## Instructions for Agent
**Primary Mission:** Conduct comprehensive project interview to gather complete context, collaboratively draft vision/tech-stack/summary documents that meet all quality requirements, then execute project creation through Foundry MCP tools.

**Success Standard:** Created project should provide sufficient context for any development team or AI assistant to understand the project's purpose, technical approach, and success criteria without requiring additional discovery work.
