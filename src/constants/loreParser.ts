import { ALL_LORE_TAGS, LORE_TAG_CATEGORIES } from './loreTags';

export interface LoreEntity {
  name: string;
  type: string;
  category: string;
}

export interface LoreRelationship {
  subject: string;
  predicate: string;
  object: string;
}

export interface LoreEvent {
  name: string;
  date?: string;
  description: string;
}

export interface ParsedLore {
  entities: LoreEntity[];
  relationships: LoreRelationship[];
  events: LoreEvent[];
  tags: string[];
}

const RELATIONSHIP_PATTERNS = [
  { regex: /(.*)\s+(?:is a|are|is the)\s+(.*)/i, predicate: 'is' },
  { regex: /(.*)\s+(?:belongs to|is part of|is member of)\s+(.*)/i, predicate: 'belongs_to' },
  { regex: /(.*)\s+(?:discovered|found|located)\s+(.*)/i, predicate: 'discovered' },
  { regex: /(.*)\s+(?:powers|fuels|activates)\s+(.*)/i, predicate: 'powers' },
  { regex: /(.*)\s+(?:located on|found on|situated on)\s+(.*)/i, predicate: 'located_on' },
];

export const parseLoreContent = (content: string): ParsedLore => {
  const entities: LoreEntity[] = [];
  const relationships: LoreRelationship[] = [];
  const events: LoreEvent[] = [];
  const tags: string[] = [];

  const lowerContent = content.toLowerCase();

  // 1. Extract Entities based on predefined tags
  Object.entries(LORE_TAG_CATEGORIES).forEach(([category, tagList]) => {
    tagList.forEach(tag => {
      const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedTag}\\b`, 'i');
      if (regex.test(content)) {
        tags.push(tag);
        entities.push({
          name: tag,
          type: category.toLowerCase(),
          category
        });
      }
    });
  });

  // 2. Extract Relationships (Simple pattern matching)
  const sentences = content.split(/[.!?]\s+/);
  sentences.forEach(sentence => {
    RELATIONSHIP_PATTERNS.forEach(pattern => {
      const match = sentence.match(pattern.regex);
      if (match) {
        const subject = match[1].trim();
        const object = match[2].trim();
        
        // Only record if subject or object matches an existing entity for better relevance
        const subjectEntity = entities.find(e => subject.toLowerCase().includes(e.name.toLowerCase()));
        const objectEntity = entities.find(e => object.toLowerCase().includes(e.name.toLowerCase()));
        
        if (subjectEntity || objectEntity) {
          relationships.push({
            subject: subjectEntity?.name || subject,
            predicate: pattern.predicate,
            object: objectEntity?.name || object
          });
        }
      }
    });
  });

  // 3. Extract Events (Look for "First discovered", "During the...", etc.)
  const eventRegex = /(?:First discovered|Created|Founded|During the|In the year)\s+([^.!?]*)/gi;
  let eventMatch;
  while ((eventMatch = eventRegex.exec(content)) !== null) {
    events.push({
      name: eventMatch[0].trim(),
      description: eventMatch[1].trim()
    });
  }

  return {
    entities: Array.from(new Set(entities.map(e => JSON.stringify(e)))).map(s => JSON.parse(s)),
    relationships: Array.from(new Set(relationships.map(r => JSON.stringify(r)))).map(s => JSON.parse(s)),
    events,
    tags: Array.from(new Set(tags))
  };
};
