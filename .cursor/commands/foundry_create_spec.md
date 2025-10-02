# Create Spec With Foundry

## Overview
Create a comprehensive feature specification with detailed implementation guidance through collaborative design process.

## Context Gathering & Project Discovery

**Project Foundation Analysis:**
1. **Load Project Context:** Review project vision, tech stack, and summary to understand domain and constraints
2. **Existing Spec Review:** List current specs to avoid duplication and ensure consistent naming patterns
3. **Feature Scope Validation:** Confirm proposed feature aligns with project vision and technical architecture

**Duplicate Prevention & Naming:**
- Scan existing spec names and feature areas to avoid conflicts or overlaps
- Ensure new feature name follows project conventions and semantic clarity
- Validate that feature scope is appropriately focused and doesn't duplicate existing functionality

## Comprehensive Feature Definition Process

### Phase 1: Feature Discovery & Requirements
**Problem Statement & User Value:**
- What specific user pain point or business need does this feature address?
- How do users currently handle this need, and what are the limitations?
- What would success look like from both user and business perspectives?
- How does this feature support the overall project vision and roadmap?

**User Stories & Workflows:**
- Who are the primary users of this feature and what are their technical skill levels?
- What are the key user workflows and interaction patterns?
- What are the most important requirements from a user experience perspective?
- How will users discover, learn, and adopt this feature?

**Technical Requirements & Constraints:**
- How does this feature integrate with existing system architecture?
- What are the performance, security, or compliance requirements?
- Are there specific technology or platform constraints to consider?
- What external dependencies or third-party integrations are needed?

### Phase 2: Technical Design & Planning
**Architecture & Integration:**
- How does this feature connect to existing components and data models?
- What new APIs, database changes, or infrastructure components are needed?
- How will this feature handle errors, edge cases, and recovery scenarios?
- What are the scalability and maintenance considerations?

**Implementation Strategy:**
- Should this be implemented in phases, and what would the MVP include?
- What are the key technical risks and how should they be mitigated?
- What testing strategies are needed for comprehensive validation?
- How will this feature be deployed and monitored in production?

## Document Creation & Structure

### Specification Document (spec.md)
**Complete Section Coverage:**
```markdown
# [Feature Name]

## Overview
- Clear feature purpose and value proposition
- Target user audience and primary use cases
- Key benefits and competitive advantages

## Requirements
### Functional Requirements
- Specific user-facing capabilities and behaviors
- Input/output specifications and data handling
- Integration points with existing system components

### Non-Functional Requirements
- Performance benchmarks and scalability targets
- Security, privacy, and compliance considerations
- Usability, accessibility, and user experience standards

## Acceptance Criteria
- Measurable success criteria for feature completion
- User experience validation points and testing scenarios
- Technical validation requirements and quality gates

## Implementation Approach
- High-level technical strategy and architecture decisions
- Integration patterns and data flow design
- Development phases and milestone planning

## Dependencies
- Prerequisites and blocking requirements
- External service integrations and API dependencies
- Cross-team coordination needs and timelines
```

### Implementation Checklist (task-list.md)
**Complete Development Lifecycle:**
```markdown
## Discovery & Planning Phase
- [ ] Detailed technical design and architecture review
- [ ] API specification and interface design
- [ ] Database schema changes and migration planning
- [ ] Security and compliance review

## Development Phase
- [ ] Core feature implementation and unit testing
- [ ] Integration testing with existing system components
- [ ] User interface development and usability testing
- [ ] Performance optimization and load testing

## Quality Assurance Phase
- [ ] Comprehensive test suite development and execution
- [ ] Security testing and vulnerability assessment
- [ ] Accessibility testing and compliance validation
- [ ] Cross-browser/platform compatibility testing

## Deployment & Launch Phase
- [ ] Documentation updates and developer guide creation
- [ ] Production deployment and infrastructure setup
- [ ] User acceptance testing and feedback collection
- [ ] Monitoring and analytics implementation
```

### Design Notes (notes.md)
**Decision Context & Rationale:**
- Technical decision reasoning and alternative approaches considered
- Risk assessment and mitigation strategies
- Dependencies on other features or external factors
- Future extension opportunities and evolution plans
- Team coordination needs and communication requirements

## Collaborative Review & Iteration

### Multi-Stage Review Process
**Initial Draft Assessment:**
- Present all three documents together for holistic evaluation
- Identify gaps, inconsistencies, or areas requiring additional detail
- Validate technical feasibility and alignment with project constraints
- Ensure comprehensive coverage of requirements and implementation approach

**Refinement & Enhancement:**
- Address feedback on technical approach, user experience, and business value
- Expand sections with concrete examples, code snippets, or mockups where helpful
- Adjust task granularity and sequencing for optimal development workflow
- Update notes with additional context, constraints, or design considerations

### Quality Validation Standards
**Content Completeness:**
- [ ] All specification sections present with sufficient detail for implementation
- [ ] Task list covers complete development lifecycle from planning to deployment
- [ ] Notes provide adequate context for future developers and decision-making
- [ ] Content is specific enough to guide implementation without ambiguity

**Technical Accuracy:**
- [ ] Implementation approach aligns with project tech stack and architecture patterns
- [ ] Dependencies are accurately identified and coordination needs are clear
- [ ] Performance and security considerations are appropriately addressed
- [ ] Testing strategy covers functional, integration, and non-functional requirements

## MCP Integration & Execution

**Create Specification with Complete Content:**
```json
{"name":"create_spec","arguments":{"project_name":"$1","feature_name":"$2","spec":"<final_spec>","tasks":"<final_tasks>","notes":"<final_notes>"}}
```

## Error Recovery & Quality Assurance

**Content Development Challenges:**
- **Scope Definition Issues:** Help break down overly broad features into focused, manageable specifications
- **Technical Complexity:** Suggest phased implementation approach or simplified initial version
- **Requirement Ambiguity:** Use targeted questions to clarify specific behaviors and expectations
- **Integration Concerns:** Review existing specs and architecture to resolve dependency conflicts

**Validation & Refinement:**
- **Incomplete Specifications:** Guide user to expand missing sections with concrete details and examples
- **Task List Gaps:** Ensure complete development lifecycle coverage from planning through deployment
- **Technical Inconsistencies:** Validate alignment with project tech stack and architectural patterns
- **Content Quality:** Help user add specific examples, metrics, and measurable criteria

## Workflow Continuity & Development Planning

**After Successful Specification Creation:**
- **Implementation Initiation:** Begin development using `/foundry_update_spec` to track task completion progress
- **Context Verification:** Use `/foundry_load_spec` to review created specification and validate completeness
- **Project Portfolio:** Consider `/foundry_list_specs` to see new feature in context of overall development roadmap

**Long-term Development Strategy:**
- **Progress Tracking:** Mark tasks complete and add implementation insights as development proceeds
- **Requirement Evolution:** Update specification sections when scope or understanding changes
- **Knowledge Capture:** Document lessons learned, technical decisions, and optimization opportunities

## Instructions for Agent
**Primary Objective:** Conduct comprehensive feature discovery interview, collaboratively draft complete specification documents that meet all quality standards, then execute specification creation through Foundry MCP tools.

**Success Criteria:** Created specification should provide sufficient guidance for any development team to implement the feature successfully, with clear requirements, comprehensive task breakdown, and complete technical context.

**Quality Standard:** All documents should work together as cohesive implementation guide that reduces ambiguity, prevents scope creep, and enables efficient development workflow.
